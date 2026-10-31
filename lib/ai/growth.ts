import { getDb } from "@/lib/mongodb";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { googleMerchantXml, type FeedItem } from "@/lib/ai/feed";
import {
  averageOrderValue,
  conversionFunnel,
  lastNonDirect,
  productAttribution,
  revenueBySource,
  type Touch,
} from "@/lib/ai/attribution";
import { getSiteOrigin } from "@/lib/auth-url";

export async function buildMerchantFeed() {
  const origin = getSiteOrigin();
  const products = await getStorefrontProducts("retail");
  const items: FeedItem[] = products.slice(0, 500).map((product) => ({
    id: product.sku || product.slug,
    title: product.name,
    description: (product.description || product.name).replace(/\s+/g, " ").trim(),
    link: `${origin}/product/${product.slug}`,
    image: product.image,
    price: product.price,
    currency: "USD",
    availability: product.stock === "made-to-order" ? "preorder" : product.quantity === 0 ? "out_of_stock" : "in_stock",
  }));
  return googleMerchantXml(items, origin);
}

export async function recordTouch(input: { sessionId: string; touch: Touch }) {
  const db = await getDb();
  await db.collection<{ sessionId: string; touches: Touch[]; createdAt: string }>("ai_attribution").updateOne(
    { sessionId: input.sessionId },
    {
      $push: { touches: input.touch },
      $setOnInsert: { sessionId: input.sessionId, createdAt: new Date().toISOString() },
    },
    { upsert: true }
  );
}

export async function growthReport(sinceIso?: string) {
  const db = await getDb();
  const since = sinceIso ? { createdAt: { $gte: sinceIso } } : {};
  const [orders, leads, views, visitors, enquiries, touches, feed] = await Promise.all([
    db.collection("orders").find(since).sort({ createdAt: -1 }).limit(1000).toArray(),
    db.collection("ai_leads").find(sinceIso ? { updatedAt: { $gte: sinceIso } } : {}).limit(1000).toArray(),
    db.collection("page_views").countDocuments().catch(() => 0),
    db.collection("ai_attribution").countDocuments(since),
    db.collection("ai_sessions").countDocuments(since),
    db.collection("ai_attribution").find(since).limit(2000).toArray(),
    buildMerchantFeed().catch(() => null),
  ]);
  const sourceBySession = new Map<string, ReturnType<typeof lastNonDirect>>();
  for (const row of touches) {
    const list = Array.isArray(row.touches) ? (row.touches as Touch[]) : [];
    sourceBySession.set(String(row.sessionId), lastNonDirect(list));
  }
  const paid = orders.filter((order) => order.status === "paid");
  const revenue = paid.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const bySource = revenueBySource(
    orders.map((order) => ({
      id: String(order.id),
      amount: Number(order.amount || 0),
      status: String(order.status || ""),
      source: sourceBySession.get(String(order.sessionId || ""))?.source ?? null,
    }))
  );
  const leadsBySource = new Map<string, { leads: number; pipelineUsd: number }>();
  for (const lead of leads) {
    const key = sourceBySession.get(String(lead.sessionId || ""))?.source ?? (lead.channel === "voice" ? "voice" : "unknown");
    const row = leadsBySource.get(key) ?? { leads: 0, pipelineUsd: 0 };
    row.leads += 1;
    row.pipelineUsd += Number(lead.estimatedValueUsd || 0);
    leadsBySource.set(key, row);
  }
  const pipeline = leads.reduce((sum, lead) => sum + Number(lead.estimatedValueUsd || 0), 0);
  const highValue = leads.filter((lead) => lead.stage === "high-value");
  return {
    generatedAt: new Date().toISOString(),
    since: sinceIso ?? null,
    orders: paid.length,
    revenue: Number(revenue.toFixed(2)),
    averageOrderValue: averageOrderValue(revenue, paid.length),
    currency: "USD",
    pageViews: views,
    leads: leads.length,
    estimatedPipelineUsd: Number(pipeline.toFixed(2)),
    highValueLeads: highValue.length,
    highValuePipelineUsd: Number(highValue.reduce((sum, lead) => sum + Number(lead.estimatedValueUsd || 0), 0).toFixed(2)),
    funnel: conversionFunnel({ visitors, enquiries, leads: leads.length, orders: paid.length }),
    revenueBySource: bySource,
    leadsBySource: [...leadsBySource.entries()].map(([source, row]) => ({
      source,
      leads: row.leads,
      pipelineUsd: Number(row.pipelineUsd.toFixed(2)),
    })),
    topProducts: productAttribution(
      orders.map((order) => ({
        id: String(order.id),
        status: String(order.status || ""),
        items: Array.isArray(order.items)
          ? order.items.map((item: Record<string, unknown>) => ({
              slug: String(item.slug ?? ""),
              name: String(item.name ?? item.slug ?? ""),
              qty: Number(item.qty || 0),
              unitPrice: Number(item.unitPrice || 0),
            }))
          : [],
      }))
    ),
    feed: { items: feed ? (feed.xml.match(/<item>/g) || []).length : 0, errors: feed?.errors.length ?? 0 },
    notes: [
      "Revenue is the sum of paid orders. It is attributed to a source only when the order's session was tracked.",
      "Estimated pipeline is not revenue.",
      "Visitors are tracked sessions; enquiries are chat/WhatsApp conversations.",
      "Search volumes and competitor rankings are unavailable until a search-data provider is configured.",
      "This report does not change ads, prices, or the website.",
    ],
  };
}
