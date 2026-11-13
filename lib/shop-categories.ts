import { getDb } from "@/lib/mongodb";
import { shopNowTree, type ShopNowChild } from "@/lib/shop-now-data";

export type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  parentSlug?: string;
  image?: string;
  /** Custom categories only: when it was added (ISO). */
  createdAt?: string;
};

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  builtin: boolean;
  /** Custom categories only: when it was added (ISO). */
  createdAt?: string;
  children: CategoryNode[];
};

export function categorySlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function collectSlugs(nodes: ShopNowChild[], into: Set<string>) {
  for (const node of nodes) {
    into.add(node.slug);
    if (node.children?.length) collectSlugs(node.children, into);
  }
}

export function uniqueCategorySlug(name: string, taken: Set<string>) {
  const base = categorySlug(name) || "category";
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

type CustomDoc = { _id: unknown; name?: string; slug?: string; parentSlug?: string; image?: string; createdAt?: unknown };
type OverrideDoc = { slug?: string; name?: string; image?: string; deleted?: boolean };

function customNodes(parentSlug: string | undefined, docs: CustomDoc[], seen: Set<string>): CategoryNode[] {
  return docs
    .filter((doc) => (doc.parentSlug || undefined) === parentSlug && doc.slug && !seen.has(String(doc.slug)))
    .map((doc) => {
      const slug = String(doc.slug);
      seen.add(slug);
      const image = String(doc.image ?? "").trim();
      const created = doc.createdAt instanceof Date ? doc.createdAt : doc.createdAt ? new Date(String(doc.createdAt)) : null;
      return {
        id: String(doc._id),
        name: String(doc.name ?? slug),
        slug,
        image: image || undefined,
        builtin: false,
        createdAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : undefined,
        children: customNodes(slug, docs, seen),
      };
    });
}

function builtinNodes(
  nodes: ShopNowChild[],
  hidden: Set<string>,
  renames: Map<string, string>,
  images: Map<string, string>,
  docs: CustomDoc[],
  seen: Set<string>
): CategoryNode[] {
  const out: CategoryNode[] = [];
  for (const node of nodes) {
    if (hidden.has(node.slug)) continue;
    const children = [
      ...builtinNodes(node.children ?? [], hidden, renames, images, docs, seen),
      ...customNodes(node.slug, docs, seen),
    ];
    const image = images.get(node.slug);
    out.push({
      id: `builtin__${node.slug}`,
      name: renames.get(node.slug) || node.name,
      slug: node.slug,
      image: image || undefined,
      builtin: true,
      children,
    });
  }
  return out;
}

export async function loadCategoryCatalog(): Promise<{ items: ShopCategory[]; tree: CategoryNode[] }> {
  try {
    const db = await getDb();
    const [docs, overrides] = await Promise.all([
      db.collection("shop_categories").find({}).sort({ name: 1 }).toArray(),
      db.collection("category_overrides").find({}).toArray(),
    ]);
    const custom = docs as CustomDoc[];
    const hidden = new Set<string>();
    const renames = new Map<string, string>();
    const images = new Map<string, string>();
    for (const row of overrides as OverrideDoc[]) {
      const slug = String(row.slug ?? "");
      if (!slug) continue;
      if (row.deleted) hidden.add(slug);
      if (row.name) renames.set(slug, String(row.name));
      if (row.image) images.set(slug, String(row.image));
    }
    const seen = new Set<string>();
    const tree = [
      ...builtinNodes(shopNowTree, hidden, renames, images, custom, seen),
      ...customNodes(undefined, custom, seen),
    ];
    const items: ShopCategory[] = [];
    const walk = (nodes: CategoryNode[], parentSlug?: string) => {
      for (const node of nodes) {
        if (!node.builtin) {
          items.push({ id: node.id, name: node.name, slug: node.slug, parentSlug, image: node.image, createdAt: node.createdAt });
        }
        walk(node.children, node.slug);
      }
    };
    walk(tree);
    return { items, tree };
  } catch (err) {
    // Built-in categories without admin renames, rather than an empty shop menu and empty pickers.
    console.error("[categories] could not load from the database:", err instanceof Error ? err.message : err);
    return { items: [], tree: builtinNodes(shopNowTree, new Set(), new Map(), new Map(), [], new Set()) };
  }
}

export async function listShopCategories(): Promise<ShopCategory[]> {
  const { items } = await loadCategoryCatalog();
  return items;
}

export function takenCategorySlugs(extra: string[] = []) {
  const taken = new Set(extra);
  collectSlugs(shopNowTree, taken);
  return taken;
}
