import type { AdminProduct } from "@/lib/db/types";
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
    sku: doc.sku || doc.slug,
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
  const [mongo, sales] = await Promise.all([loadMongoStorefrontProducts(channel), loadActiveSales()]);
  return mergeStorefrontProducts(products, mongo, channel).map((product) => applySales(product, sales));
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
  } catch {
    /* fall through */
  }
  if (!product) return null;
  return applySales(product, await loadActiveSales());
}
