import { shopCategories } from "@/lib/catalog";
import { shopNowTree, type ShopNowChild } from "@/lib/shop-now-data";

export type ListingCategory = { slug: string; name: string };

function addUnique(out: ListingCategory[], seen: Set<string>, names: Set<string>, slug: string, name: string) {
  const label = name.trim();
  const nameKey = label.toLowerCase();
  if (!slug || !label || seen.has(slug) || names.has(nameKey)) return;
  seen.add(slug);
  names.add(nameKey);
  out.push({ slug, name: label });
}

function walk(nodes: ShopNowChild[], prefix: string, out: ListingCategory[], seen: Set<string>, names: Set<string>) {
  for (const node of nodes) {
    const name = prefix ? `${prefix} — ${node.name}` : node.name;
    addUnique(out, seen, names, node.slug, name);
    if (node.children?.length) walk(node.children, name, out, seen, names);
  }
}

/** Every shop category and subcategory, plus any catalogue group not already in the tree. */
export function listingCategories(): ListingCategory[] {
  const out: ListingCategory[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();
  for (const parent of shopNowTree) {
    addUnique(out, seen, names, parent.slug, parent.name);
    walk(parent.children, parent.name, out, seen, names);
  }
  for (const category of shopCategories) {
    addUnique(out, seen, names, category.slug, category.name);
  }
  return out;
}
