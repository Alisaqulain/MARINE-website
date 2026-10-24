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

/** India / US price when the admin set one, otherwise the default ("other countries") price. */
export function regionalPrice(product: Priced, region: PriceRegion): number {
  if (region === "india" && product.priceIndia != null && Number.isFinite(product.priceIndia)) return product.priceIndia;
  if (region === "us" && product.priceUs != null && Number.isFinite(product.priceUs)) return product.priceUs;
  return product.price;
}
