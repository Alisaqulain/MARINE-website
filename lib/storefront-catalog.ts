import type { AdminProduct, CatalogOverride } from "@/lib/db/types";
import { colorsFromImages } from "@/lib/listing-images";
import { getDb } from "@/lib/mongodb";
import { products, type Product } from "@/lib/products";
import { applySales, loadActiveSales } from "@/lib/sales";

function adminToProduct(doc: AdminProduct): Product {
  const listingImages = (doc.images ?? []).filter((image) => image.url);
  const img = listingImages[0]?.url || doc.image || "/newlogo.png";
  return {
    slug: doc.slug,
    name: doc.name,
    sku: doc.sku?.trim() || "",
    price: doc.price,
    compareAt: doc.compareAt,
    rating: 5,
    reviews: 0,
    stock: doc.stock,
    collection: doc.categories?.[0] || "new-arrivals",
    badge: "New",
    image: img,
    gallery: listingImages.length ? listingImages.map((image) => image.url) : img ? [img] : [],
    listingImages,
    finish: "Handcrafted",
    material: doc.materials?.[0] || "Brass",
    materials: doc.materials,
    colors: colorsFromImages(listingImages, doc.colors),
    sizes: doc.sizes,
    quantity: doc.quantity,
    b2cOutOfStock: doc.b2cOutOfStock,
    b2bOutOfScope: doc.b2bOutOfScope,
    categories: doc.categories,
    category: doc.categories?.[0] || "new-arrivals",
    imageAdjust: listingImages[0]?.adjust ?? doc.imageAdjust,
    tags: doc.tags,
    priceIndia: doc.priceIndia,
    priceUs: doc.priceUs,
    personalisationPrice:
      doc.personalisationPrice != null && Number.isFinite(doc.personalisationPrice)
        ? doc.personalisationPrice
        : undefined,
    dimensions: "See product description",
    weight: "—",
    packaging: "Export-safe packing",
    included: ["Product as described"],
    description: doc.description || doc.name,
    story: doc.description || "",
    wholesaleFrom: doc.wholesaleFrom,
    wholesalePriceIndia: doc.wholesalePriceIndia,
    wholesalePriceUs: doc.wholesalePriceUs,
    freeShipping: doc.freeShipping !== false,
    moq: doc.wholesaleFrom != null || doc.wholesalePriceIndia != null || doc.wholesalePriceUs != null ? 20 : undefined,
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

/** Slugs the admin deactivated: built-in catalogue items and saved listings alike. */
async function loadDeactivatedSlugs(): Promise<Set<string>> {
  try {
    const db = await getDb();
    const [overrides, docs] = await Promise.all([
      db.collection<CatalogOverride>("catalog_overrides").find({ active: false }, { projection: { slug: 1 } }).toArray(),
      db.collection<AdminProduct>("products").find({ active: false }, { projection: { slug: 1 } }).toArray(),
    ]);
    return new Set([...overrides, ...docs].map((d) => d.slug));
  } catch {
    return new Set();
  }
}

export async function getStorefrontProducts(channel?: "retail" | "wholesale"): Promise<Product[]> {
  const [mongo, sales, deactivated] = await Promise.all([
    loadMongoStorefrontProducts(channel),
    loadActiveSales(),
    loadDeactivatedSlugs(),
  ]);
  const activeSlugs = new Set(mongo.map((p) => p.slug));
  const catalog = products.filter((p) => activeSlugs.has(p.slug) || !deactivated.has(p.slug));
  return mergeStorefrontProducts(catalog, mongo, channel)
    .map((product) => applySales(product, sales))
    .sort((a, b) => {
      const aMongo = mongo.find((item) => item.slug === a.slug);
      const bMongo = mongo.find((item) => item.slug === b.slug);
      if (aMongo && !bMongo) return -1;
      if (!aMongo && bMongo) return 1;
      return a.name.localeCompare(b.name);
    });
}

export async function getStorefrontProduct(slug: string): Promise<Product | null> {
  const staticOne = products.find((p) => p.slug === slug);
  let product: Product | null = staticOne ?? null;
  try {
    const db = await getDb();
    const doc = await db.collection<AdminProduct>("products").findOne({
      slug,
      active: { $ne: false },
    });
    if (doc) product = adminToProduct(doc);
    else if (staticOne && (await loadDeactivatedSlugs()).has(slug)) product = null;
  } catch {
    /* fall through */
  }
  if (!product) return null;
  return applySales(product, await loadActiveSales());
}
