/** Owner alerts and the daily owner report. Pure text builders, no I/O. */

export type AlertLead = {
  id: string;
  stage: string;
  score: number;
  factors: string[];
  quantity: number;
  estimatedValueUsd: number;
  summary: string;
  channel?: "chat" | "voice" | "whatsapp";
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
  productInterest?: string[];
};

export type TranscriptLine = { role: string; text: string };

const DEFAULT_THRESHOLD = 81;

/** AI_OWNER_ALERT_SCORE (1–100). Defaults to the 81+ "high-value" band. */
export function ownerAlertThreshold(raw?: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n) : DEFAULT_THRESHOLD;
}

/** AI_OWNER_ALERT_VALUE_USD: estimated deal value that alerts the owner whatever the score. Default $5,000. */
export function ownerAlertValueUsd(raw?: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 5000;
}

/**
 * Alert once when a lead first crosses the score or deal-value threshold, again only if it climbs
 * into the high-value band, and always when the customer asks for something only the owner can approve.
 */
export function shouldAlertOwner(input: {
  score: number;
  threshold: number;
  valueUsd?: number;
  valueThresholdUsd?: number;
  alertedScore?: number | null;
  approvalRequested: boolean;
}): boolean {
  if (input.approvalRequested) return true;
  const bigDeal = input.valueThresholdUsd != null && (input.valueUsd ?? 0) >= input.valueThresholdUsd;
  if (input.score < input.threshold && !bigDeal) return false;
  if (input.alertedScore == null) return true;
  return input.score >= 81 && input.alertedScore < 81;
}

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function ownerAlertText(
  lead: AlertLead,
  transcript: TranscriptLine[],
  requestedDecision: string,
  adminUrl: string
): { subject: string; text: string } {
  const who = lead.name || lead.company || lead.email || lead.phone || "Website visitor";
  const subject = `[Marina AI] ${lead.stage} lead · score ${lead.score} · est. ${money(lead.estimatedValueUsd)} · ${who}`;
  const lines = [
    "Marina AI flagged a lead. The AI is still talking to the customer — this is an alert, not a handoff.",
    "",
    `Customer: ${lead.name || "—"}`,
    `Company: ${lead.company || "—"}`,
    `Email: ${lead.email || "—"}`,
    `Phone: ${lead.phone || "—"}`,
    `Country: ${lead.country || "—"}`,
    `Channel: ${lead.channel || "chat"}`,
    `Product interest: ${lead.productInterest?.length ? lead.productInterest.join(", ") : "—"}`,
    `Quantity: ${lead.quantity || "—"}`,
    `Estimated value: ${money(lead.estimatedValueUsd)} (estimate, not revenue)`,
    `Lead score: ${lead.score} (${lead.stage})`,
    `Why: ${lead.factors.length ? lead.factors.join("; ") : "—"}`,
    "",
    `Requested decision: ${requestedDecision}`,
    "",
    "Transcript (latest last):",
    ...(transcript.length ? transcript.map((line) => `${line.role === "customer" ? "Customer" : "Marina AI"}: ${line.text}`) : [lead.summary]),
    "",
    `Review, approve or reject: ${adminUrl}`,
  ];
  return { subject, text: lines.join("\n") };
}

export type DailyReportInput = {
  date: string;
  orders: number;
  revenue: number;
  averageOrderValue: number | null;
  leads: number;
  highValuePipelineUsd: number;
  funnel: {
    visitors: number;
    enquiries: number;
    leads: number;
    orders: number;
    visitorToEnquiry: number | null;
    enquiryToLead: number | null;
    leadToOrder: number | null;
  };
  revenueBySource: { source: string; orders: number; revenue: number }[];
  topProducts: { name: string; units: number; revenue: number }[];
  highValueLeads: { stage: string; score: number; estimatedValueUsd: number; summary: string }[];
  pendingApprovals: number;
  callsToReview: { type: string; stage?: string; summary?: string }[];
  feed: { items: number; errors: number };
  searchConnected: boolean;
  merchantConnected: boolean;
  /** GA4, when connected. */
  analytics?: {
    sessions: number;
    keyEvents: number;
    purchases: number;
    revenue: number;
    channels: { channel: string; sessions: number; revenue: number }[];
    landingPages: { page: string; sessions: number; keyEvents: number; revenue: number }[];
  };
  /** Search Console, when connected. */
  search?: {
    clicks: number;
    impressions: number;
    topQueries: { query: string; clicks: number; position: number }[];
    opportunities: { query: string; impressions: number; ctr: number; position: number }[];
  };
  /** Gemini narrative, only if every number in it was found in the data. */
  insights?: string | null;
  followUps?: { sent: number; needsApproval: number };
};

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

/** Problems and next actions, ranked by commercial impact first. */
export function recommendedActions(input: DailyReportInput): string[] {
  const out: string[] = [];
  if (input.pendingApprovals) out.push(`Decide ${input.pendingApprovals} pending approval request(s) — customers are waiting.`);
  if (input.highValueLeads.length) out.push(`Review ${input.highValueLeads.length} high-value lead(s) worth ${money(input.highValuePipelineUsd)} in estimated pipeline.`);
  if (input.feed.errors) out.push(`Fix ${input.feed.errors} Google Shopping feed item(s) with errors so they can be listed.`);
  if (input.funnel.visitors >= 50 && (input.funnel.visitorToEnquiry ?? 0) < 1) {
    out.push("Visitor-to-enquiry is under 1% — make the chat and enquiry buttons more visible on product pages.");
  }
  if (input.funnel.leads >= 5 && (input.funnel.leadToOrder ?? 0) === 0) {
    out.push("Leads are not converting to orders — follow up on open quotes.");
  }
  if (input.followUps?.needsApproval) out.push(`Approve or dismiss ${input.followUps.needsApproval} callback task(s), including missed calls.`);
  const opportunity = input.search?.opportunities[0];
  if (opportunity) {
    out.push(`"${opportunity.query}" has ${opportunity.impressions} impressions at position ${opportunity.position} but ${opportunity.ctr}% CTR — improve that page's title and meta description.`);
  }
  if (!input.searchConnected) out.push("Search Console is not connected — set GOOGLE_SERVICE_ACCOUNT_* and SEARCH_CONSOLE_SITE_URL to see queries and rankings.");
  if (!input.analytics) out.push("GA4 is not connected — set GA4_PROPERTY_ID and the Google service account to see traffic and conversions.");
  if (!input.merchantConnected) out.push("The Shopping feed is generated locally but not uploaded to Merchant Center.");
  return out;
}

export function dailyReportText(input: DailyReportInput): { subject: string; text: string } {
  const subject = `[Marina AI] Daily owner report — ${input.date} · ${input.orders} orders · ${money(input.revenue)}`;
  const section = (title: string, rows: string[]) => [title, ...(rows.length ? rows : ["  —"]), ""];
  const text = [
    `Daily owner report for ${input.date}`,
    "",
    ...section("ORDERS & REVENUE", [
      `  Paid orders: ${input.orders}`,
      `  Revenue: ${money(input.revenue)} USD`,
      `  Average order value: ${input.averageOrderValue == null ? "—" : money(input.averageOrderValue)}`,
    ]),
    ...section("B2B PIPELINE", [
      `  Leads: ${input.leads}`,
      `  High-value pipeline (estimate, not revenue): ${money(input.highValuePipelineUsd)}`,
      ...input.highValueLeads.slice(0, 10).map((l) => `  • ${l.stage} ${l.score} · ${money(l.estimatedValueUsd)} — ${l.summary.slice(0, 120)}`),
    ]),
    ...section("NEEDS YOUR REVIEW", [
      `  Pending approvals: ${input.pendingApprovals}`,
      ...input.callsToReview.slice(0, 10).map((c) => `  • Call (${c.type}${c.stage ? `, ${c.stage}` : ""}): ${(c.summary || "").slice(0, 120)}`),
    ]),
    ...section("CONVERSION", [
      `  Visitors ${input.funnel.visitors} → enquiries ${input.funnel.enquiries} (${pct(input.funnel.visitorToEnquiry)})`,
      `  Enquiries → leads ${input.funnel.leads} (${pct(input.funnel.enquiryToLead)})`,
      `  Leads → orders ${input.funnel.orders} (${pct(input.funnel.leadToOrder)})`,
    ]),
    ...section(
      "TOP PRODUCTS",
      input.topProducts.slice(0, 5).map((p) => `  • ${p.name}: ${p.units} sold, ${money(p.revenue)}`)
    ),
    ...section(
      "REVENUE BY SOURCE",
      input.revenueBySource.map((r) => `  • ${r.source}: ${r.orders} orders, ${money(r.revenue)}`)
    ),
    ...section("SHOPPING FEED & SEARCH", [
      `  Feed items: ${input.feed.items} · with errors: ${input.feed.errors}`,
      `  Search visibility data: ${input.searchConnected ? "connected" : "not connected"}`,
      `  Merchant Center upload: ${input.merchantConnected ? "connected" : "not connected"}`,
    ]),
    ...section(
      "GOOGLE ANALYTICS (GA4)",
      input.analytics
        ? [
            `  Sessions ${input.analytics.sessions} · key events ${input.analytics.keyEvents} · purchases ${input.analytics.purchases} · revenue ${money(input.analytics.revenue)}`,
            ...input.analytics.channels.slice(0, 6).map((c) => `  • ${c.channel}: ${c.sessions} sessions, ${money(c.revenue)}`),
            "  Top landing pages:",
            ...input.analytics.landingPages.slice(0, 5).map((p) => `  • ${p.page}: ${p.sessions} sessions, ${p.keyEvents} key events, ${money(p.revenue)}`),
          ]
        : ["  Not connected"]
    ),
    ...section(
      "SEARCH CONSOLE",
      input.search
        ? [
            `  Clicks ${input.search.clicks} · impressions ${input.search.impressions}`,
            ...input.search.topQueries.slice(0, 5).map((q) => `  • "${q.query}": ${q.clicks} clicks, position ${q.position}`),
            "  Keyword opportunities:",
            ...input.search.opportunities.slice(0, 5).map((q) => `  • "${q.query}": ${q.impressions} impressions, CTR ${q.ctr}%, position ${q.position}`),
          ]
        : ["  Not connected"]
    ),
    ...(input.insights ? section("AI INSIGHTS (Gemini, from the data above)", [input.insights]) : []),
    ...section("RECOMMENDED ACTIONS", recommendedActions(input).map((a) => `  • ${a}`)),
  ].join("\n");
  return { subject, text };
}
