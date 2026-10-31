/** Voice languages and call intelligence. Pure, no I/O. */

/** Target-market languages from the blueprint. Only the ones set in VOICE_LANGUAGES are offered. */
export const TARGET_VOICE_LANGUAGES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  ar: "Arabic",
  tr: "Turkish",
  hi: "Hindi",
  ur: "Urdu",
};

/** VOICE_LANGUAGES="en,de,fr". Unknown codes are dropped; empty means English only. */
export function parseVoiceLanguages(raw?: string | null): string[] {
  const codes = (raw || "")
    .split(",")
    .map((code) => code.trim().toLowerCase().slice(0, 2))
    .filter((code) => code in TARGET_VOICE_LANGUAGES);
  return codes.length ? [...new Set(codes)] : ["en"];
}

/** Never promise a language the configured provider does not support. */
export function voiceLanguageSupported(requested: string | undefined, configured: string[]): boolean {
  if (!requested) return true;
  return configured.includes(requested.trim().toLowerCase().slice(0, 2));
}

export type CallSummary = {
  buyingIntent: boolean;
  urgency: boolean;
  quantity: number;
  budgetUsd: number | null;
  objections: string[];
  questions: string[];
  summary: string;
};

const OBJECTIONS: [RegExp, string][] = [
  [/\b(too expensive|price is high|too costly|cheaper|over (my|our) budget)\b/i, "Price"],
  [/\b(shipping (is|cost)|delivery (cost|charge)|customs|duties)\b/i, "Shipping / customs cost"],
  [/\b(too long|takes too long|delivery time|lead time)\b/i, "Delivery time"],
  [/\b(not sure|think about it|maybe later|call (me )?back later)\b/i, "Undecided"],
  [/\b(quality|genuine|real brass|authentic)\b/i, "Quality / authenticity"],
];

export function summarizeCall(transcript: string): CallSummary {
  const text = transcript.replace(/\s+/g, " ").trim();
  const qty = /\b(\d{1,6})\s*(units?|pcs|pieces|sets|qty)\b/i.exec(text);
  const budget = /\$\s?([\d,]+(?:\.\d+)?)|\bbudget\s+(?:of\s+|is\s+)?(?:usd\s*)?([\d,]+)/i.exec(text);
  const budgetUsd = budget ? Number((budget[1] || budget[2]).replace(/,/g, "")) : null;
  const questions = (text.match(/[^?.!]+\?/g) || []).map((q) => q.trim()).slice(0, 5);
  const objections = OBJECTIONS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  const buyingIntent = /\b(buy|order|purchase|quote|price|need|want)\b/i.test(text);
  const urgency = /\b(today|this week|asap|urgent(?:ly)?|immediately|tomorrow)\b/i.test(text);
  const parts = [
    buyingIntent ? "Buying intent" : "No clear buying intent",
    qty ? `quantity ${qty[1]}` : null,
    budgetUsd ? `budget about $${budgetUsd.toLocaleString("en-US")}` : null,
    urgency ? "urgent" : null,
    objections.length ? `objections: ${objections.join(", ")}` : null,
    questions.length ? `${questions.length} open question(s)` : null,
  ].filter(Boolean);
  return {
    buyingIntent,
    urgency,
    quantity: qty ? Number(qty[1]) : 0,
    budgetUsd: budgetUsd && Number.isFinite(budgetUsd) ? budgetUsd : null,
    objections,
    questions,
    summary: `${parts.join("; ")}.`,
  };
}

export type CallInsight = {
  summary: string;
  segment: "b2c" | "wholesale" | "b2b" | "bulk" | "oem";
  buyingIntent: boolean;
  quantity: number;
  products: string[];
  objections: string[];
  questions: string[];
  callbackRequested: boolean;
  consentToContact: boolean;
};

const SEGMENTS = ["b2c", "wholesale", "b2b", "bulk", "oem"] as const;

/**
 * Accepts Gemini's structured call analysis only where the transcript supports it:
 * a quantity the caller never said is dropped, and text fields are trimmed.
 */
export function validateCallInsight(raw: unknown, transcript: string): CallInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const summary = typeof r.summary === "string" ? r.summary.trim().slice(0, 800) : "";
  if (!summary) return null;
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim().slice(0, 160)).slice(0, 6) : [];
  const qty = Number(r.quantity);
  const said = Number.isFinite(qty) && qty > 0 && new RegExp(`(^|\\D)${Math.round(qty)}(\\D|$)`).test(transcript.replace(/,/g, ""));
  return {
    summary,
    segment: SEGMENTS.includes(r.segment as CallInsight["segment"]) ? (r.segment as CallInsight["segment"]) : "b2c",
    buyingIntent: r.buyingIntent === true,
    quantity: said ? Math.round(qty) : 0,
    products: list(r.products),
    objections: list(r.objections),
    questions: list(r.questions),
    callbackRequested: r.callbackRequested === true,
    consentToContact: r.consentToContact === true,
  };
}
