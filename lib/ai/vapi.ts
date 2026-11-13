/**
 * Vapi voice infrastructure for Agent 2. Gemini is the assistant's model (`model.provider: "google"`).
 * Telephony is Exotel over SIP: an Exotel vSIP trunk sends inbound calls to `<credentialId>.sip.vapi.ai`,
 * and a Vapi `byo-sip-trunk` credential sends outbound calls to the Exotel gateway (see lib/ai/exotel.ts).
 * Pure helpers + thin API calls; relative imports so `npm run check:phase2` can load it.
 */
import { createHash, timingSafeEqual } from "crypto";
import { agentInstructions } from "./agents.ts";
import { geminiModel } from "./gemini.ts";
import { env, flag, isUuid, looksLikePlaceholder, requestJson } from "./http.ts";

export const VAPI_TOOLS = ["lookup_product", "record_enquiry"] as const;
/** Name of the assistant this site creates and manages. Other assistants in the org (e.g. Riley) are never touched. */
export const VAPI_ASSISTANT_NAME = "Marina Muse Assistant";

export function vapiBase() {
  const base = env("VAPI_API_BASE") || "https://api.vapi.ai";
  return /^https:\/\/api(\.eu)?\.vapi\.ai$/.test(base) ? base : "https://api.vapi.ai";
}

/**
 * Vapi's private API key and every object id (assistant, phone number, credential) are UUIDs; Vapi answers
 * 400 "id must be a valid UUID" for anything else. Returns null when the value is usable, else the problem.
 */
export function vapiValueProblem(name: "VAPI_API_KEY" | "VAPI_ASSISTANT_ID" | "VAPI_PHONE_NUMBER_ID" | "VAPI_SIP_CREDENTIAL_ID" | "VAPI_WEBHOOK_SECRET", value = env(name)) {
  if (!value) return "not set";
  if (looksLikePlaceholder(value)) return "is placeholder text, not a real value";
  if (name === "VAPI_WEBHOOK_SECRET") return value.length >= 24 ? null : "is too short (use openssl rand -hex 32)";
  return isUuid(value) ? null : "is not a Vapi UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)";
}

export function vapiStatus() {
  const usable = (name: Parameters<typeof vapiValueProblem>[0]) => vapiValueProblem(name) === null;
  const apiKey = usable("VAPI_API_KEY");
  const assistantId = usable("VAPI_ASSISTANT_ID");
  const phoneNumberId = usable("VAPI_PHONE_NUMBER_ID");
  return {
    apiKey,
    assistantId,
    phoneNumberId,
    sipCredentialId: usable("VAPI_SIP_CREDENTIAL_ID"),
    webhookReady: usable("VAPI_WEBHOOK_SECRET"),
    /** Outbound calls are billable: off unless the flag and every id are set and valid. */
    outboundEnabled: flag("VAPI_OUTBOUND_ENABLED") && apiKey && assistantId && phoneNumberId,
  };
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(createHash("sha256").update(a).digest("hex"));
  const right = Buffer.from(createHash("sha256").update(b).digest("hex"));
  return a.length === b.length && timingSafeEqual(left, right);
}

/** Vapi sends the server secret as `Authorization: Bearer <secret>` (Bearer credential) or the legacy `X-Vapi-Secret`. */
export function vapiRequestAuthorized(headers: { get(name: string): string | null }, secret = env("VAPI_WEBHOOK_SECRET")) {
  // A placeholder or short secret is guessable: refuse everything rather than accept it.
  if (vapiValueProblem("VAPI_WEBHOOK_SECRET", secret)) return false;
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const legacy = headers.get("x-vapi-secret")?.trim() || "";
  return (bearer !== "" && safeEqual(bearer, secret)) || (legacy !== "" && safeEqual(legacy, secret));
}

export type VapiToolCall = { id: string; name: string; args: Record<string, unknown> };

export type VapiMessage = {
  kind: "end-of-call-report" | "status-update" | "tool-calls" | "assistant-request" | "hang" | "other";
  rawType: string;
  callId: string;
  direction: "inbound" | "outbound" | "web" | "unknown";
  customerNumber: string;
  status: string;
  endedReason: string;
  transcript: string;
  summary: string;
  durationSeconds: number | null;
  recordingUrl: string;
  toolCalls: VapiToolCall[];
};

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Normalises a Vapi server message: `{ message: { type, call, artifact, analysis, endedReason, toolCallList } }`. */
export function parseVapiMessage(body: unknown): VapiMessage | null {
  const message = (body as { message?: Record<string, unknown> })?.message;
  if (!message || typeof message.type !== "string") return null;
  const call = (message.call || {}) as Record<string, unknown>;
  const customer = (call.customer || message.customer || {}) as Record<string, unknown>;
  const artifact = (message.artifact || {}) as Record<string, unknown>;
  const analysis = (message.analysis || {}) as Record<string, unknown>;
  const callType = str(call.type);
  const known = ["end-of-call-report", "status-update", "tool-calls", "assistant-request", "hang"];
  const toolList = Array.isArray(message.toolCallList) ? (message.toolCallList as Record<string, unknown>[]) : [];
  const started = Date.parse(str(message.startedAt) || str(call.startedAt));
  const ended = Date.parse(str(message.endedAt) || str(call.endedAt));
  const recording = (artifact.recording || {}) as Record<string, unknown>;
  return {
    kind: (known.includes(message.type) ? message.type : "other") as VapiMessage["kind"],
    rawType: message.type,
    callId: str(call.id) || str(message.callId),
    direction: callType === "inboundPhoneCall" ? "inbound" : callType === "outboundPhoneCall" ? "outbound" : callType === "webCall" ? "web" : "unknown",
    customerNumber: str(customer.number),
    status: str(message.status),
    endedReason: str(message.endedReason) || str(call.endedReason),
    transcript: (str(artifact.transcript) || str(message.transcript)).slice(0, 12_000),
    summary: str(analysis.summary).slice(0, 2000),
    durationSeconds:
      typeof message.durationSeconds === "number"
        ? message.durationSeconds
        : Number.isFinite(started) && Number.isFinite(ended)
          ? Math.round((ended - started) / 1000)
          : null,
    recordingUrl: str(recording.stereoUrl) || str(message.recordingUrl) || str(artifact.recordingUrl),
    toolCalls: toolList.map((row) => {
      const fn = (row.function || {}) as Record<string, unknown>;
      return { id: str(row.id), name: str(fn.name), args: parseArgs(fn.arguments) };
    }),
  };
}

const MISSED = /did-not-answer|customer-busy|no-answer|voicemail|failed-to-connect|sip-.*(?:failed|busy)|silence-timed-out|pipeline-no-available/i;

/** A call the business should call back: unanswered/failed, or ended with no caller speech at all. */
export function isMissedCall(m: Pick<VapiMessage, "endedReason" | "transcript" | "direction">) {
  if (MISSED.test(m.endedReason)) return true;
  const callerSpoke = /\b(user|customer|caller)\s*:/i.test(m.transcript);
  return m.direction === "inbound" && !callerSpoke;
}

export const ENQUIRY_TYPES = ["wholesale", "bulk", "oem", "callback", "other"] as const;

/** What the caller hears when a tool cannot run. Never implies the enquiry was saved. */
export const TOOL_FAILURE_SPOKEN = {
  lookup_product: "I'm sorry, I'm having trouble accessing the product information right now, and I don't want to give you incorrect details. Would you like me to arrange a callback from our team?",
  record_enquiry: "I'm sorry, I wasn't able to save your details just now. Please email our team or call us again later, and we'll be happy to help.",
} as const;

/** Tool results returned to the model when a handler throws: honest, and never claims a save. */
export const TOOL_FAILURE_RESULT: Record<string, string> = {
  lookup_product: "The catalogue lookup failed. Say you can't access product information right now, give no product details, and offer a callback from the team.",
  record_enquiry: "The enquiry was NOT saved because of a system error. Tell the caller their details could not be saved and suggest they email the team or call again later. Do not say the team will follow up.",
};

/**
 * Consent gate for `record_enquiry`: only an explicit `true` saves. Silence, "maybe", a string or a missing flag
 * does not. Pure, so /test covers it.
 */
export function enquiryDecision(args: Record<string, unknown>) {
  if (args.consentToContact !== true) {
    return {
      save: false as const,
      result: "Not saved: the caller has not clearly agreed to be contacted. Do not say the enquiry was saved. Tell them they can email the team or call again whenever they are ready.",
    };
  }
  const enquiryType = (ENQUIRY_TYPES as readonly string[]).includes(String(args.enquiryType)) ? String(args.enquiryType) : "other";
  const notes = [`${enquiryType} enquiry`, args.product, args.quantity ? `${args.quantity} units` : "", args.timeline, args.notes]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .join(". ")
    .slice(0, 1000);
  return { save: true as const, enquiryType, notes };
}

/** The assistant configuration this site expects in Vapi. Gemini model, grounded tools, our webhook. */
export function desiredAssistant(origin: string, secret = env("VAPI_WEBHOOK_SECRET")) {
  const url = `${origin.replace(/\/$/, "")}/api/ai/voice/webhook`;
  const server = { url, ...(secret ? { headers: { "x-vapi-secret": secret } } : {}) };
  return {
    name: VAPI_ASSISTANT_NAME,
    firstMessage: "Hello, thank you for calling Marina Muse International. How can I help you today?",
    /** Vapi's own voice: no separate provider key; billed only as part of call minutes. */
    voice: { provider: "vapi", voiceId: "Emma" },
    model: {
      provider: "google",
      model: env("VAPI_MODEL") || geminiModel(),
      temperature: 0.3,
      messages: [{ role: "system", content: agentInstructions("voice") }],
      tools: [
        {
          type: "function",
          function: {
            name: "lookup_product",
            description: "Look up verified price, stock, material and wholesale minimum order for products. Always call before stating a price or stock.",
            parameters: {
              type: "object",
              properties: { query: { type: "string", description: "Product name, type or SKU the caller asked about" } },
              required: ["query"],
            },
          },
          // Spoken by Vapi when our server cannot answer (timeout, non-2xx).
          messages: [{ type: "request-failed", content: TOOL_FAILURE_SPOKEN.lookup_product }],
          server,
        },
        {
          type: "function",
          function: {
            name: "record_enquiry",
            description: "Save the caller's enquiry for the sales team: wholesale, bulk, OEM or a callback request.",
            parameters: {
              type: "object",
              properties: {
                enquiryType: { type: "string", enum: [...ENQUIRY_TYPES] },
                name: { type: "string" },
                company: { type: "string" },
                email: { type: "string" },
                quantity: { type: "number" },
                product: { type: "string" },
                timeline: { type: "string" },
                notes: { type: "string" },
                consentToContact: {
                  type: "boolean",
                  description: "True only if the caller clearly said yes to being contacted by phone, email or WhatsApp. Without it nothing is saved.",
                },
              },
              required: ["notes", "consentToContact"],
            },
          },
          messages: [{ type: "request-failed", content: TOOL_FAILURE_SPOKEN.record_enquiry }],
          server,
        },
      ],
    },
    server,
    serverMessages: ["end-of-call-report", "status-update", "tool-calls", "hang"],
    endCallPhrases: ["goodbye", "bye bye"],
  };
}

type AssistantShape = {
  id?: string;
  name?: string;
  model?: { provider?: string; model?: string; tools?: { function?: { name?: string } }[]; toolIds?: string[] };
  server?: { url?: string };
  serverUrl?: string;
};

/** Differences between the live assistant and `desiredAssistant`. Empty means correctly configured. */
export function assistantDrift(actual: AssistantShape, desired: ReturnType<typeof desiredAssistant>): string[] {
  const issues: string[] = [];
  if (actual.model?.provider !== "google") issues.push(`Model provider is "${actual.model?.provider || "none"}", expected "google" (Gemini)`);
  else if (actual.model?.model !== desired.model.model) issues.push(`Model is "${actual.model?.model}", expected "${desired.model.model}"`);
  const url = actual.server?.url || actual.serverUrl || "";
  if (url !== desired.server.url) issues.push(`Server URL is "${url || "not set"}", expected "${desired.server.url}"`);
  const tools = new Set((actual.model?.tools || []).map((tool) => tool.function?.name));
  const missing = VAPI_TOOLS.filter((name) => !tools.has(name));
  if (missing.length) issues.push(`Missing tools: ${missing.join(", ")}`);
  return issues;
}

function vapiHeaders() {
  return { Authorization: `Bearer ${env("VAPI_API_KEY")}`, "Content-Type": "application/json" };
}

export async function vapiGet<T>(path: string) {
  return requestJson<T>(`${vapiBase()}${path}`, { headers: vapiHeaders(), timeoutMs: 10_000, secrets: [env("VAPI_API_KEY")] });
}

export async function getAssistant() {
  return vapiGet<AssistantShape>(`/assistant/${encodeURIComponent(env("VAPI_ASSISTANT_ID"))}`);
}

/** Admin action: writes `desiredAssistant` to the Vapi assistant. Never called by /test. */
export async function syncAssistant(origin: string) {
  const problem = (["VAPI_API_KEY", "VAPI_ASSISTANT_ID", "VAPI_WEBHOOK_SECRET"] as const)
    .map((name) => [name, vapiValueProblem(name)] as const)
    .find(([, issue]) => issue);
  if (problem) return { ok: false as const, error: `${problem[0]} ${problem[1]}.` };
  const res = await requestJson<AssistantShape>(`${vapiBase()}/assistant/${encodeURIComponent(env("VAPI_ASSISTANT_ID"))}`, {
    method: "PATCH",
    headers: vapiHeaders(),
    body: JSON.stringify(desiredAssistant(origin)),
    timeoutMs: 15_000,
    retries: 0,
    secrets: [env("VAPI_API_KEY"), env("VAPI_WEBHOOK_SECRET")],
  });
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error || "Vapi rejected the update." };
}

/**
 * Admin/one-off action: creates a NEW assistant from `desiredAssistant`. Never called by /test.
 * No retry (a retried POST could create a duplicate), and refuses if an assistant with the same name exists.
 */
export async function createAssistant(origin: string) {
  const problem = (["VAPI_API_KEY", "VAPI_WEBHOOK_SECRET"] as const).map((name) => [name, vapiValueProblem(name)] as const).find(([, issue]) => issue);
  if (problem) return { ok: false as const, error: `${problem[0]} ${problem[1]}.` };
  const existing = await vapiGet<AssistantShape[]>("/assistant?limit=100");
  if (!existing.ok) return { ok: false as const, error: existing.error || "Could not list assistants." };
  const clash = (existing.data || []).find((a) => a.name === VAPI_ASSISTANT_NAME);
  if (clash) return { ok: false as const, error: `An assistant named "${VAPI_ASSISTANT_NAME}" already exists (…${String(clash.id).slice(-4)}). Use it instead of creating another.` };
  const res = await requestJson<AssistantShape>(`${vapiBase()}/assistant`, {
    method: "POST",
    headers: vapiHeaders(),
    body: JSON.stringify(desiredAssistant(origin)),
    timeoutMs: 20_000,
    retries: 0,
    secrets: [env("VAPI_API_KEY"), env("VAPI_WEBHOOK_SECRET")],
  });
  return res.ok && res.data?.id ? { ok: true as const, id: res.data.id, assistant: res.data } : { ok: false as const, error: res.error || "Vapi did not return an assistant id." };
}

export function e164(number: string) {
  const digits = number.replace(/[^\d+]/g, "");
  const normal = digits.startsWith("+") ? digits : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(normal) ? normal : null;
}

/** Billable. Only from an admin action, with consent already checked by the caller. */
export async function startOutboundCall(input: { number: string; leadId?: string }) {
  const status = vapiStatus();
  if (!status.outboundEnabled) {
    return { ok: false as const, error: "Outbound calling is off. Set VAPI_OUTBOUND_ENABLED=true with VAPI_API_KEY, VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID." };
  }
  const number = e164(input.number);
  if (!number) return { ok: false as const, error: "The phone number is not a valid international (E.164) number." };
  const res = await requestJson<{ id?: string; status?: string }>(`${vapiBase()}/call`, {
    method: "POST",
    headers: vapiHeaders(),
    body: JSON.stringify({
      assistantId: env("VAPI_ASSISTANT_ID"),
      phoneNumberId: env("VAPI_PHONE_NUMBER_ID"),
      customer: { number },
      metadata: input.leadId ? { leadId: input.leadId } : undefined,
    }),
    timeoutMs: 15_000,
    retries: 0,
    secrets: [env("VAPI_API_KEY")],
  });
  return res.ok ? { ok: true as const, callId: res.data?.id || "", status: res.data?.status || "queued" } : { ok: false as const, error: res.error || "Vapi did not start the call." };
}
