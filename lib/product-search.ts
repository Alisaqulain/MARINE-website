import { getProductCategory } from "@/lib/catalog";
import { findShopNowLabel } from "@/lib/shop-now-data";
import type { Product } from "@/lib/products";

/** Client-side product search for B2C/B2B catalogues. */
export function filterProductsByQuery(items: Product[], rawQuery: string): Product[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter((p) => {
    const categoryLabel = findShopNowLabel(getProductCategory(p));
    const haystack = [
      p.name,
      p.sku,
      p.material,
      p.finish,
      p.collection,
      p.description,
      categoryLabel,
      p.subcategory ?? "",
      ...(p.tags ?? []),
      ...(p.colors ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
