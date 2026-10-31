/**
 * Google Gemini API (generativelanguage.googleapis.com) — the one LLM for all four Marina agents.
 * Authenticates with a Gemini API key from Google AI Studio / Cloud (GEMINI_API_KEY), never a consumer subscription.
 */
import { env, requestJson } from "./http.ts";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function geminiModel() {
  const model = env("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
  return /^[a-z0-9.-]{3,60}$/i.test(model) ? model : DEFAULT_GEMINI_MODEL;
}

export function geminiConfigured() {
  return Boolean(env("GEMINI_API_KEY"));
}

export type GeminiTurn = { role: "user" | "model"; text: string };

export type GeminiResult = {
  ok: boolean;
  text: string;
  error?: string;
  status: number;
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

export async function generate(input: {
  system: string;
  turns: GeminiTurn[];
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  /** Gemini's built-in Google Search grounding (growth research only). */
  googleSearch?: boolean;
  timeoutMs?: number;
}): Promise<GeminiResult> {
  const key = env("GEMINI_API_KEY");
  if (!key) return { ok: false, text: "", status: 0, error: "GEMINI_API_KEY is not set.", sources: [] };
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
  const res = await requestJson<GenerateResponse>(`${BASE}/models/${geminiModel()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    timeoutMs: input.timeoutMs ?? 20_000,
    retries: 1,
    secrets: [key],
  });
  if (!res.ok || !res.data) return { ok: false, text: "", status: res.status, error: res.error || "No response", sources: [] };
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
    const reason = res.data.promptFeedback?.blockReason || candidate?.finishReason || "empty";
    return { ok: false, text: "", status: res.status, error: `Gemini returned no text (${reason}).`, finishReason: candidate?.finishReason, sources };
  }
  return { ok: true, text, status: res.status, finishReason: candidate?.finishReason, sources };
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

/** /test check: key accepted (model lookup) and a real one-word generation. No customer data is sent. */
export async function pingGemini() {
  const key = env("GEMINI_API_KEY");
  if (!key) return { configured: false as const };
  const model = geminiModel();
  const lookup = await requestJson<{ name?: string; displayName?: string }>(`${BASE}/models/${model}`, {
    headers: { "x-goog-api-key": key },
    timeoutMs: 10_000,
    secrets: [key],
  });
  if (!lookup.ok) {
    return { configured: true as const, auth: false, model, authDetail: lookup.error || "Lookup failed", generation: null };
  }
  const started = Date.now();
  const gen = await generate({
    system: "You are a connectivity check. Reply with exactly the word OK.",
    turns: [{ role: "user", text: "Health check" }],
    temperature: 0,
    maxOutputTokens: 512,
    timeoutMs: 20_000,
  });
  return {
    configured: true as const,
    auth: true,
    model,
    authDetail: `Model ${lookup.data?.displayName || model} is available to this key.`,
    generation: { ok: gen.ok, ms: Date.now() - started, detail: gen.ok ? `Replied "${gen.text.slice(0, 20)}"` : gen.error || "failed" },
  };
}
