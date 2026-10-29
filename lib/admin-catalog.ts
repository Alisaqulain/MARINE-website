import { products } from "@/lib/products";
import type { Product } from "@/lib/products";
import { getProductCategory } from "@/lib/catalog";

export type AdminProductRow = {
  id: string;
  source: "catalog" | "mongodb";
  slug: string;
  name: string;
  sku: string;
  price: number;
  compareAt?: number;
  wholesaleFrom?: number;
  wholesalePriceIndia?: number;
  wholesalePriceUs?: number;
  quantity?: number;
  b2cOutOfStock?: boolean;
  b2bOutOfScope?: boolean;
  image: string;
  description: string;
  channel: "retail" | "wholesale" | "both";
  stock: string;
  active: boolean;
  freeShipping?: boolean;
  categories?: string[];
  imageAdjust?: {
    zoom: number;
    brightness: number;
    contrast: number;
    exposure?: number;
    shadows?: number;
    highlights?: number;
    blacks?: number;
    whites?: number;
    saturation?: number;
    temperature?: number;
    sharpness?: number;
    clarity?: number;
  };
  colors?: string[];
  materials?: string[];
  sizes?: string[];
  images?: { url: string; name: string; color: string; text: string; textX?: number; textY?: number; adjust?: AdminProductRow["imageAdjust"] }[];
  personalisationPrice?: number | null;
  tags?: string[];
  priceIndia?: number;
  priceUs?: number;
  featured?: boolean;
  renewsAt?: string;
  listedBy?: { userId: string; name: string; email: string };
  createdAt?: string;
  updatedAt?: string;
};

export const ADMIN_PRODUCT_SORTS = ["newest", "oldest", "updated", "name-asc", "name-desc", "price-asc", "price-desc"] as const;
export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number];

export const ADMIN_PRODUCT_FILTERS = ["all", "added", "catalog", "in-stock", "low-stock", "out-of-stock", "on-sale", "hidden"] as const;
export type AdminProductFilter = (typeof ADMIN_PRODUCT_FILTERS)[number];

const time = (value?: string) => (value ? Date.parse(value) || 0 : 0);

/** Built-in catalogue rows have no dates, so they sort as the oldest items. */
export function sortAdminProducts(rows: AdminProductRow[], sort: AdminProductSort): AdminProductRow[] {
  const copy = [...rows];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    case "oldest":
      return copy.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case "updated":
      return copy.sort((a, b) => time(b.updatedAt ?? b.createdAt) - time(a.updatedAt ?? a.createdAt));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function filterAdminProducts(
  rows: AdminProductRow[],
  filter: AdminProductFilter,
  onSaleSlugs?: Set<string>,
  channel?: "retail" | "wholesale" | null
): AdminProductRow[] {
  const markedOut =
    channel === "wholesale"
      ? (p: AdminProductRow) => p.b2bOutOfScope === true
      : channel === "retail"
        ? (p: AdminProductRow) => p.b2cOutOfStock === true
        : (p: AdminProductRow) => p.b2cOutOfStock === true || p.b2bOutOfScope === true;

  switch (filter) {
    case "added":
      return rows.filter((p) => p.source === "mongodb");
    case "catalog":
      return rows.filter((p) => p.source === "catalog");
    case "in-stock":
      return rows.filter((p) => !markedOut(p) && (p.quantity == null || p.quantity > 0));
    case "low-stock":
      return rows.filter(
        (p) => !markedOut(p) && p.quantity != null && p.quantity > 0 && p.quantity <= 5
      );
    case "out-of-stock":
      return rows.filter((p) => markedOut(p) || (p.quantity != null && p.quantity <= 0));
    case "on-sale":
      return rows.filter((p) => onSaleSlugs?.has(p.slug));
    case "hidden":
      return rows.filter((p) => p.active === false);
    default:
      return rows;
  }
}

export function catalogProductsForAdmin(channel?: "retail" | "wholesale" | null): AdminProductRow[] {
  return products
    .filter((p) => {
      if (channel === "wholesale") return Boolean(p.wholesaleFrom ?? p.moq);
      if (channel === "retail") return true;
      return true;
    })
    .map((p) => catalogProductToRow(p));
}

function catalogProductToRow(p: Product): AdminProductRow {
  return {
    id: `catalog-${p.slug}`,
    source: "catalog",
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    price: p.price,
    compareAt: p.compareAt,
    wholesaleFrom: p.wholesaleFrom,
    wholesalePriceIndia: p.wholesalePriceIndia,
    wholesalePriceUs: p.wholesalePriceUs,
    quantity: undefined,
    b2cOutOfStock: p.b2cOutOfStock,
    b2bOutOfScope: p.b2bOutOfScope,
    image: p.image,
    description: p.description,
    channel: p.wholesaleFrom ? "both" : "retail",
    stock: p.stock,
    active: true,
    freeShipping: p.freeShipping !== false,
    categories: [
      ...new Set(
        [getProductCategory(p), ...(p.categories ?? []), p.category, p.subcategory, p.collection].filter(
          (slug): slug is string => Boolean(slug)
        )
      ),
    ],
  };
}

export function mergeAdminProducts(
  catalog: AdminProductRow[],
  mongo: AdminProductRow[]
): AdminProductRow[] {
  const bySlug = new Map<string, AdminProductRow>();
  for (const p of catalog) {
    bySlug.set(p.slug, p);
  }
  for (const p of mongo) {
    bySlug.set(p.slug, p);
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}
