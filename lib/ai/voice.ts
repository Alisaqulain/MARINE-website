import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/mongodb";
import { sendOwnerMail } from "@/lib/mail";
import { getSiteOrigin } from "@/lib/auth-url";
import { contactFromText, leadSegment, scoreLead, signalsFromText } from "@/lib/ai/scoring";
import { parseVoiceLanguages, summarizeCall, validateCallInsight, voiceLanguageSupported } from "@/lib/ai/calls";
import { lookupProductsForAgent, recordLead, regionFromPhone, voiceStatus } from "@/lib/ai/crm";
import { agentInstructions } from "@/lib/ai/agents";
import { generate, geminiConfigured, parseJsonReply } from "@/lib/ai/gemini";
import { isMissedCall, parseVapiMessage, vapiRequestAuthorized, type VapiMessage, type VapiToolCall } from "@/lib/ai/vapi";
import { exotelCallbackAuthorized, parseExotelCallback } from "@/lib/ai/exotel";
import { queueFollowUp, recordConsent } from "@/lib/ai/followups";

export type VoiceEvent = {
  id: string;
  type: "inbound" | "outbound" | "completed" | "missed" | "opt_out";
  from?: string;
  to?: string;
  transcript?: string;
  consent?: boolean;
  /** ISO 639-1 code of the caller's language, e.g. "de". */
  language?: string;
};

function signatureOk(raw: string, header: string | null) {
  const secret = process.env.VOICE_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function acceptVoiceEvent(raw: string, signature: string | null) {
  const status = voiceStatus();
  if (!status.generic) {
    return { ok: false as const, status: 503, message: "Generic voice webhooks need VOICE_PROVIDER and VOICE_WEBHOOK_SECRET. Vapi uses its own format." };
  }
  if (!signatureOk(raw, signature)) {
    return { ok: false as const, status: 401, message: "Voice webhook signature was rejected." };
  }
  let event: VoiceEvent;
  try {
    event = JSON.parse(raw) as VoiceEvent;
  } catch {
    return { ok: false as const, status: 400, message: "Voice webhook body was not JSON." };
  }
  if (!event.id || !event.type) {
    return { ok: false as const, status: 400, message: "Voice event needs an id and type." };
  }
  if (event.type === "outbound" && event.consent !== true) {
    return { ok: false as const, status: 403, message: "Outbound calls require recorded consent." };
  }
  const db = await getDb();
  const existing = await db.collection("ai_calls").findOne({ id: event.id });
  if (existing) return { ok: true as const, status: 200, duplicate: true, message: "Event already stored." };
  if (event.type === "opt_out" && event.from) {
    await db.collection("ai_suppression").updateOne(
      { phone: event.from },
      { $set: { phone: event.from, at: new Date().toISOString() } },
      { upsert: true }
    );
  }
  const transcript = (event.transcript || "").slice(0, 8000);
  const signals = signalsFromText(transcript, 1, 0);
  const scored = scoreLead(signals);
  const call = summarizeCall(transcript);
  const languages = parseVoiceLanguages(process.env.VOICE_LANGUAGES);
  const languageSupported = voiceLanguageSupported(event.language, languages);
  const sessionId = `call_${(event.from || event.id).replace(/[^a-zA-Z0-9]/g, "").slice(-40)}`;
  const isLead = transcript && (scored.stage !== "cold" || signals.wholesale || signals.quantity >= 10);
  let leadId: string | undefined;
  if (isLead) {
    const lead = await recordLead({
      sessionId,
      channel: "voice",
      scored,
      signals,
      summary: call.summary,
      contact: { ...contactFromText(transcript), ...(event.from ? { phone: event.from } : {}) },
    });
    leadId = lead.id;
  }
  await db.collection("ai_calls").insertOne({
    id: event.id,
    type: event.type,
    from: event.from || "",
    to: event.to || "",
    language: event.language || "",
    languageSupported,
    transcript,
    summary: call.summary,
    objections: call.objections,
    questions: call.questions,
    quantity: call.quantity,
    budgetUsd: call.budgetUsd,
    score: scored.score,
    stage: scored.stage,
    leadId,
    createdAt: new Date().toISOString(),
  });
  return {
    ok: true as const,
    status: 200,
    duplicate: false,
    languageSupported,
    message: languageSupported
      ? "Call event stored. No live call was placed by this request."
      : `Call event stored. Language "${event.language}" is not configured in VOICE_LANGUAGES, so it must not be offered.`,
  };
}

/** Gemini reads the transcript and returns structured insight; falls back to the rule-based summary. */
async function analyseCall(transcript: string) {
  const rules = summarizeCall(transcript);
  if (!transcript.trim() || !geminiConfigured()) return { insight: null, rules };
  const result = await generate({
    system: `${agentInstructions("voice")}\n\nYou are now analysing a finished call for the sales team. Use only what was said in the transcript.`,
    turns: [
      {
        role: "user",
        text: `Return JSON with keys: summary (2-3 sentences), segment (one of b2c, wholesale, b2b, bulk, oem), buyingIntent (boolean), quantity (number the caller stated, else 0), products (array of product names mentioned), objections (array), questions (open questions the team must answer), callbackRequested (boolean), consentToContact (boolean, true only if the caller explicitly agreed to be contacted).\n\nTranscript:\n${transcript.slice(0, 10_000)}`,
      },
    ],
    json: true,
    temperature: 0,
    maxOutputTokens: 1024,
  });
  const insight = result.ok ? validateCallInsight(parseJsonReply(result.text), transcript) : null;
  return { insight, rules };
}

async function alertMissedCall(input: { from: string; source: string; reason: string }) {
  const at = new Date().toISOString();
  let delivered = false;
  let error: string | undefined;
  try {
    await sendOwnerMail(
      `[Marina AI] Missed call from ${input.from || "unknown number"}`,
      [
        `A call was missed (${input.reason}) via ${input.source}.`,
        `Caller: ${input.from || "unknown"}`,
        "",
        "A callback task is waiting for your approval in Admin → Marina AI → Follow-ups. No call is placed until you approve it.",
        `${getSiteOrigin()}/admin`,
      ].join("\n")
    );
    delivered = true;
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 200) : "Alert failed";
  }
  const db = await getDb();
  await db.collection("ai_audit").insertOne({ at, action: "missed_call_alert", source: input.source, delivered, ...(error ? { error } : {}) });
}

async function recordMissedCall(input: { from: string; source: "vapi" | "exotel"; reason: string; callId: string }) {
  if (!input.from) return;
  const sessionId = `call_${input.from.replace(/\D/g, "").slice(-40)}`;
  await recordConsent({ channel: "call", address: input.from, granted: true, source: `inbound_${input.source}_call`, sessionId });
  const row = await queueFollowUp({
    channel: "call",
    to: input.from,
    reason: "missed_call",
    sessionId,
    note: `Missed ${input.source} call ${input.callId} (${input.reason})`,
    dueAt: new Date().toISOString(),
  });
  if (row && row.attempts === 0 && row.status === "needs_approval" && Date.now() - Date.parse(row.createdAt) < 60_000) {
    void alertMissedCall({ from: input.from, source: input.source, reason: input.reason });
  }
}

async function runTool(call: VapiToolCall, message: VapiMessage) {
  if (call.name === "lookup_product") {
    const query = String(call.args.query || "").trim();
    if (!query) return "Ask the caller which product they mean.";
    const found = await lookupProductsForAgent(query, regionFromPhone(message.customerNumber));
    return found.unknown ? "No verified catalogue match. Tell the caller you don't have that information and offer a callback from the team." : found.text;
  }
  if (call.name === "record_enquiry") {
    const args = call.args;
    const notes = [args.product, args.quantity ? `${args.quantity} units` : "", args.timeline, args.notes]
      .filter((part) => typeof part === "string" || typeof part === "number")
      .join(". ")
      .slice(0, 1000);
    const signals = signalsFromText(notes, 1, 0);
    if (typeof args.quantity === "number" && args.quantity > 0) signals.quantity = Math.round(args.quantity);
    const scored = scoreLead(signals);
    const phone = message.customerNumber;
    const email = typeof args.email === "string" && /@/.test(args.email) ? args.email.toLowerCase().slice(0, 120) : "";
    await recordLead({
      sessionId: `call_${(phone || message.callId).replace(/[^a-zA-Z0-9]/g, "").slice(-40)}`,
      channel: "voice",
      scored,
      signals,
      summary: notes || "Phone enquiry",
      segment: leadSegment(notes, signals.quantity),
      contact: {
        ...(typeof args.name === "string" ? { name: args.name.slice(0, 80) } : {}),
        ...(typeof args.company === "string" ? { company: args.company.slice(0, 80) } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      },
      productInterest: typeof args.product === "string" ? [args.product.slice(0, 80)] : [],
    });
    if (args.consentToContact === true) {
      if (phone) await recordConsent({ channel: "call", address: phone, granted: true, source: "voice_enquiry", sessionId: message.callId });
      if (email) await recordConsent({ channel: "email", address: email, granted: true, source: "voice_enquiry", sessionId: message.callId });
    }
    return "Enquiry saved. Tell the caller the team will follow up.";
  }
  return "Unknown tool.";
}

/**
 * Vapi server URL handler: tool calls are answered from the verified catalogue; end-of-call reports become
 * a call record, a Gemini summary, a CRM lead and, for missed calls, an owner alert plus a callback task.
 */
export async function acceptVapiMessage(raw: string, headers: { get(name: string): string | null }) {
  if (!vapiRequestAuthorized(headers)) return { status: 401, body: { error: "Vapi request was not authorised." } };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "Body was not JSON." } };
  }
  const message = parseVapiMessage(body);
  if (!message) return { status: 400, body: { error: "Not a Vapi server message." } };
  const db = await getDb();

  if (message.kind === "tool-calls") {
    const results = [];
    for (const call of message.toolCalls.slice(0, 5)) {
      const result = await runTool(call, message).catch((err) => {
        console.error("[vapi-tool]", call.name, err instanceof Error ? err.message : "failed");
        return "The lookup failed. Tell the caller the team will follow up.";
      });
      results.push({ name: call.name, toolCallId: call.id, result });
    }
    return { status: 200, body: { results } };
  }

  if (message.kind === "status-update") {
    if (message.callId) {
      const now = new Date().toISOString();
      await db.collection("ai_calls").updateOne(
        { id: message.callId },
        {
          $set: { id: message.callId, provider: "vapi", status: message.status, direction: message.direction, from: message.customerNumber, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
    }
    return { status: 200, body: { ok: true } };
  }

  if (message.kind !== "end-of-call-report") return { status: 200, body: { ok: true, ignored: message.rawType } };
  if (!message.callId) return { status: 400, body: { error: "End-of-call report has no call id." } };
  const existing = await db.collection("ai_calls").findOne({ id: message.callId, endedReason: { $exists: true } });
  if (existing) return { status: 200, body: { ok: true, duplicate: true } };

  const missed = isMissedCall(message);
  const { insight, rules } = await analyseCall(message.transcript);
  const signals = signalsFromText(message.transcript, 1, 0);
  if (insight?.quantity) signals.quantity = insight.quantity;
  if (insight && insight.segment !== "b2c") signals.wholesale = true;
  const scored = scoreLead(signals);
  const from = message.customerNumber;
  const sessionId = `call_${(from || message.callId).replace(/[^a-zA-Z0-9]/g, "").slice(-40)}`;
  const summary = insight?.summary || message.summary || rules.summary;
  let leadId: string | undefined;
  if (!missed && message.transcript && (scored.stage !== "cold" || signals.wholesale || signals.quantity >= 10 || insight?.callbackRequested)) {
    const lead = await recordLead({
      sessionId,
      channel: "voice",
      scored,
      signals,
      summary,
      segment: insight?.segment ?? leadSegment(message.transcript, signals.quantity),
      contact: { ...contactFromText(message.transcript), ...(from ? { phone: from } : {}) },
      productInterest: insight?.products,
    });
    leadId = lead.id;
  }
  if (insight?.consentToContact && from) await recordConsent({ channel: "call", address: from, granted: true, source: "vapi_call", sessionId });
  const now = new Date().toISOString();
  await db.collection("ai_calls").updateOne(
    { id: message.callId },
    {
      $set: {
        id: message.callId,
        provider: "vapi",
        type: missed ? "missed" : "completed",
        direction: message.direction,
        from,
        endedReason: message.endedReason,
        durationSeconds: message.durationSeconds,
        transcript: message.transcript,
        summary,
        summarySource: insight ? "gemini" : message.summary ? "vapi" : "rules",
        objections: insight?.objections ?? rules.objections,
        questions: insight?.questions ?? rules.questions,
        quantity: signals.quantity,
        budgetUsd: rules.budgetUsd,
        score: scored.score,
        stage: scored.stage,
        leadId,
        hasRecording: Boolean(message.recordingUrl),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  if (missed || insight?.callbackRequested) {
    await recordMissedCall({ from, source: "vapi", reason: missed ? message.endedReason || "no caller speech" : "callback requested", callId: message.callId });
  }
  return { status: 200, body: { ok: true, missed, leadId: leadId ?? null } };
}

/** Exotel StatusCallback for the ExoPhone: missed inbound calls become callback tasks. */
export async function acceptExotelCallback(params: URLSearchParams, token: string | null) {
  if (!exotelCallbackAuthorized(token)) return { status: 401, body: { error: "Exotel callback token was rejected." } };
  const event = parseExotelCallback(params);
  if (!event) return { status: 400, body: { error: "Missing CallSid." } };
  const db = await getDb();
  const id = `exotel_${event.callSid}`;
  const existing = await db.collection("ai_calls").findOne({ id });
  if (existing) return { status: 200, body: { ok: true, duplicate: true } };
  await db.collection("ai_calls").insertOne({
    id,
    provider: "exotel",
    type: event.missed ? "missed" : "completed",
    direction: event.direction,
    from: event.from,
    to: event.to,
    status: event.status,
    createdAt: new Date().toISOString(),
  });
  if (event.missed && event.direction.startsWith("inbound")) {
    await recordMissedCall({ from: event.from, source: "exotel", reason: event.status, callId: event.callSid });
  }
  return { status: 200, body: { ok: true, missed: event.missed } };
}
