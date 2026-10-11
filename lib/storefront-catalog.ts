import type { AdminProduct } from "@/lib/db/types";
import { getDb } from "@/lib/mongodb";
import { products, type Product } from "@/lib/products";

function adminToProduct(doc: AdminProduct): Product {
  const img = doc.image || "/newlogo.png";
  return {
    slug: doc.slug,
    name: doc.name,
    sku: doc.sku || doc.slug,
    price: doc.price,
    compareAt: doc.compareAt,
    rating: 5,
    reviews: 0,
    stock: doc.stock,
    collection: "new-arrivals",
    category: "new-arrivals",
    badge: "New",
    image: img,
    gallery: img ? [img] : [],
    finish: "Handcrafted",
    material: "Brass",
    dimensions: "See product description",
    weight: "—",
    packaging: "Export-safe packing",
    included: ["Product as described"],
    description: doc.description || doc.name,
    story: doc.description || "",
    wholesaleFrom: doc.wholesaleFrom,
    freeShipping: doc.freeShipping !== false,
    moq: doc.wholesaleFrom ? 10 : undefined,
    featured: false,
  };
}

export async function loadMongoStorefrontProducts(
  channel?: "retail" | "wholesale"
): Promise<Product[]> {
  try {
    const db = await getDb();
    const filter: Record<string, unknown> = { active: { $ne: false } };
    if (channel === "retail") filter.channel = { $in: ["retail", "both"] };
    if (channel === "wholesale") filter.channel = { $in: ["wholesale", "both"] };
    const docs = await db.collection<AdminProduct>("products").find(filter).limit(500).toArray();
    return docs.map(adminToProduct);
  } catch {
    return [];
  }
}

export function mergeStorefrontProducts(
  catalog: Product[],
  mongo: Product[],
  channel?: "retail" | "wholesale"
): Product[] {
  const bySlug = new Map<string, Product>();
  for (const p of catalog) {
    if (channel === "wholesale" && !(p.wholesaleFrom ?? p.moq)) continue;
    bySlug.set(p.slug, p);
  }
  for (const p of mongo) {
    bySlug.set(p.slug, p);
  }
  return [...bySlug.values()];
}

export async function getStorefrontProducts(channel?: "retail" | "wholesale"): Promise<Product[]> {
  const mongo = await loadMongoStorefrontProducts(channel);
  return mergeStorefrontProducts(products, mongo, channel);
}

export async function getStorefrontProduct(slug: string): Promise<Product | null> {
  const staticOne = products.find((p) => p.slug === slug);
  try {
    const db = await getDb();
    const doc = await db.collection<AdminProduct>("products").findOne({
      slug,
      active: { $ne: false },
    });
    if (doc) return adminToProduct(doc);
  } catch {
    /* fall through */
  }
  return staticOne ?? null;
}
