/**
 * Google Analytics 4 for Agent 3: Data API reports (service account, read-only) and
 * Measurement Protocol purchase events for server-side conversion tracking.
 */
import { createHash } from "crypto";
import { env, requestJson } from "../ai/http.ts";
import { googleAccessToken, SCOPES, serviceAccount, serviceAccountEmail } from "./auth.ts";

export function ga4PropertyId() {
  const id = env("GA4_PROPERTY_ID").replace(/^properties\//, "");
  return /^\d{4,15}$/.test(id) ? id : "";
}

export function ga4Configured() {
  return Boolean(serviceAccount() && ga4PropertyId());
}

type RunReportResponse = {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  rowCount?: number;
};

export type Ga4Row = Record<string, string | number>;

export async function runReport(input: { days: number; dimensions: string[]; metrics: string[]; limit?: number; orderByMetric?: string }) {
  const auth = await googleAccessToken(SCOPES.analytics);
  if (!auth.ok) return { ok: false as const, error: auth.error, status: 0 };
  const res = await requestJson<RunReportResponse>(`https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId()}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${input.days}daysAgo`, endDate: "today" }],
      dimensions: input.dimensions.map((name) => ({ name })),
      metrics: input.metrics.map((name) => ({ name })),
      limit: input.limit ?? 25,
      ...(input.orderByMetric ? { orderBys: [{ metric: { metricName: input.orderByMetric }, desc: true }] } : {}),
    }),
    timeoutMs: 15_000,
  });
  if (!res.ok) return { ok: false as const, error: res.error || "GA4 report failed", status: res.status };
  const rows: Ga4Row[] = (res.data?.rows || []).map((row) => {
    const out: Ga4Row = {};
    input.dimensions.forEach((name, i) => (out[name] = row.dimensionValues?.[i]?.value ?? ""));
    input.metrics.forEach((name, i) => (out[name] = Number(row.metricValues?.[i]?.value ?? 0)));
    return out;
  });
  return { ok: true as const, rows, rowCount: res.data?.rowCount ?? rows.length };
}

/** Channels, landing pages and totals for the growth report. Null fields when GA4 is not configured or fails. */
export async function ga4Summary(days = 28) {
  if (!ga4Configured()) return { configured: false as const };
  const metrics = ["sessions", "totalUsers", "keyEvents", "ecommercePurchases", "purchaseRevenue"];
  const [channels, landing] = await Promise.all([
    runReport({ days, dimensions: ["sessionDefaultChannelGroup"], metrics, orderByMetric: "sessions", limit: 15 }),
    runReport({ days, dimensions: ["landingPage"], metrics: ["sessions", "engagementRate", "keyEvents", "purchaseRevenue"], orderByMetric: "sessions", limit: 25 }),
  ]);
  if (!channels.ok) return { configured: true as const, ok: false as const, error: channels.error };
  return {
    configured: true as const,
    ok: true as const,
    days,
    channels: channels.rows,
    landingPages: landing.ok ? landing.rows : [],
    totals: metrics.reduce<Record<string, number>>((acc, metric) => {
      acc[metric] = channels.rows.reduce((sum, row) => sum + Number(row[metric] || 0), 0);
      return acc;
    }, {}),
  };
}

/** /test: service-account token, property access, and a real 7-day sessions query. */
export async function pingGa4() {
  if (!serviceAccount() || !ga4PropertyId()) {
    return { configured: false as const, partial: Boolean(serviceAccount() || env("GA4_PROPERTY_ID")) };
  }
  const auth = await googleAccessToken(SCOPES.analytics);
  if (!auth.ok) return { configured: true as const, auth: false, detail: auth.error };
  const report = await runReport({ days: 7, dimensions: [], metrics: ["sessions"], limit: 1 });
  if (!report.ok) {
    const denied = report.status === 403;
    return {
      configured: true as const,
      auth: true,
      data: false,
      detail: denied
        ? `Token issued, but the service account cannot read property ${ga4PropertyId()}. In GA4 → Admin → Property access management, add ${serviceAccountEmail()} as Viewer. (${report.error})`
        : report.error,
    };
  }
  const sessions = Number(report.rows[0]?.sessions ?? 0);
  return { configured: true as const, auth: true, data: true, detail: `Read ${sessions} session(s) for the last 7 days from property ${ga4PropertyId()}.` };
}

export function measurementProtocolConfigured() {
  return /^G-[A-Z0-9]{4,15}$/.test(env("GA4_MEASUREMENT_ID")) && Boolean(env("GA4_API_SECRET"));
}

function mpUrl(debug: boolean) {
  const q = new URLSearchParams({ measurement_id: env("GA4_MEASUREMENT_ID"), api_secret: env("GA4_API_SECRET") });
  return `https://www.google-analytics.com/${debug ? "debug/" : ""}mp/collect?${q}`;
}

/** Pseudonymous client id: no email or name is sent to Google. */
export function mpClientId(seed: string) {
  const hash = createHash("sha256").update(seed).digest();
  return `${hash.readUInt32BE(0)}.${hash.readUInt32BE(4)}`;
}

export function purchaseEvent(order: { id: string; amount: number; currency: string; sessionId?: string; items: { slug: string; name: string; qty: number; unitPrice: number }[] }) {
  return {
    client_id: mpClientId(order.sessionId || order.id),
    non_personalized_ads: true,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: order.id,
          value: Number(order.amount.toFixed(2)),
          currency: order.currency,
          items: order.items.map((item) => ({ item_id: item.slug, item_name: item.name, quantity: item.qty, price: item.unitPrice })),
        },
      },
    ],
  };
}

/** Server-side purchase conversion. GA4 de-duplicates on transaction_id. */
export async function sendPurchase(order: Parameters<typeof purchaseEvent>[0]) {
  if (!measurementProtocolConfigured()) return { sent: false as const, reason: "not configured" };
  const res = await requestJson(mpUrl(false), { method: "POST", body: JSON.stringify(purchaseEvent(order)), timeoutMs: 8_000, secrets: [env("GA4_API_SECRET")] });
  return res.ok || res.status === 204 ? { sent: true as const } : { sent: false as const, reason: res.error || "failed" };
}

/** /test: validates a sample event against GA4's debug endpoint. Nothing is recorded in reports. */
export async function validateMeasurementProtocol() {
  if (!measurementProtocolConfigured()) return { configured: false as const };
  const sample = purchaseEvent({ id: "healthcheck", amount: 1, currency: "USD", items: [{ slug: "healthcheck", name: "Health check", qty: 1, unitPrice: 1 }] });
  const res = await requestJson<{ validationMessages?: { description?: string }[] }>(mpUrl(true), {
    method: "POST",
    body: JSON.stringify(sample),
    timeoutMs: 8_000,
    secrets: [env("GA4_API_SECRET")],
  });
  const problems = (res.data?.validationMessages || []).map((m) => m.description || "").filter(Boolean);
  return { configured: true as const, ok: res.ok && !problems.length, detail: res.ok ? (problems.length ? problems.join("; ") : "Sample purchase event is valid (debug endpoint, not recorded).") : res.error || "failed" };
}
