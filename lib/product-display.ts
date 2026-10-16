import type { CSSProperties } from "react";
import type { Product } from "@/lib/products";

export type ImageAdjust = {
  zoom: number;
  brightness: number;
  contrast: number;
  /** -100 to 100. Omitted values stay neutral. */
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

export const NEUTRAL_IMAGE_ADJUST: ImageAdjust = {
  zoom: 100,
  brightness: 100,
  contrast: 100,
  exposure: 0,
  shadows: 0,
  highlights: 0,
  blacks: 0,
  whites: 0,
  saturation: 0,
  temperature: 0,
  sharpness: 0,
  clarity: 0,
};

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function offset(value: number | undefined) {
  return clamp(value ?? 0, -100, 100);
}

export function imageAdjustStyle(adjust?: ImageAdjust): CSSProperties | undefined {
  if (!adjust) return undefined;
  const zoom = clamp(adjust.zoom, 50, 180);
  const exposure = offset(adjust.exposure);
  const shadows = offset(adjust.shadows);
  const highlights = offset(adjust.highlights);
  const blacks = offset(adjust.blacks);
  const whites = offset(adjust.whites);
  const saturation = offset(adjust.saturation);
  const temperature = offset(adjust.temperature);
  const sharpness = offset(adjust.sharpness);
  const clarity = offset(adjust.clarity);
  const brightness = clamp(
    adjust.brightness + exposure * 0.45 + whites * 0.18 - blacks * 0.16 + highlights * 0.12 - shadows * 0.08,
    40,
    180
  );
  const contrast = clamp(
    adjust.contrast + clarity * 0.22 + sharpness * 0.16 + shadows * 0.12 - highlights * 0.06,
    40,
    180
  );
  const saturate = clamp(100 + saturation + clarity * 0.08, 0, 200);
  const sepia = Math.abs(temperature) * 0.45;
  const hue = temperature * -0.35;
  const neutral =
    zoom === 100 &&
    brightness === 100 &&
    contrast === 100 &&
    saturate === 100 &&
    sepia === 0 &&
    hue === 0;
  if (neutral) return undefined;
  return {
    transform: `scale(${zoom / 100})`,
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) hue-rotate(${hue}deg)`,
  };
}

/** “Low in stock, only 2 left” when a few units remain. */
export function lowStockMessage(quantity?: number): string | null {
  if (quantity == null || Number.isNaN(quantity)) return null;
  if (quantity <= 0) return "Out of stock";
  if (quantity <= 5) return `Low in stock, only ${quantity} left`;
  return null;
}

export function productInCategory(product: Product, slug: string) {
  if (product.categories?.includes(slug)) return true;
  if (product.category === slug || product.subcategory === slug || product.collection === slug) return true;
  return false;
}
