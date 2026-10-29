import { getDb } from "@/lib/mongodb";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { googleMerchantXml, type FeedItem } from "@/lib/ai/feed";
import { lastNonDirect, revenueBySource, type Touch } from "@/lib/ai/attribution";
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

export async function growthReport() {
  const db = await getDb();
  const [orders, leads, views] = await Promise.all([
    db.collection("orders").find({}).sort({ createdAt: -1 }).limit(200).toArray(),
    db.collection("ai_leads").find({}).limit(200).toArray(),
    db.collection("page_views").countDocuments().catch(() => 0),
  ]);
  const touches = await db.collection("ai_attribution").find({}).limit(200).toArray();
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
  const pipeline = leads.reduce((sum, lead) => sum + Number(lead.estimatedValueUsd || 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    orders: paid.length,
    revenue: Number(revenue.toFixed(2)),
    currency: "USD",
    pageViews: views,
    leads: leads.length,
    estimatedPipelineUsd: Number(pipeline.toFixed(2)),
    revenueBySource: bySource,
    notes: [
      "Revenue is the sum of paid orders in this sample. It is not attributed revenue unless a source is shown.",
      "Estimated pipeline is not revenue.",
      "Search volumes and competitor rankings are unavailable until a search-data provider is configured.",
      "This report does not change ads, prices, or the website.",
    ],
  };
}
