export type LeadStage = "cold" | "warm" | "hot" | "high-value";

export type LeadSignals = {
  purchaseIntent: boolean;
  quantity: number;
  estimatedValueUsd: number;
  wholesale: boolean;
  customManufacturing: boolean;
  timeframeSoon: boolean;
  messages: number;
};

export type ScoreResult = {
  score: number;
  stage: LeadStage;
  factors: string[];
};

export function classifyLead(score: number): LeadStage {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  if (value >= 81) return "high-value";
  if (value >= 61) return "hot";
  if (value >= 31) return "warm";
  return "cold";
}

/** Transparent points. The total is capped at 100. */
export function scoreLead(signals: LeadSignals): ScoreResult {
  const factors: string[] = [];
  let score = 0;
  if (signals.purchaseIntent) {
    score += 15;
    factors.push("Purchase intent +15");
  }
  if (signals.quantity >= 50) {
    score += 25;
    factors.push("Quantity 50 or more +25");
  } else if (signals.quantity >= 10) {
    score += 15;
    factors.push("Quantity 10 or more +15");
  }
  if (signals.estimatedValueUsd >= 10000) {
    score += 35;
    factors.push("Estimated value at least $10,000 +35");
  } else if (signals.estimatedValueUsd >= 2000) {
    score += 25;
    factors.push("Estimated value at least $2,000 +25");
  } else if (signals.estimatedValueUsd >= 500) {
    score += 15;
    factors.push("Estimated value at least $500 +15");
  }
  if (signals.wholesale) {
    score += 15;
    factors.push("Wholesale or business intent +15");
  }
  if (signals.customManufacturing) {
    score += 15;
    factors.push("Custom manufacturing +15");
  }
  if (signals.timeframeSoon) {
    score += 10;
    factors.push("Near-term timeframe +10");
  }
  if (signals.messages >= 4) {
    score += 10;
    factors.push("Ongoing conversation +10");
  }
  score = Math.max(0, Math.min(100, score));
  return { score, stage: classifyLead(score), factors };
}

const WHOLESALE = /\b(wholesale|bulk|b2b|oem|trade|company|logo|engraving)\b/i;
const CUSTOM = /\b(custom|manufactur|oem|engrav)/i;
const SOON = /\b(today|this week|asap|urgent(?:ly)?|immediately|tomorrow)\b/i;
const BUY = /\b(buy|order|price|quote|need|want|purchase)\b/i;

const MONEY = /\$\s?([\d,]+(?:\.\d+)?)|\b([\d,]+(?:\.\d+)?)\s*(?:usd|dollars)\b/gi;

/** Largest money amount the customer stated, e.g. "$18,500" or "2000 USD". */
export function statedValueUsd(text: string): number {
  let best = 0;
  for (const match of text.matchAll(MONEY)) {
    const n = Number((match[1] || match[2] || "").replace(/,/g, ""));
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

/** "25 units" wins; otherwise the first plain number that is not a money amount. */
export function quantityFromText(text: string): number {
  const units = /\b(\d{1,6})\s*(?:units?|pcs|pieces|sets|nos|qty)\b/i.exec(text);
  if (units) return Number(units[1]);
  const plain = /\b(\d{1,6})\b/.exec(text.replace(MONEY, " "));
  return plain ? Number(plain[1]) : 0;
}

export type ContactDetails = { name?: string; email?: string; phone?: string; company?: string };

/** Contact details the customer typed into the chat. Only what is clearly written is kept. */
export function contactFromText(text: string): ContactDetails {
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text)?.[0];
  const phone = /\+?\d[\d\s()-]{7,}\d/.exec(text)?.[0]?.replace(/[^\d+]/g, "");
  const name = /\bmy name is ([a-z][a-z' -]{1,40}?)(?=[,.!]|\s+(?:and|from|at|i)\b|$)/i.exec(text)?.[1]?.trim();
  const company = /\b(?:company|business|firm) (?:is|name is|called) ([\w&' .-]{2,60}?)(?=[,.!]|$)/i.exec(text)?.[1]?.trim();
  return {
    ...(name ? { name } : {}),
    ...(email ? { email: email.toLowerCase() } : {}),
    ...(phone && phone.replace(/\D/g, "").length >= 8 ? { phone } : {}),
    ...(company ? { company } : {}),
  };
}

export type LeadSegment = "b2c" | "wholesale" | "b2b" | "bulk" | "oem";

/** Most specific segment the customer's own words support. OEM > B2B > wholesale > bulk > B2C. */
export function leadSegment(text: string, quantity = quantityFromText(text)): LeadSegment {
  if (/\b(oem|private label|white label|custom(?:ised|ized)? (?:design|manufactur)|manufactur(?:e|ing) for us|our (?:own )?(?:logo|brand))\b/i.test(text)) return "oem";
  if (/\b(b2b|company|corporate|business|hotel|restaurant|resort|office|interior designer|gifting)\b/i.test(text)) return "b2b";
  if (/\b(wholesale|reseller|retailer|distributor|stockist|trade price)\b/i.test(text)) return "wholesale";
  if (/\bbulk\b/i.test(text) || quantity >= 10) return "bulk";
  return "b2c";
}

export function signalsFromText(text: string, messages: number, unitPrice = 0): LeadSignals {
  const quantity = quantityFromText(text);
  const wholesale = WHOLESALE.test(text);
  const estimatedValueUsd = Math.max(quantity > 0 && unitPrice > 0 ? quantity * unitPrice : 0, statedValueUsd(text));
  return {
    purchaseIntent: BUY.test(text),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    estimatedValueUsd,
    wholesale,
    customManufacturing: CUSTOM.test(text),
    timeframeSoon: SOON.test(text),
    messages,
  };
}
