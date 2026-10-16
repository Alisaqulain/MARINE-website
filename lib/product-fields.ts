import type { AdminProduct } from "@/lib/db/types";
import { colorsFromImages, parseListingImages } from "@/lib/listing-images";

function stringList(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value.map((item) => String(item)) : String(value).split(",");
  return raw.map((item) => item.trim()).filter(Boolean);
}

function adjustNumber(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

export function parseProductExtras(body: Record<string, unknown>): Pick<
  AdminProduct,
  | "categories"
  | "imageAdjust"
  | "colors"
  | "materials"
  | "sizes"
  | "quantity"
  | "stock"
  | "images"
  | "personalisationPrice"
  | "tags"
  | "priceIndia"
  | "priceUs"
  | "b2cOutOfStock"
  | "b2bOutOfScope"
> {
  const quantity =
    body.quantity != null && body.quantity !== "" ? Number(body.quantity) : undefined;
  const zoom = adjustNumber(body.zoom ?? (body.imageAdjust as { zoom?: number } | undefined)?.zoom, 100);
  const brightness = adjustNumber(
    body.brightness ?? (body.imageAdjust as { brightness?: number } | undefined)?.brightness,
    100
  );
  const contrast = adjustNumber(
    body.contrast ?? (body.imageAdjust as { contrast?: number } | undefined)?.contrast,
    100
  );
  const stock: AdminProduct["stock"] =
    quantity != null && quantity > 0 && quantity <= 5
      ? "low"
      : body.stock === "low" || body.stock === "made-to-order"
        ? body.stock
        : "in-stock";

  const images = parseListingImages(body.images);
  const typedColors = stringList(body.colors) ?? [];
  const colors = colorsFromImages(images, typedColors);
  const personalisationRaw = body.personalisationPrice;
  const personalisationPrice =
    personalisationRaw == null || personalisationRaw === ""
      ? null
      : Number.isFinite(Number(personalisationRaw))
        ? Math.max(0, Number(personalisationRaw))
        : null;

  const money = (value: unknown) => {
    if (value == null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : undefined;
  };

  return {
    categories: stringList(body.categories),
    colors,
    materials: stringList(body.materials),
    sizes: stringList(body.sizes),
    quantity: quantity != null && Number.isFinite(quantity) ? quantity : undefined,
    imageAdjust: images?.[0]?.adjust ?? { zoom, brightness, contrast },
    images,
    personalisationPrice,
    tags: stringList(body.tags)?.slice(0, 13),
    priceIndia: money(body.priceIndia),
    priceUs: money(body.priceUs),
    b2cOutOfStock: body.b2cOutOfStock === true,
    b2bOutOfScope: body.b2bOutOfScope === true,
    stock,
  };
}
