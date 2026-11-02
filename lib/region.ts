/** Pricing regions. Every price is in US dollars; only the amount changes by visitor location. */
export type PriceRegion = "india" | "us" | "other";

export const REGION_COOKIE = "mm_region";

export function regionFromCountry(country: string | null | undefined): PriceRegion {
  const code = String(country ?? "").trim().toUpperCase();
  if (code === "IN") return "india";
  if (code === "US") return "us";
  return "other";
}

export function isPriceRegion(value: unknown): value is PriceRegion {
  return value === "india" || value === "us" || value === "other";
}

type Priced = { price: number; priceIndia?: number; priceUs?: number };

type WholesalePriced = Priced & {
  wholesaleFrom?: number;
  wholesalePriceIndia?: number;
  wholesalePriceUs?: number;
};

/** A regional price counts only when it is a real positive amount; 0 or blank falls back to the default price. */
const set = (value: number | undefined | null): value is number => value != null && Number.isFinite(value) && value > 0;

/** India / US price when the admin set one, otherwise the default ("other countries") price. */
export function regionalPrice(product: Priced, region: PriceRegion): number {
  if (region === "india" && set(product.priceIndia)) return product.priceIndia;
  if (region === "us" && set(product.priceUs)) return product.priceUs;
  return product.price;
}

/** Wholesale shelf price for the visitor's location. Falls back to retail only when no wholesale price is set. */
export function regionalWholesalePrice(product: WholesalePriced, region: PriceRegion): number {
  if (region === "india" && set(product.wholesalePriceIndia)) return product.wholesalePriceIndia;
  if (region === "us" && set(product.wholesalePriceUs)) return product.wholesalePriceUs;
  if (set(product.wholesaleFrom)) return product.wholesaleFrom;
  return regionalPrice(product, region);
}

export function displayPriceFor(
  product: WholesalePriced,
  region: PriceRegion,
  wholesale = false
): number {
  return wholesale ? regionalWholesalePrice(product, region) : regionalPrice(product, region);
}
