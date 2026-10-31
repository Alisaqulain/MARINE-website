export type TouchSource =
  | "organic_search"
  | "geo_aeo"
  | "google_shopping"
  | "paid"
  | "social"
  | "direct"
  | "referral"
  | "chat"
  | "voice"
  | "unknown";

export type Touch = {
  source: TouchSource;
  at: string;
  campaign?: string;
  landingPath?: string;
  referrer?: string;
};

const SEARCH = /(google|bing|duckduckgo|yahoo)\./i;
const SOCIAL = /(facebook|instagram|tiktok|linkedin|pinterest|t\.co|twitter|x\.com)/i;
const AI_REF = /(chatgpt|perplexity|gemini|copilot|claude)/i;

export function sourceFromVisit(input: { referrer?: string; utmSource?: string; utmMedium?: string }): TouchSource {
  const medium = (input.utmMedium || "").toLowerCase();
  const source = (input.utmSource || "").toLowerCase();
  const ref = input.referrer || "";
  if (medium === "cpc" || medium === "paid" || source === "google_shopping") {
    return source.includes("shopping") ? "google_shopping" : "paid";
  }
  if (AI_REF.test(ref) || AI_REF.test(source)) return "geo_aeo";
  if (SOCIAL.test(ref) || SOCIAL.test(source) || medium === "social") return "social";
  if (SEARCH.test(ref) || medium === "organic") return "organic_search";
  if (ref && !/marinamuseinternational|localhost|127\.0\.0\.1/i.test(ref)) return "referral";
  if (!ref && !source) return "direct";
  return source ? "referral" : "direct";
}

/** Last non-direct touch. Direct-only journeys stay direct. */
export function lastNonDirect(touches: Touch[]): Touch | null {
  const ordered = [...touches].sort((a, b) => a.at.localeCompare(b.at));
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i].source !== "direct") return ordered[i];
  }
  return ordered[ordered.length - 1] ?? null;
}

export function revenueBySource(
  orders: { id: string; amount: number; status: string; source: TouchSource | null }[]
) {
  const map = new Map<string, { orders: number; revenue: number }>();
  const seen = new Set<string>();
  for (const order of orders) {
    if (order.status === "failed" || order.status === "cancelled" || order.status === "refunded") continue;
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    const key = order.source || "unknown";
    const row = map.get(key) ?? { orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += order.status === "paid" ? order.amount : 0;
    map.set(key, row);
  }
  return [...map.entries()].map(([source, row]) => ({
    source,
    orders: row.orders,
    revenue: Number(row.revenue.toFixed(2)),
  }));
}

function rate(part: number, whole: number) {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : null;
}

/** Visitor → enquiry → lead → order, as percentages (null when there is nothing to divide by). */
export function conversionFunnel(counts: { visitors: number; enquiries: number; leads: number; orders: number }) {
  return {
    ...counts,
    visitorToEnquiry: rate(counts.enquiries, counts.visitors),
    enquiryToLead: rate(counts.leads, counts.enquiries),
    leadToOrder: rate(counts.orders, counts.leads),
    visitorToOrder: rate(counts.orders, counts.visitors),
  };
}

export function averageOrderValue(revenue: number, orders: number) {
  return orders > 0 ? Number((revenue / orders).toFixed(2)) : null;
}

/** Which products bring in paid revenue. Unpaid, failed and duplicate orders are skipped. */
export function productAttribution(
  orders: { id: string; status: string; items: { slug: string; name: string; qty: number; unitPrice: number }[] }[],
  limit = 10
) {
  const seen = new Set<string>();
  const map = new Map<string, { slug: string; name: string; units: number; revenue: number; orders: number }>();
  for (const order of orders) {
    if (order.status !== "paid" || seen.has(order.id)) continue;
    seen.add(order.id);
    for (const item of order.items) {
      const row = map.get(item.slug) ?? { slug: item.slug, name: item.name, units: 0, revenue: 0, orders: 0 };
      row.units += item.qty;
      row.revenue += item.qty * item.unitPrice;
      row.orders += 1;
      map.set(item.slug, row);
    }
  }
  return [...map.values()]
    .map((row) => ({ ...row, revenue: Number(row.revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
