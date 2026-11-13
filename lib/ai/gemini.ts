/**
 * Google Gemini API (generativelanguage.googleapis.com) — the one LLM for all four Marina agents.
 * Authenticates with a Gemini API key from Google AI Studio / Cloud (GEMINI_API_KEY), never a consumer subscription.
 * Keys come in two formats: the classic `AIza…` (39 chars) and the newer `AQ.…` — both go in the x-goog-api-key header.
 *
 * Models are tried in order: GEMINI_MODEL, then GEMINI_FALLBACK_MODEL (comma-separated, or the default fallback).
 * A timeout, overload (500/503), an unknown/retired model (404) or a long quota wait (429) moves on to the next model;
 * a rejected key (400 API_KEY_INVALID / 401 / 403) stops, because every model would fail the same way.
 */
import { classifyHttp, env, requestJson, type FailureClass, type HttpResult } from "./http.ts";

/** Verified 2026-11-08 with this project's key: answers in ~1 s. gemini-2.5-flash now returns 404 for new API users. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_ID = /^[a-z0-9.-]{3,60}$/i;

export function geminiModel() {
  const model = env("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
  return MODEL_ID.test(model) ? model : DEFAULT_GEMINI_MODEL;
}

/** The configured model first, then the fallbacks, without duplicates. */
export function geminiModels(source: Record<string, string | undefined> = process.env) {
  const read = (name: string) => source[name]?.trim() || "";
  const primary = MODEL_ID.test(read("GEMINI_MODEL")) ? read("GEMINI_MODEL") : DEFAULT_GEMINI_MODEL;
  const configured = read("GEMINI_FALLBACK_MODEL")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => MODEL_ID.test(m));
  const fallbacks = configured.length ? configured : [DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_FALLBACK_MODEL];
  return [...new Set([primary, ...fallbacks])];
}

export function geminiConfigured() {
  return Boolean(env("GEMINI_API_KEY"));
}

export type GeminiTurn = { role: "user" | "model"; text: string };

export type GeminiAttempt = { model: string; status: number; ms: number; failure?: FailureClass; error?: string };

export type GeminiResult = {
  ok: boolean;
  text: string;
  error?: string;
  status: number;
  /** The model that answered (or the last one tried). */
  model?: string;
  /** Every model call made, in order — shows whether the fallback ran. */
  attempts: GeminiAttempt[];
  failure?: FailureClass;
  finishReason?: string;
  /** Web sources when Google Search grounding was used. */
  sources: { title: string; uri: string }[];
};

type GenerateResponse = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
  }[];
  promptFeedback?: { blockReason?: string };
};

type GeminiError = { error?: { status?: string; message?: string; details?: { reason?: string }[] } };

/** Classifies a failed Gemini call. A bad key is reported by Google as 400 INVALID_ARGUMENT + API_KEY_INVALID. */
export function geminiFailure(res: Pick<HttpResult<unknown>, "status" | "reached" | "data">): FailureClass {
  const err = (res.data as GeminiError | null)?.error;
  const reasons = (err?.details || []).map((d) => d.reason || "");
  if (reasons.some((r) => /API_KEY_INVALID|API_KEY_EXPIRED/.test(r)) || err?.status === "UNAUTHENTICATED") return "auth";
  if (reasons.some((r) => /SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED|BILLING_DISABLED/.test(r))) return "activation";
  if (res.status === 403 && err?.status === "PERMISSION_DENIED") return "restriction";
  return classifyHttp(res);
}

/** Whether the next model in the chain could succeed where this one failed. */
function tryNextModel(failure: FailureClass, status: number) {
  return failure === "temporary" || failure === "quota" || failure === "restriction" || status === 404;
}

/**
 * Quota cooldown: after a 429 whose retry delay is longer than a minute (e.g. the free tier's per-day limit),
 * the model is skipped — no request is sent — until Google says the quota resets. Without this every chat
 * message and every /test load would spend a request just to receive the same 429.
 * Kept on globalThis so it survives module reloads in development.
 */
type Cooldown = { until: number; error: string };
function cooldowns(): Map<string, Cooldown> {
  const g = globalThis as typeof globalThis & { __geminiCooldown?: Map<string, Cooldown> };
  if (!g.__geminiCooldown) g.__geminiCooldown = new Map();
  return g.__geminiCooldown;
}
const COOLDOWN_MIN_MS = 60_000;

export function geminiCooldown(model: string, now = Date.now()) {
  const hit = cooldowns().get(model);
  if (!hit || hit.until <= now) return null;
  return hit;
}

export function clearGeminiCooldowns() {
  cooldowns().clear();
}

export async function generate(input: {
  system: string;
  turns: GeminiTurn[];
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  /** Gemini's built-in Google Search grounding (growth research only). */
  googleSearch?: boolean;
  /** Total time budget across all models (default 30 s). */
  timeoutMs?: number;
  /** Only these models (health checks test each model separately). */
  models?: string[];
}): Promise<GeminiResult> {
  const key = env("GEMINI_API_KEY");
  if (!key) return { ok: false, text: "", status: 0, error: "GEMINI_API_KEY is not set.", attempts: [], failure: "config", sources: [] };
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: input.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    generationConfig: {
      temperature: input.temperature ?? 0.2,
      maxOutputTokens: input.maxOutputTokens ?? 1024,
      ...(input.json ? { responseMimeType: "application/json" } : {}),
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };
  if (input.googleSearch) body.tools = [{ google_search: {} }];

  const models = input.models?.length ? input.models : geminiModels();
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  const attempts: GeminiAttempt[] = [];
  let last: GeminiResult = { ok: false, text: "", status: 0, error: "No model was tried.", attempts, sources: [] };

  for (const [index, model] of models.entries()) {
    const cooling = geminiCooldown(model);
    if (cooling) {
      const error = `Skipped without a request: ${cooling.error} Quota resets ${new Date(cooling.until).toISOString().slice(0, 16).replace("T", " ")} UTC.`;
      attempts.push({ model, status: 429, ms: 0, failure: "quota", error });
      last = { ok: false, text: "", status: 429, error, model, attempts, failure: "quota", sources: [] };
      continue;
    }
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;
    const isLast = index === models.length - 1;
    // Leave time for the fallback: a model followed by another gets at most half the remaining budget (max 15 s).
    const timeoutMs = isLast ? remaining : Math.min(15_000, Math.floor(remaining / 2));
    const started = Date.now();
    const res = await requestJson<GenerateResponse>(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      timeoutMs,
      retries: 1,
      retryTimeouts: false,
      secrets: [key],
    });
    const ms = Date.now() - started;
    if (!res.ok || !res.data) {
      const failure = geminiFailure(res);
      const quotaWait = res.status === 429 && res.retryAfterMs ? ` (quota: retry after ${Math.ceil(res.retryAfterMs / 1000)} s)` : "";
      const error = `${res.error || "No response"}${quotaWait}`;
      if (res.status === 429 && (res.retryAfterMs ?? 0) > COOLDOWN_MIN_MS) {
        cooldowns().set(model, { until: Date.now() + res.retryAfterMs!, error: (res.error || "HTTP 429").slice(0, 200) });
      }
      attempts.push({ model, status: res.status, ms, failure, error });
      last = { ok: false, text: "", status: res.status, error, model, attempts, failure, sources: [] };
      if (!tryNextModel(failure, res.status)) break;
      continue;
    }
    const candidate = res.data.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("")
      .trim();
    const sources = (candidate?.groundingMetadata?.groundingChunks || [])
      .map((chunk) => ({ title: chunk.web?.title || "", uri: chunk.web?.uri || "" }))
      .filter((row) => row.uri);
    if (!text) {
      // A safety block or an empty answer is about the prompt, not the model — another model would not help.
      const reason = res.data.promptFeedback?.blockReason || candidate?.finishReason || "empty";
      const error = `Gemini returned no text (${reason}).`;
      attempts.push({ model, status: res.status, ms, failure: "config", error });
      return { ok: false, text: "", status: res.status, error, model, attempts, failure: "config", finishReason: candidate?.finishReason, sources };
    }
    attempts.push({ model, status: res.status, ms });
    return { ok: true, text, status: res.status, model, attempts, finishReason: candidate?.finishReason, sources };
  }
  if (!attempts.length) last = { ...last, error: "No time left to call Gemini.", failure: "temporary" };
  return last;
}

/** Parses a JSON reply, tolerating a ```json fence. */
export function parseJsonReply<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export type GeminiPing =
  | { configured: false }
  | {
      configured: true;
      /** Key check, independent of any model. */
      auth: { ok: boolean; status: number; failure?: FailureClass; detail: string };
      /** One entry per model in the chain: listed for this key, and a real one-word generation. */
      models: { model: string; role: "primary" | "fallback"; listed: boolean | null; ok: boolean; status: number; ms: number; failure?: FailureClass; detail: string }[];
    };

/**
 * /test check. 1) the key, via models.list (works for any valid key, whatever the model);
 * 2) each model in the chain: models.get + a one-word generation with no customer data.
 * Each model is tested on its own so the dashboard shows whether the fallback really works.
 */
/** /test results are reused for this long so reloading the page does not spend the daily quota. */
export const GEMINI_PING_CACHE_MS = 10 * 60_000;
let pingCache: { at: number; fingerprint: string; value: GeminiPing } | null = null;

export async function pingGemini(options: { force?: boolean } = {}): Promise<GeminiPing & { cachedAt?: string }> {
  const key = env("GEMINI_API_KEY");
  if (!key) return { configured: false };
  const fingerprint = `${key.length}:${key.slice(-6)}:${geminiModels().join(",")}`;
  if (!options.force && pingCache && pingCache.fingerprint === fingerprint && Date.now() - pingCache.at < GEMINI_PING_CACHE_MS) {
    return { ...pingCache.value, cachedAt: new Date(pingCache.at).toISOString() };
  }
  const value = await pingGeminiLive(key);
  pingCache = { at: Date.now(), fingerprint, value };
  return value;
}

async function pingGeminiLive(key: string): Promise<GeminiPing> {
  const list = await requestJson<{ models?: unknown[] }>(`${BASE}/models?pageSize=1`, { headers: { "x-goog-api-key": key }, timeoutMs: 10_000, secrets: [key] });
  const authFailure = list.ok ? undefined : geminiFailure(list);
  const auth = {
    ok: list.ok,
    status: list.status,
    failure: authFailure,
    detail: list.ok
      ? "Google accepted the key (models.list)."
      : authFailure === "auth"
        ? `Google rejected GEMINI_API_KEY (${list.error}). Create a new key in AI Studio → API keys.`
        : authFailure === "activation"
          ? `The key's Google Cloud project cannot use the Gemini API (${list.error}). Enable the Generative Language API for that project.`
          : `Could not verify the key: ${list.error}`,
  };
  if (!list.ok) return { configured: true, auth, models: [] };

  const chain = geminiModels().slice(0, 2);
  const models = [];
  for (const [index, model] of chain.entries()) {
    const cooling = geminiCooldown(model);
    if (cooling) {
      models.push({
        model,
        role: index === 0 ? ("primary" as const) : ("fallback" as const),
        listed: null,
        ok: false,
        status: 429,
        ms: 0,
        failure: "quota" as const,
        detail: `Not called — quota exhausted (${cooling.error}). Resets ${new Date(cooling.until).toISOString().slice(0, 16).replace("T", " ")} UTC.`,
      });
      continue;
    }
    const info = await requestJson<{ name?: string }>(`${BASE}/models/${model}`, { headers: { "x-goog-api-key": key }, timeoutMs: 10_000, secrets: [key] });
    const gen = await generate({
      system: "You are a connectivity check. Reply with exactly the word OK.",
      turns: [{ role: "user", text: "Health check" }],
      temperature: 0,
      maxOutputTokens: 512,
      // A healthy model answers "OK" in 1–5 s; 12 s keeps /test responsive when the primary is overloaded.
      timeoutMs: 12_000,
      models: [model],
    });
    const attempt = gen.attempts[gen.attempts.length - 1];
    const failure = gen.ok ? undefined : gen.failure;
    models.push({
      model,
      role: index === 0 ? ("primary" as const) : ("fallback" as const),
      listed: info.ok ? true : info.status === 404 ? false : null,
      ok: gen.ok,
      status: gen.status,
      ms: attempt?.ms ?? 0,
      failure,
      detail: gen.ok
        ? `Replied "${gen.text.slice(0, 20)}" in ${attempt?.ms ?? 0} ms.`
        : gen.status === 404
          ? `Model not available to this key (${gen.error}). Choose another GEMINI_MODEL.`
          : failure === "temporary"
            ? `${gen.error} — Google did not answer in time or is overloaded; temporary, not a key or quota problem.`
            : failure === "quota"
              ? `${gen.error} — quota on the key's Google project (see AI Studio → Usage / Rate limits).`
              : failure === "restriction"
                ? `${gen.error} — Google refused access for this project.`
              : gen.error || "failed",
    });
  }
  return { configured: true, auth, models };
}
