import { NextResponse } from "next/server";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { productReviewStats } from "@/lib/product-reviews";

type Stats = Map<string, { average: number; count: number }>;
let statsCache: { at: number; value: Promise<Stats> } | null = null;

/** Review averages change rarely; recompute at most once a minute. */
function reviewStats(): Promise<Stats> {
  if (statsCache && Date.now() - statsCache.at < 60_000) return statsCache.value;
  const value = productReviewStats().catch(() => new Map() as Stats);
  statsCache = { at: Date.now(), value };
  return value;
}

export async function GET(req: Request) {
  const channelParam = new URL(req.url).searchParams.get("channel");
  const channel =
    channelParam === "wholesale" ? "wholesale" : channelParam === "retail" ? "retail" : undefined;
  const [products, stats] = await Promise.all([
    getStorefrontProducts(channel),
    reviewStats(),
  ]);
  // Ratings come only from real customer reviews; the old static catalogue numbers are not shown.
  const items = products.map((product) => {
    const real = stats.get(product.slug);
    return { ...product, rating: real?.average ?? 0, reviews: real?.count ?? 0 };
  });
  return NextResponse.json({ items });
}
