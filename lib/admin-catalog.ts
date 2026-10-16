import { products } from "@/lib/products";
import type { Product } from "@/lib/products";

export type AdminProductRow = {
  id: string;
  source: "catalog" | "mongodb";
  slug: string;
  name: string;
  sku: string;
  price: number;
  compareAt?: number;
  wholesaleFrom?: number;
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
};

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
    quantity: undefined,
    b2cOutOfStock: p.b2cOutOfStock,
    b2bOutOfScope: p.b2bOutOfScope,
    image: p.image,
    description: p.description,
    channel: p.wholesaleFrom ? "both" : "retail",
    stock: p.stock,
    active: true,
    freeShipping: p.freeShipping !== false,
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
