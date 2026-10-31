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
  /** Which shop the sale runs in. Sales saved before this existed apply to both. */
  channel: SaleChannel;
};

export type SaleChannel = "retail" | "wholesale" | "both";

export function saleInChannel(sale: ShopSale, channel: "retail" | "wholesale") {
  return sale.channel === "both" || sale.channel === channel;
}

export function saleNameOk(name: string) {
  return /^[A-Za-z0-9]+$/.test(name.trim());
}

export function saleDurationDays(startsAt: string, endsAt: string) {
  const start = Date.parse(`${startsAt}T00:00:00Z`);
  const end = Date.parse(`${endsAt}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86400000);
}

/**
 * Sale date rules: start is today or later (an already-running sale may keep its original start),
 * end is on or after the start, and the sale lasts at most 30 days. One day of leeway on "today"
 * covers admins whose local date is behind the server's UTC date. Returns an error message or null.
 */
export function saleDateProblem(input: { startsAt: string; endsAt: string; previousStartsAt?: string; now?: Date }): string | null {
  const days = saleDurationDays(input.startsAt, input.endsAt);
  if (days == null) return "Choose a start date and an end date.";
  if (days < 0) return "The end date must be on or after the start date.";
  if (days > 30) return "A sale can run for up to 30 days.";
  const yesterday = new Date((input.now ?? new Date()).getTime() - 86400000).toISOString().slice(0, 10);
  const keepsOriginalStart = input.previousStartsAt != null && input.startsAt === input.previousStartsAt.slice(0, 10);
  if (input.startsAt < yesterday && !keepsOriginalStart) return "The start date cannot be in the past.";
  if (input.endsAt < yesterday) return "The end date cannot be in the past.";
  return null;
}

export function saleIsLive(sale: ShopSale, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return sale.startsAt.slice(0, 10) <= today && today <= sale.endsAt.slice(0, 10);
}

export function saleAppliesTo(
  sale: ShopSale,
  slug: string,
  now = new Date(),
  channel?: "retail" | "wholesale"
) {
  if (!saleIsLive(sale, now)) return false;
  if (channel && !saleInChannel(sale, channel)) return false;
  // Region-limited sales still show the discount on the site; checkout currency stays USD.
  if (sale.scope === "selected" && !sale.productSlugs.includes(slug)) return false;
  return true;
}

export function applySales<
  T extends {
    slug: string;
    price: number;
    compareAt?: number;
    priceIndia?: number;
    priceUs?: number;
    wholesaleFrom?: number;
    wholesalePriceIndia?: number;
    wholesalePriceUs?: number;
    saleTerms?: string;
    salePercent?: number;
    saleEndsAt?: string;
    wholesaleSaleTerms?: string;
    wholesaleSalePercent?: number;
    wholesaleSaleEndsAt?: string;
  },
>(product: T, sales: ShopSale[]): T {
  const bestFor = (channel: "retail" | "wholesale") => {
    const matches = sales.filter((sale) => saleAppliesTo(sale, product.slug, new Date(), channel));
    return matches.length ? matches.reduce((a, b) => (a.percent > b.percent ? a : b)) : null;
  };
  const retail = bestFor("retail");
  const wholesale = bestFor("wholesale");
  if (!retail && !wholesale) return product;
  const cutBy = (sale: ShopSale) => (value: number | undefined) =>
    value != null ? Number((value * (1 - sale.percent / 100)).toFixed(2)) : value;
  // End of the sale end-date (countdown uses end-of-day UTC).
  const endOf = (sale: ShopSale) => `${sale.endsAt.slice(0, 10)}T23:59:59.999Z`;
  let next: T = product;
  if (retail) {
    const cut = cutBy(retail);
    next = {
      ...next,
      price: cut(product.price)!,
      compareAt: product.compareAt != null && product.compareAt > product.price ? product.compareAt : product.price,
      priceIndia: cut(product.priceIndia),
      priceUs: cut(product.priceUs),
      saleTerms: retail.terms || undefined,
      salePercent: retail.percent,
      saleEndsAt: endOf(retail),
    };
  }
  if (wholesale) {
    const cut = cutBy(wholesale);
    next = {
      ...next,
      wholesaleFrom: cut(product.wholesaleFrom),
      wholesalePriceIndia: cut(product.wholesalePriceIndia),
      wholesalePriceUs: cut(product.wholesalePriceUs),
      wholesaleSaleTerms: wholesale.terms || undefined,
      wholesaleSalePercent: wholesale.percent,
      wholesaleSaleEndsAt: endOf(wholesale),
    };
  }
  return next;
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
  channel?: string;
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
    channel: doc.channel === "retail" || doc.channel === "wholesale" ? doc.channel : "both",
  };
}

export async function loadSales(): Promise<ShopSale[]> {
  try {
    const db = await getDb();
    const docs = await db.collection("sales").find({}).sort({ createdAt: -1 }).limit(500).toArray();
    return docs.map((doc) => mapSale(doc));
  } catch {
    return [];
  }
}

export async function loadActiveSales(now = new Date()) {
  const sales = await loadSales();
  return sales.filter((sale) => saleIsLive(sale, now));
}
