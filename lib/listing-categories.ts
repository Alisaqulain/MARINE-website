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

/** A node of the live tree from /api/categories (see lib/shop-categories). */
export type CategoryTreeNode = { slug: string; name: string; createdAt?: string; children?: CategoryTreeNode[] };

/**
 * The same list as `listingCategories`, but from the live tree: renames and deletions made in
 * Admin → Categories are applied and custom categories are included. Built-in list until the tree loads.
 */
export function listingCategoriesFromTree(tree: CategoryTreeNode[] | null | undefined): ListingCategory[] {
  if (!tree?.length) return listingCategories();
  const out: ListingCategory[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();
  const walkTree = (nodes: CategoryTreeNode[], prefix: string) => {
    for (const node of nodes) {
      const name = prefix ? `${prefix} — ${node.name}` : node.name;
      addUnique(out, seen, names, node.slug, name);
      if (node.children?.length) walkTree(node.children, name);
    }
  };
  walkTree(tree, "");
  const builtin = new Set<string>();
  const collect = (nodes: ShopNowChild[]) => {
    for (const node of nodes) {
      builtin.add(node.slug);
      collect(node.children ?? []);
    }
  };
  collect(shopNowTree);
  // Catalogue groups that are not shop categories; built-in ones missing from the tree were deleted.
  for (const category of shopCategories) {
    if (!builtin.has(category.slug)) addUnique(out, seen, names, category.slug, category.name);
  }
  return out;
}

export const NEWLY_ADDED_DAYS = 30;

/** Categories created in the last NEWLY_ADDED_DAYS days, newest first, labelled as in the full list. */
export function newlyAddedCategories(tree: CategoryTreeNode[] | null | undefined, now = Date.now()): ListingCategory[] {
  const recent: { slug: string; at: number }[] = [];
  const collect = (nodes: CategoryTreeNode[]) => {
    for (const node of nodes) {
      const at = node.createdAt ? Date.parse(node.createdAt) : NaN;
      if (Number.isFinite(at) && now - at <= NEWLY_ADDED_DAYS * 86_400_000) recent.push({ slug: node.slug, at });
      collect(node.children ?? []);
    }
  };
  collect(tree ?? []);
  const labels = new Map(listingCategoriesFromTree(tree).map((item) => [item.slug, item.name]));
  return recent
    .sort((a, b) => b.at - a.at)
    .flatMap((item) => (labels.has(item.slug) ? [{ slug: item.slug, name: labels.get(item.slug)! }] : []));
}
