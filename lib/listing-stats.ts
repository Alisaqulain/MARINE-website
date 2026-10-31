import { getDb } from "@/lib/mongodb";
import { products as staticProducts } from "@/lib/products";

export const LISTING_STAT_RANGES = ["today", "7d", "this-month", "30d", "this-year", "all"] as const;
export type ListingStatRange = (typeof LISTING_STAT_RANGES)[number];

export type ListingStatRow = {
  slug: string;
  name: string;
  image: string;
  active: boolean;
  views: number;
  favourites: number;
  orders: number;
  revenue: number;
};

/** Start of the range as an ISO string (null = all time). */
export function rangeStart(range: ListingStatRange, now = new Date()): string | null {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  switch (range) {
    case "today":
      return d.toISOString();
    case "7d":
      d.setDate(d.getDate() - 6);
      return d.toISOString();
    case "30d":
      d.setDate(d.getDate() - 29);
      return d.toISOString();
    case "this-month":
      d.setDate(1);
      return d.toISOString();
    case "this-year":
      d.setMonth(0, 1);
      return d.toISOString();
    default:
      return null;
  }
}

/** Same slug extraction as listingViewStats: /product/slug and /wholesale/product/slug. */
const slugFromPath = {
  $let: {
    vars: { withoutQuery: { $arrayElemAt: [{ $split: ["$path", "?"] }, 0] } },
    in: {
      $cond: [
        { $regexMatch: { input: "$$withoutQuery", regex: "^/wholesale/product/" } },
        { $arrayElemAt: [{ $split: ["$$withoutQuery", "/wholesale/product/"] }, 1] },
        { $arrayElemAt: [{ $split: ["$$withoutQuery", "/product/"] }, 1] },
      ],
    },
  },
};

export const LISTING_STAT_CHANNELS = ["retail", "wholesale"] as const;
export type ListingStatChannel = (typeof LISTING_STAT_CHANNELS)[number];

/** Product page views for one side: wholesale = /wholesale/product/… or /product/…?b2b=1. */
function viewPathMatch(channel: ListingStatChannel) {
  return channel === "wholesale"
    ? { $or: [{ path: { $regex: "^/wholesale/product/" } }, { path: { $regex: "^/product/[^?]+\\?(.*&)?b2b=1" } }] }
    : { path: { $regex: "^/product/" }, $nor: [{ path: { $regex: "[?&]b2b=1" } }] };
}

/** Etsy-style listing stats for retail or wholesale: views, favourites, paid orders and revenue per product. */
export async function listingStats(range: ListingStatRange, channel: ListingStatChannel = "retail"): Promise<ListingStatRow[]> {
  const start = rangeStart(range);
  const since = start ? { $gte: start } : { $exists: true };
  const db = await getDb();
  const wholesale = channel === "wholesale";

  const [views, favourites, orders, mongoProducts, overrides] = await Promise.all([
    db
      .collection("page_views")
      .aggregate<{ _id: string; n: number }>([
        { $match: { at: since, ...viewPathMatch(channel) } },
        { $group: { _id: slugFromPath, n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("favourite_events")
      .aggregate<{ _id: string; n: number }>([
        // Favourites logged before channels were recorded count as retail.
        { $match: { at: since, ...(wholesale ? { channel: "wholesale" } : { channel: { $ne: "wholesale" } }) } },
        { $group: { _id: "$slug", n: { $sum: { $cond: [{ $eq: ["$action", "add"] }, 1, -1] } } } },
      ])
      .toArray(),
    db
      .collection("orders")
      .find({ status: "paid", createdAt: since }, { projection: { items: 1 } })
      .toArray(),
    db
      .collection("products")
      .find(
        wholesale ? { channel: { $in: ["wholesale", "both"] } } : { channel: { $ne: "wholesale" } },
        { projection: { slug: 1, name: 1, image: 1, active: 1 } }
      )
      .toArray(),
    db
      .collection("catalog_overrides")
      .find({}, { projection: { slug: 1, active: 1 } })
      .toArray(),
  ]);

  const rows = new Map<string, ListingStatRow>();
  const blank = (slug: string): ListingStatRow => ({
    slug,
    name: slug,
    image: "",
    active: true,
    views: 0,
    favourites: 0,
    orders: 0,
    revenue: 0,
  });
  // Static catalogue items are sold on both sides.
  for (const p of staticProducts) rows.set(p.slug, { ...blank(p.slug), name: p.name, image: p.image });
  for (const o of overrides) {
    const row = rows.get(String(o.slug));
    if (row && o.active === false) row.active = false;
  }
  for (const p of mongoProducts) {
    const slug = String(p.slug ?? "");
    if (!slug) continue;
    rows.set(slug, {
      ...(rows.get(slug) ?? blank(slug)),
      name: String(p.name ?? slug),
      image: String(p.image ?? "") || rows.get(slug)?.image || "",
      active: p.active !== false,
    });
  }
  const row = (slug: string) => {
    let r = rows.get(slug);
    if (!r) {
      r = blank(slug);
      rows.set(slug, r);
    }
    return r;
  };

  for (const v of views) if (typeof v._id === "string" && v._id) row(decodeURIComponent(v._id)).views += v.n;
  for (const f of favourites) if (typeof f._id === "string" && f._id) row(f._id).favourites += f.n;
  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    const counted = new Set<string>();
    for (const item of items as { slug?: string; qty?: number; unitPrice?: number; b2b?: boolean }[]) {
      if (!item.slug || Boolean(item.b2b) !== wholesale) continue;
      const r = row(item.slug);
      if (!counted.has(item.slug)) {
        r.orders += 1;
        counted.add(item.slug);
      }
      r.revenue += (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
    }
  }

  return [...rows.values()].map((r) => ({
    ...r,
    favourites: Math.max(0, r.favourites),
    revenue: Number(r.revenue.toFixed(2)),
  }));
}
