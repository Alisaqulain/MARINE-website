import { getDb } from "@/lib/mongodb";
import { sendOwnerMail } from "@/lib/mail";
import { dailyReportText, type DailyReportInput } from "@/lib/ai/alerts";
import { growthReport } from "@/lib/ai/growth";
import { externalGrowthData, growthNarrative } from "@/lib/ai/growth-agent";

/** Last 24 hours of orders, leads, approvals, calls, conversion and feed health, plus 7 days of GA4 and Search Console. */
export async function buildDailyReport(now = new Date()) {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const db = await getDb();
  const [report, highValueLeads, pendingApprovals, calls, external, followSent, followApproval] = await Promise.all([
    growthReport(since),
    db.collection("ai_leads").find({ stage: "high-value", updatedAt: { $gte: since } }).sort({ score: -1 }).limit(20).toArray(),
    db.collection("ai_approvals").countDocuments({ status: "pending" }),
    db
      .collection("ai_calls")
      .find({ createdAt: { $gte: since }, $or: [{ stage: { $in: ["hot", "high-value"] } }, { type: "missed" }] })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
    externalGrowthData(7),
    db.collection("ai_followups").countDocuments({ status: "sent", updatedAt: { $gte: since } }),
    db.collection("ai_followups").countDocuments({ status: "needs_approval" }),
  ]);
  const ga4 = "ok" in external.ga4 && external.ga4.ok ? external.ga4 : null;
  const sc = "ok" in external.searchConsole && external.searchConsole.ok ? external.searchConsole : null;
  const input: DailyReportInput = {
    date: now.toISOString().slice(0, 10),
    orders: report.orders,
    revenue: report.revenue,
    averageOrderValue: report.averageOrderValue,
    leads: report.leads,
    highValuePipelineUsd: report.highValuePipelineUsd,
    funnel: report.funnel,
    revenueBySource: report.revenueBySource,
    topProducts: report.topProducts,
    highValueLeads: highValueLeads.map((lead) => ({
      stage: String(lead.stage),
      score: Number(lead.score || 0),
      estimatedValueUsd: Number(lead.estimatedValueUsd || 0),
      summary: String(lead.summary || ""),
    })),
    pendingApprovals,
    callsToReview: calls.map((call) => ({
      type: String(call.type),
      stage: call.stage ? String(call.stage) : undefined,
      summary: String(call.summary || call.transcript || (call.type === "missed" ? `Missed call from ${call.from || "unknown"}` : "")),
    })),
    feed: report.feed,
    searchConnected: Boolean(sc),
    merchantConnected: false,
    analytics: ga4
      ? {
          sessions: ga4.totals.sessions ?? 0,
          keyEvents: ga4.totals.keyEvents ?? 0,
          purchases: ga4.totals.ecommercePurchases ?? 0,
          revenue: Number((ga4.totals.purchaseRevenue ?? 0).toFixed(2)),
          channels: ga4.channels.map((row) => ({ channel: String(row.sessionDefaultChannelGroup), sessions: Number(row.sessions), revenue: Number(row.purchaseRevenue) })),
          landingPages: ga4.landingPages.map((row) => ({ page: String(row.landingPage), sessions: Number(row.sessions), keyEvents: Number(row.keyEvents), revenue: Number(row.purchaseRevenue) })),
        }
      : undefined,
    search: sc
      ? { clicks: sc.totals.clicks, impressions: sc.totals.impressions, topQueries: sc.topQueries, opportunities: sc.opportunities }
      : undefined,
    followUps: { sent: followSent, needsApproval: followApproval },
  };
  input.insights = await growthNarrative({
    orders: input.orders,
    revenue: input.revenue,
    funnel: input.funnel,
    revenueBySource: input.revenueBySource,
    topProducts: input.topProducts,
    analytics: input.analytics,
    search: input.search,
  }).catch(() => null);
  return { input, ...dailyReportText(input) };
}

export async function sendDailyReport() {
  const report = await buildDailyReport();
  await sendOwnerMail(report.subject, report.text);
  const db = await getDb();
  await db.collection("ai_audit").insertOne({ at: new Date().toISOString(), action: "daily_report", delivered: true });
  return report;
}
