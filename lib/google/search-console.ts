/**
 * Google Search Console for Agent 3: property access, top queries/pages, and keyword opportunities.
 * Read-only (webmasters.readonly scope).
 */
import { env, requestJson } from "../ai/http.ts";
import { googleAccessToken, SCOPES, serviceAccount, serviceAccountEmail } from "./auth.ts";

/** `sc-domain:example.com` for a domain property or `https://example.com/` for a URL-prefix property. */
export function searchConsoleSite() {
  return env("SEARCH_CONSOLE_SITE_URL");
}

export function searchConsoleConfigured() {
  return Boolean(serviceAccount() && searchConsoleSite());
}

const BASE = "https://www.googleapis.com/webmasters/v3/sites";

export type SearchRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

function isoDay(offset: number) {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

export async function searchAnalytics(input: { days: number; dimensions: ("query" | "page" | "country" | "device")[]; rowLimit?: number }) {
  const auth = await googleAccessToken(SCOPES.searchConsole);
  if (!auth.ok) return { ok: false as const, error: auth.error, status: 0 };
  // Search Console data lags about 2–3 days.
  const res = await requestJson<{ rows?: SearchRow[] }>(`${BASE}/${encodeURIComponent(searchConsoleSite())}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: isoDay(input.days + 3), endDate: isoDay(3), dimensions: input.dimensions, rowLimit: input.rowLimit ?? 100 }),
    timeoutMs: 15_000,
  });
  if (!res.ok) return { ok: false as const, error: res.error || "Search Console query failed", status: res.status };
  return { ok: true as const, rows: res.data?.rows || [] };
}

/**
 * Queries already earning impressions where a better page could win clicks:
 * positions 4–20 with low CTR, ranked by impressions. This is observed data, not a forecast.
 */
export function keywordOpportunities(rows: SearchRow[], limit = 15) {
  return rows
    .filter((row) => row.impressions >= 20 && row.position >= 4 && row.position <= 20 && row.ctr < 0.05)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit)
    .map((row) => ({
      query: row.keys[0],
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Number((row.ctr * 100).toFixed(2)),
      position: Number(row.position.toFixed(1)),
    }));
}

export async function searchConsoleSummary(days = 28) {
  if (!searchConsoleConfigured()) return { configured: false as const };
  const [queries, pages] = await Promise.all([
    searchAnalytics({ days, dimensions: ["query"], rowLimit: 500 }),
    searchAnalytics({ days, dimensions: ["page"], rowLimit: 50 }),
  ]);
  if (!queries.ok) return { configured: true as const, ok: false as const, error: queries.error };
  const totals = queries.rows.reduce((acc, row) => ({ clicks: acc.clicks + row.clicks, impressions: acc.impressions + row.impressions }), { clicks: 0, impressions: 0 });
  return {
    configured: true as const,
    ok: true as const,
    days,
    totals,
    topQueries: [...queries.rows].sort((a, b) => b.clicks - a.clicks).slice(0, 15).map((row) => ({ query: row.keys[0], clicks: row.clicks, impressions: row.impressions, position: Number(row.position.toFixed(1)) })),
    topPages: pages.ok ? pages.rows.slice(0, 15).map((row) => ({ page: row.keys[0], clicks: row.clicks, impressions: row.impressions, position: Number(row.position.toFixed(1)) })) : [],
    opportunities: keywordOpportunities(queries.rows),
  };
}

/** /test: token, property permission level, and a real search-analytics query. */
export async function pingSearchConsole() {
  if (!serviceAccount() || !searchConsoleSite()) {
    return { configured: false as const, partial: Boolean(serviceAccount() || searchConsoleSite()) };
  }
  const auth = await googleAccessToken(SCOPES.searchConsole);
  if (!auth.ok) return { configured: true as const, auth: false, detail: auth.error };
  const site = await requestJson<{ permissionLevel?: string; siteUrl?: string }>(`${BASE}/${encodeURIComponent(searchConsoleSite())}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    timeoutMs: 10_000,
  });
  if (!site.ok) {
    return {
      configured: true as const,
      auth: true,
      access: false,
      detail:
        site.status === 403 || site.status === 404
          ? `The service account has no access to ${searchConsoleSite()}. In Search Console → Settings → Users and permissions, add ${serviceAccountEmail()} (Restricted is enough). Use "sc-domain:" for domain properties. (${site.error})`
          : site.error,
    };
  }
  const query = await searchAnalytics({ days: 7, dimensions: ["query"], rowLimit: 5 });
  return {
    configured: true as const,
    auth: true,
    access: true,
    data: query.ok,
    detail: query.ok
      ? `Permission ${site.data?.permissionLevel || "granted"} · read ${query.rows.length} query row(s) for the last 7 days.`
      : `Property access OK (${site.data?.permissionLevel}), but the analytics query failed: ${query.error}`,
  };
}
