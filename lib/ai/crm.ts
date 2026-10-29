import { getDb } from "@/lib/mongodb";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { regionalPrice, type PriceRegion } from "@/lib/region";
import { answerFromCatalogue, type CatalogueFact } from "@/lib/ai/answer";
import { requiresOwnerApproval } from "@/lib/ai/permissions";
import { scoreLead, signalsFromText, type LeadStage } from "@/lib/ai/scoring";

export type AiLead = {
  id: string;
  sessionId: string;
  name?: string;
  email?: string;
  company?: string;
  country?: string;
  stage: LeadStage;
  score: number;
  factors: string[];
  quantity: number;
  estimatedValueUsd: number;
  summary: string;
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
  }));
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function optionalRewrite(question: string, grounded: string) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return grounded;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Reply using only the approved facts. Do not add prices, stock, dates, discounts, or policies that are not written in those facts.",
          },
          { role: "user", content: `Question: ${question}\nApproved facts:\n${grounded}` },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return grounded;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || grounded;
  } catch {
    return grounded;
  }
}

export async function handleCustomerMessage(input: {
  sessionId: string;
  message: string;
  region: PriceRegion;
  country?: string;
}) {
  const message = input.message.trim().slice(0, 2000);
  if (!message) return { error: "Message is empty." as const };
  const catalogue = await facts(input.region);
  const answer = answerFromCatalogue(message, catalogue);
  const spoken = await optionalRewrite(message, answer.text);
  const unit = answer.products[0]?.price ?? 0;
  const db = await getDb();
  const sessions = db.collection("ai_sessions");
  const existing = await sessions.findOne({ id: input.sessionId });
  const messages = Number(existing?.messageCount ?? 0) + 1;
  const signals = signalsFromText(message, messages, unit);
  const scored = scoreLead(signals);
  const now = new Date().toISOString();
  await sessions.updateOne(
    { id: input.sessionId },
    {
      $set: {
        id: input.sessionId,
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
  await db.collection("ai_messages").insertOne({
    sessionId: input.sessionId,
    role: "customer",
    text: message,
    at: now,
  });
  await db.collection("ai_messages").insertOne({
    sessionId: input.sessionId,
    role: "assistant",
    text: spoken,
    products: answer.products.map((product) => product.slug),
    unknown: answer.unknown,
    at: now,
  });

  let lead: AiLead | null = null;
  let approval: AiApproval | null = null;
  const highValue = scored.stage === "high-value" || scored.stage === "hot" || signals.wholesale || signals.quantity >= 10;
  if (highValue) {
    const leadId = String(existing?.leadId || newId("lead"));
    lead = {
      id: leadId,
      sessionId: input.sessionId,
      stage: scored.stage,
      score: scored.score,
      factors: scored.factors,
      quantity: signals.quantity,
      estimatedValueUsd: Number(signals.estimatedValueUsd.toFixed(2)),
      summary: message.slice(0, 500),
      country: input.country,
      createdAt: String(existing?.createdAt || now),
      updatedAt: now,
    };
    await db.collection("ai_leads").updateOne({ id: leadId }, { $set: lead }, { upsert: true });
    await sessions.updateOne({ id: input.sessionId }, { $set: { leadId } });
    if (requiresOwnerApproval("discount") && /\b(discount|% off|percent off)\b/i.test(message)) {
      approval = {
        id: newId("apr"),
        leadId,
        sessionId: input.sessionId,
        action: "discount",
        termsHash: `${leadId}:discount:${message.slice(0, 180)}`,
        terms: message.slice(0, 500),
        status: "pending",
        createdAt: now,
      };
      await db.collection("ai_approvals").insertOne(approval);
    }
    await db.collection("ai_audit").insertOne({
      at: now,
      action: "notify_owner",
      sessionId: input.sessionId,
      leadId,
      score: scored.score,
    });
  }

  return { answer, reply: spoken, scored, lead, approval };
}

export async function listAiAdmin() {
  const db = await getDb();
  const [leads, approvals, calls, sessions] = await Promise.all([
    db.collection("ai_leads").find({}).sort({ updatedAt: -1 }).limit(40).toArray(),
    db.collection("ai_approvals").find({}).sort({ createdAt: -1 }).limit(40).toArray(),
    db.collection("ai_calls").find({}).sort({ createdAt: -1 }).limit(40).toArray(),
    db.collection("ai_sessions").countDocuments(),
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
    voice: voiceStatus(),
    chatModel: process.env.OPENAI_API_KEY?.trim() ? "configured" : "catalogue-only",
  };
}

export function voiceStatus() {
  const configured = Boolean(process.env.VOICE_PROVIDER?.trim() && process.env.VOICE_WEBHOOK_SECRET?.trim());
  return {
    configured,
    provider: process.env.VOICE_PROVIDER?.trim() || null,
    message: configured
      ? "Voice provider credentials are set. Live calling still depends on that provider accepting the webhook."
      : "Voice is not live. Set VOICE_PROVIDER and VOICE_WEBHOOK_SECRET to enable call webhooks. No calls are being placed.",
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
