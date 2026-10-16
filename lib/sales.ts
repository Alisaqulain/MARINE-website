import { getDb } from "@/lib/mongodb";

export type ShopSale = {
  id: string;
  name: string;
  percent: number;
  /** "everywhere" or a country name. */
  region: string;
  startsAt: string;
  endsAt: string;
  terms: string;
  scope: "all" | "selected";
  productSlugs: string[];
};

export function saleNameOk(name: string) {
  return /^[A-Za-z0-9]+$/.test(name.trim());
}

export function saleDurationDays(startsAt: string, endsAt: string) {
  const start = Date.parse(`${startsAt}T00:00:00Z`);
  const end = Date.parse(`${endsAt}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86400000);
}

export function saleIsLive(sale: ShopSale, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return sale.startsAt.slice(0, 10) <= today && today <= sale.endsAt.slice(0, 10);
}

export function saleAppliesTo(sale: ShopSale, slug: string, now = new Date()) {
  if (!saleIsLive(sale, now)) return false;
  if (sale.region.trim().toLowerCase() !== "everywhere") return false;
  if (sale.scope === "selected" && !sale.productSlugs.includes(slug)) return false;
  return true;
}

export function applySales<T extends { slug: string; price: number; compareAt?: number; priceIndia?: number; priceUs?: number; saleTerms?: string }>(
  product: T,
  sales: ShopSale[]
): T {
  const matches = sales.filter((sale) => saleAppliesTo(sale, product.slug));
  if (!matches.length) return product;
  const best = matches.reduce((a, b) => (a.percent > b.percent ? a : b));
  const cut = (value: number) => Number((value * (1 - best.percent / 100)).toFixed(2));
  return {
    ...product,
    price: cut(product.price),
    compareAt: product.compareAt != null && product.compareAt > product.price ? product.compareAt : product.price,
    priceIndia: product.priceIndia != null ? cut(product.priceIndia) : product.priceIndia,
    priceUs: product.priceUs != null ? cut(product.priceUs) : product.priceUs,
    saleTerms: best.terms || undefined,
  };
}

function mapSale(doc: {
  _id?: { toString(): string };
  name?: string;
  percent?: number;
  region?: string;
  startsAt?: string;
  endsAt?: string;
  terms?: string;
  scope?: string;
  productSlugs?: string[];
}): ShopSale {
  return {
    id: String(doc._id ?? ""),
    name: String(doc.name ?? ""),
    percent: Number(doc.percent ?? 0),
    region: String(doc.region ?? "everywhere"),
    startsAt: String(doc.startsAt ?? ""),
    endsAt: String(doc.endsAt ?? ""),
    terms: String(doc.terms ?? ""),
    scope: doc.scope === "selected" ? "selected" : "all",
    productSlugs: Array.isArray(doc.productSlugs) ? doc.productSlugs.map(String) : [],
  };
}

export async function loadSales(): Promise<ShopSale[]> {
  try {
    const db = await getDb();
    const docs = await db.collection("sales").find({}).sort({ createdAt: -1 }).limit(100).toArray();
    return docs.map((doc) => mapSale(doc));
  } catch {
    return [];
  }
}

export async function loadActiveSales(now = new Date()) {
  const sales = await loadSales();
  return sales.filter((sale) => saleIsLive(sale, now));
}
