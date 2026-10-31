import { getDb } from "@/lib/mongodb";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { regionalPrice, type PriceRegion } from "@/lib/region";
import { getSiteOrigin } from "@/lib/auth-url";
import { sendOwnerMail } from "@/lib/mail";
import { APPROVED_POLICIES, answerFromCatalogue, type CatalogueFact } from "@/lib/ai/answer";
import {
  ownerAlertText,
  ownerAlertThreshold,
  ownerAlertValueUsd,
  shouldAlertOwner,
  type TranscriptLine,
} from "@/lib/ai/alerts";
import { parseVoiceLanguages, TARGET_VOICE_LANGUAGES } from "@/lib/ai/calls";
import { approvalReply, requiresOwnerApproval, type SessionApproval } from "@/lib/ai/permissions";
import {
  classifyLead,
  contactFromText,
  leadSegment,
  scoreLead,
  signalsFromText,
  type ContactDetails,
  type LeadSegment,
  type LeadSignals,
  type LeadStage,
  type ScoreResult,
} from "@/lib/ai/scoring";
import { agentInstructions, factsBlock, replyIsGrounded, type AgentId } from "@/lib/ai/agents";
import { generate, geminiConfigured, geminiModel, type GeminiTurn } from "@/lib/ai/gemini";
import { vapiStatus } from "@/lib/ai/vapi";

export type AiLead = {
  id: string;
  sessionId: string;
  channel?: "chat" | "voice" | "whatsapp";
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
  productInterest?: string[];
  stage: LeadStage;
  segment?: LeadSegment;
  score: number;
  factors: string[];
  quantity: number;
  estimatedValueUsd: number;
  summary: string;
  /** Score at the last owner alert; unset until the owner has been alerted. */
  alertedScore?: number;
  alertedAt?: string;
  alertDelivered?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiApproval = {
  id: string;
  leadId: string;
  sessionId: string;
  action: "discount" | "payment_terms" | "custom_commitment";
  termsHash: string;
  terms: string;
  status: "pending" | "approved" | "rejected" | "expired";
  reason?: string;
  createdAt: string;
  decidedAt?: string;
};

const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  row.count += 1;
  return row.count <= limit;
}

async function facts(region: PriceRegion): Promise<CatalogueFact[]> {
  const products = await getStorefrontProducts();
  return products.slice(0, 400).map((product) => ({
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    price: regionalPrice(product, region),
    currency: "USD",
    material: product.material,
    dimensions: product.dimensions,
    stock: product.stock,
    quantity: product.quantity,
    description: product.description || product.name,
    href: `/product/${product.slug}`,
    moq: product.moq,
  }));
}

const SEGMENT_RANK: LeadSegment[] = ["b2c", "bulk", "wholesale", "b2b", "oem"];

/** A lead keeps the most specific segment it has ever shown. */
function rankSegment(a?: LeadSegment, b?: LeadSegment): LeadSegment {
  const ia = a ? SEGMENT_RANK.indexOf(a) : 0;
  const ib = b ? SEGMENT_RANK.indexOf(b) : 0;
  return SEGMENT_RANK[Math.max(ia, ib, 0)];
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function approvedPolicyLines() {
  return [
    `Shipping: ${APPROVED_POLICIES.shipping}`,
    `Returns: ${APPROVED_POLICIES.returns}`,
    `Discounts: ${APPROVED_POLICIES.discount}`,
    `Custom manufacturing: ${APPROVED_POLICIES.manufacturing}`,
    `Warranty: ${APPROVED_POLICIES.warranty ?? "There is no approved warranty statement. Do not describe one."}`,
  ];
}

/**
 * Gemini writes the reply from verified catalogue facts and the recent conversation.
 * The reply is used only if every commercial number in it is in those facts; otherwise the plain catalogue text is kept.
 */
async function groundedReply(input: {
  agent: AgentId;
  message: string;
  history: TranscriptLine[];
  products: CatalogueFact[];
  grounded: string;
}): Promise<{ text: string; model: "gemini" | "catalogue"; rejected?: string[]; error?: string }> {
  if (!geminiConfigured()) return { text: input.grounded, model: "catalogue" };
  const facts = factsBlock({ products: input.products, policies: approvedPolicyLines(), origin: getSiteOrigin() });
  const turns: GeminiTurn[] = input.history.slice(-8).map((line) => ({
    role: line.role === "customer" ? "user" : "model",
    text: line.text,
  }));
  turns.push({
    role: "user",
    text: `${facts}\n\nCatalogue answer to rephrase or extend (already verified):\n${input.grounded}\n\nCustomer message:\n${input.message}`,
  });
  const result = await generate({ system: agentInstructions(input.agent), turns, temperature: 0.3, maxOutputTokens: 1024 });
  if (!result.ok) return { text: input.grounded, model: "catalogue", error: result.error };
  const check = replyIsGrounded(result.text, `${facts}\n${input.grounded}`);
  if (!check.grounded) {
    console.warn("[ai-grounding] rejected model reply:", check.unsupported.join(", "));
    return { text: input.grounded, model: "catalogue", rejected: check.unsupported };
  }
  return { text: result.text, model: "gemini" };
}

async function sessionProducts(sessionId: string, catalogue: CatalogueFact[]) {
  const db = await getDb();
  const last = await db
    .collection("ai_messages")
    .findOne({ sessionId, role: "assistant", "products.0": { $exists: true } }, { sort: { at: -1 } });
  const slugs = Array.isArray(last?.products) ? (last.products as string[]) : [];
  return catalogue.filter((product) => slugs.includes(product.slug));
}

/** Region from a caller's or WhatsApp sender's number: +91 is India, +1 the US. */
export function regionFromPhone(phone: string | undefined): PriceRegion {
  const d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("91") && d.length >= 12) return "india";
  if (d.startsWith("1") && d.length === 11) return "us";
  return "other";
}

/** Verified catalogue answer for an agent tool (voice `lookup_product`). */
export async function lookupProductsForAgent(query: string, region: PriceRegion = "other") {
  const answer = answerFromCatalogue(query.slice(0, 300), await facts(region));
  const moq = answer.products
    .filter((product) => product.moq)
    .map((product) => `${product.name}: wholesale minimum order ${product.moq} units.`);
  return { text: [answer.text, ...moq].join("\n"), products: answer.products, unknown: answer.unknown };
}

export async function recentTranscript(sessionId: string): Promise<TranscriptLine[]> {
  const db = await getDb();
  const rows = await db.collection("ai_messages").find({ sessionId }).sort({ at: -1, _id: -1 }).limit(12).toArray();
  return rows.reverse().map((row) => ({ role: String(row.role), text: String(row.text ?? "").slice(0, 600) }));
}

/** Emails the owner and records the outcome. Never throws: the customer conversation carries on regardless. */
async function alertOwner(lead: AiLead, requestedDecision: string) {
  const db = await getDb();
  const at = new Date().toISOString();
  let delivered = false;
  let error: string | undefined;
  try {
    const transcript = await recentTranscript(lead.sessionId);
    const mail = ownerAlertText(lead, transcript, requestedDecision, `${getSiteOrigin()}/admin`);
    await sendOwnerMail(mail.subject, mail.text);
    delivered = true;
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : "Alert failed";
  }
  await db.collection("ai_leads").updateOne({ id: lead.id }, { $set: { alertedScore: lead.score, alertedAt: at, alertDelivered: delivered } });
  await db.collection("ai_audit").insertOne({
    at,
    action: "notify_owner",
    sessionId: lead.sessionId,
    leadId: lead.id,
    score: lead.score,
    delivered,
    ...(error ? { error } : {}),
  });
}

/**
 * Creates or updates the CRM lead for a conversation or call, keeping the best details seen so far,
 * and alerts the owner when the lead crosses the threshold or needs a decision. Shared by chat, voice and WhatsApp.
 */
export async function recordLead(input: {
  sessionId: string;
  channel: "chat" | "voice" | "whatsapp";
  scored: ScoreResult;
  signals: LeadSignals;
  summary: string;
  country?: string;
  contact?: ContactDetails;
  productInterest?: string[];
  /** Set when the customer asked for something only the owner can approve. */
  requestedDecision?: string;
  segment?: LeadSegment;
}): Promise<AiLead> {
  const db = await getDb();
  const leads = db.collection<AiLead>("ai_leads");
  const existing = await leads.findOne({ sessionId: input.sessionId });
  const now = new Date().toISOString();
  const score = Math.max(existing?.score ?? 0, input.scored.score);
  const contact = input.contact ?? {};
  const lead: AiLead = {
    id: existing?.id ?? newId("lead"),
    sessionId: input.sessionId,
    channel: existing?.channel ?? input.channel,
    name: contact.name ?? existing?.name,
    email: contact.email ?? existing?.email,
    phone: contact.phone ?? existing?.phone,
    company: contact.company ?? existing?.company,
    country: input.country || existing?.country,
    productInterest: [...new Set([...(existing?.productInterest ?? []), ...(input.productInterest ?? [])])].slice(0, 10),
    stage: classifyLead(score),
    segment: rankSegment(existing?.segment, input.segment),
    score,
    factors: score === input.scored.score ? input.scored.factors : existing?.factors ?? input.scored.factors,
    quantity: input.signals.quantity || existing?.quantity || 0,
    estimatedValueUsd: Number(Math.max(existing?.estimatedValueUsd ?? 0, input.signals.estimatedValueUsd).toFixed(2)),
    summary: input.summary.slice(0, 500),
    alertedScore: existing?.alertedScore,
    alertedAt: existing?.alertedAt,
    alertDelivered: existing?.alertDelivered,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const { alertedScore: _a, alertedAt: _b, alertDelivered: _c, ...fields } = lead;
  await leads.updateOne({ id: lead.id }, { $set: fields }, { upsert: true });
  await db.collection("ai_sessions").updateOne({ id: input.sessionId }, { $set: { leadId: lead.id } });

  const alert = shouldAlertOwner({
    score: lead.score,
    threshold: ownerAlertThreshold(process.env.AI_OWNER_ALERT_SCORE),
    valueUsd: lead.estimatedValueUsd,
    valueThresholdUsd: ownerAlertValueUsd(process.env.AI_OWNER_ALERT_VALUE_USD),
    alertedScore: existing?.alertedScore ?? null,
    approvalRequested: Boolean(input.requestedDecision),
  });
  if (alert) {
    // Do not hold up the customer's reply on SMTP.
    void alertOwner(lead, input.requestedDecision ?? "None yet — review the lead and decide whether to step in.").catch(
      (err) => console.error("[ai-alert]", err instanceof Error ? err.message : "failed")
    );
  }
  return lead;
}

const DISCOUNT_ASK = /\b(discount|% off|percent off|better price|special price|best price)\b/i;

export async function handleCustomerMessage(input: {
  sessionId: string;
  message: string;
  region: PriceRegion;
  country?: string;
  channel?: "chat" | "whatsapp";
  /** Details the channel already knows, e.g. the WhatsApp sender's number and profile name. */
  knownContact?: ContactDetails;
}) {
  const message = input.message.trim().slice(0, 2000);
  if (!message) return { error: "Message is empty." as const };
  const catalogue = await facts(input.region);
  const answer = answerFromCatalogue(message, catalogue);
  const history = await recentTranscript(input.sessionId);
  const db = await getDb();
  const sessions = db.collection("ai_sessions");
  const existing = await sessions.findOne({ id: input.sessionId });
  const messages = Number(existing?.messageCount ?? 0) + 1;
  const unit = answer.products[0]?.price ?? 0;
  const signals = signalsFromText(message, messages, unit);
  const scored = scoreLead(signals);
  const contact = { ...(input.knownContact ?? {}), ...contactFromText(message) };
  const segment = leadSegment(message, signals.quantity);
  const eligible =
    scored.stage === "high-value" ||
    scored.stage === "hot" ||
    signals.wholesale ||
    signals.quantity >= 10 ||
    Boolean(existing?.leadId);

  // Restricted requests: release an owner decision if there is one, otherwise open a request.
  let reply: string | null = null;
  let requestedDecision: string | undefined;
  let released = false;
  if (DISCOUNT_ASK.test(message) && requiresOwnerApproval("discount")) {
    const prior = await db
      .collection<AiApproval>("ai_approvals")
      .find({ sessionId: input.sessionId, action: "discount" })
      .toArray();
    const decided = approvalReply(prior as SessionApproval[]);
    if (decided) {
      reply = decided.text;
      released = decided.released;
    } else if (eligible) {
      requestedDecision = `Approve or reject a special discount: "${message.slice(0, 300)}"`;
      reply = `${APPROVED_POLICIES.discount} I've passed your request to our team for approval and will share the decision here. Meanwhile I'm happy to keep helping.`;
    }
  }
  let model: "gemini" | "catalogue" | "approval" = "approval";
  if (reply == null) {
    // A follow-up such as "how many do you have?" refers to the products discussed last.
    const products = answer.products.length ? answer.products : await sessionProducts(input.sessionId, catalogue);
    const written = await groundedReply({
      agent: input.channel === "whatsapp" ? "whatsapp" : "chat",
      message,
      history,
      products,
      grounded: answer.text,
    });
    reply = written.text;
    model = written.model;
    if (written.rejected?.length) {
      await db.collection("ai_audit").insertOne({
        at: new Date().toISOString(),
        action: "grounding_rejected",
        sessionId: input.sessionId,
        unsupported: written.rejected.slice(0, 10),
      });
    }
  }

  const now = new Date().toISOString();
  await sessions.updateOne(
    { id: input.sessionId },
    {
      $set: {
        id: input.sessionId,
        channel: input.channel ?? "chat",
        updatedAt: now,
        messageCount: messages,
        region: input.region,
        country: input.country || existing?.country || "",
        lastScore: scored.score,
        lastStage: scored.stage,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  await db.collection("ai_messages").insertMany([
    { sessionId: input.sessionId, role: "customer", text: message, at: now },
    {
      sessionId: input.sessionId,
      role: "assistant",
      text: reply,
      products: answer.products.map((product) => product.slug),
      unknown: answer.unknown,
      model,
      at: new Date(Date.parse(now) + 1).toISOString(),
    },
  ]);
  if (released) {
    await db.collection("ai_audit").insertOne({ at: now, action: "release_approved", sessionId: input.sessionId });
  }

  let lead: AiLead | null = null;
  let approval: AiApproval | null = null;
  if (eligible || Object.keys(contact).length) {
    lead = await recordLead({
      sessionId: input.sessionId,
      channel: input.channel ?? "chat",
      scored,
      signals,
      summary: message,
      country: input.country,
      contact,
      productInterest: answer.products.map((product) => product.name),
      requestedDecision,
      segment,
    });
    if (requestedDecision) {
      approval = {
        id: newId("apr"),
        leadId: lead.id,
        sessionId: input.sessionId,
        action: "discount",
        termsHash: `${lead.id}:discount:${message.slice(0, 180)}`,
        terms: message.slice(0, 500),
        status: "pending",
        createdAt: now,
      };
      await db.collection("ai_approvals").insertOne({ ...approval });
    }
  }

  return { answer, reply, scored, lead, approval, model, segment };
}

export async function listAiAdmin() {
  const db = await getDb();
  const [leads, approvals, calls, sessions, followUps, content, whatsapp] = await Promise.all([
    db.collection("ai_leads").find({}).sort({ updatedAt: -1 }).limit(40).toArray(),
    db.collection("ai_approvals").find({}).sort({ createdAt: -1 }).limit(40).toArray(),
    db.collection("ai_calls").find({}).sort({ createdAt: -1 }).limit(40).toArray(),
    db.collection("ai_sessions").countDocuments(),
    db.collection("ai_followups").find({}).sort({ createdAt: -1 }).limit(40).toArray(),
    db.collection("ai_content").find({}).sort({ createdAt: -1 }).limit(20).toArray(),
    db.collection("ai_wa_messages").find({ direction: "out" }).sort({ at: -1 }).limit(30).toArray(),
  ]);
  const strip = (doc: Record<string, unknown>) => {
    const { _id: _ignored, ...rest } = doc;
    return rest;
  };
  return {
    sessions,
    leads: leads.map((doc) => strip(doc as Record<string, unknown>)),
    approvals: approvals.map((doc) => strip(doc as Record<string, unknown>)),
    calls: calls.map((doc) => strip(doc as Record<string, unknown>)),
    followUps: followUps.map((doc) => strip(doc as Record<string, unknown>)),
    content: content.map((doc) => strip(doc as Record<string, unknown>)),
    whatsapp: whatsapp.map((doc) => strip(doc as Record<string, unknown>)),
    voice: voiceStatus(),
    chatModel: geminiConfigured() ? `gemini:${geminiModel()}` : "catalogue-only",
  };
}

/**
 * Voice webhooks are accepted from Vapi (VAPI_WEBHOOK_SECRET) or, for any other provider,
 * the generic HMAC format (VOICE_PROVIDER + VOICE_WEBHOOK_SECRET).
 */
export function voiceStatus() {
  const vapi = vapiStatus();
  const generic = Boolean(process.env.VOICE_PROVIDER?.trim() && process.env.VOICE_WEBHOOK_SECRET?.trim());
  const configured = vapi.webhookReady || generic;
  const languages = parseVoiceLanguages(process.env.VOICE_LANGUAGES);
  const offered = languages.map((code) => TARGET_VOICE_LANGUAGES[code]).join(", ");
  return {
    configured,
    vapi: vapi.webhookReady,
    generic,
    provider: vapi.webhookReady ? "vapi" : process.env.VOICE_PROVIDER?.trim() || null,
    languages: languages.map((code) => TARGET_VOICE_LANGUAGES[code]),
    outboundEnabled: vapi.outboundEnabled,
    message: configured
      ? `Voice webhooks are accepted${vapi.webhookReady ? " from Vapi" : ""}${generic ? `${vapi.webhookReady ? " and" : " from"} ${process.env.VOICE_PROVIDER?.trim()}` : ""}. Offered languages: ${offered}. Outbound calls are ${vapi.outboundEnabled ? "enabled (admin-started, consent required)" : "disabled"}.`
      : "Voice is not live. Set VAPI_API_KEY and VAPI_WEBHOOK_SECRET (or VOICE_PROVIDER and VOICE_WEBHOOK_SECRET). No calls are being placed.",
  };
}

export async function decideApproval(input: { id: string; status: "approved" | "rejected"; reason: string; actor: string }) {
  const db = await getDb();
  const current = await db.collection<AiApproval>("ai_approvals").findOne({ id: input.id });
  if (!current) return { error: "Approval not found." as const };
  if (current.status !== "pending") return { error: "This request is no longer pending." as const };
  const decidedAt = new Date().toISOString();
  await db.collection("ai_approvals").updateOne(
    { id: input.id, status: "pending" },
    { $set: { status: input.status, reason: input.reason.slice(0, 500), decidedAt, actor: input.actor } }
  );
  await db.collection("ai_audit").insertOne({
    at: decidedAt,
    action: "owner_decision",
    approvalId: input.id,
    status: input.status,
    actor: input.actor,
  });
  return { ok: true as const };
}
