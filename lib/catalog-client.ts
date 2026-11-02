import type { Product } from "@/lib/products";

/**
 * One shared catalogue download per side for the whole browser tab. Search, the wishlist, the shop grid,
 * the homepage and product pages all used to fetch the full catalogue separately on every page;
 * now concurrent and repeat requests within a minute reuse the same response.
 */
const FRESH_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<Product[]> }>();

export function loadCatalog(channel?: "retail" | "wholesale", options: { fresh?: boolean } = {}): Promise<Product[]> {
  const key = channel ?? "all";
  const hit = cache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < FRESH_MS) return hit.value;
  const value = fetch(`/api/catalog/products${channel ? `?channel=${channel}` : ""}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((data: { items?: Product[] }) => (Array.isArray(data.items) ? data.items : []));
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
