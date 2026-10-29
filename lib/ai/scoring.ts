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
  if (signals.estimatedValueUsd >= 2000) {
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
const SOON = /\b(today|this week|asap|urgent|immediately)\b/i;
const BUY = /\b(buy|order|price|quote|need|want|purchase)\b/i;

export function signalsFromText(text: string, messages: number, unitPrice = 0): LeadSignals {
  const qtyMatch = text.match(/\b(\d{1,6})\b/);
  const quantity = qtyMatch ? Number(qtyMatch[1]) : 0;
  const wholesale = WHOLESALE.test(text);
  const estimatedValueUsd = quantity > 0 && unitPrice > 0 ? quantity * unitPrice : 0;
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
