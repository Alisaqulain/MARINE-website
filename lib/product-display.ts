import type { CSSProperties } from "react";
import type { Product } from "@/lib/products";

export type ImageAdjust = { zoom: number; brightness: number; contrast: number };

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function imageAdjustStyle(adjust?: ImageAdjust): CSSProperties | undefined {
  if (!adjust) return undefined;
  const zoom = clamp(adjust.zoom, 50, 180);
  const brightness = clamp(adjust.brightness, 40, 160);
  const contrast = clamp(adjust.contrast, 40, 160);
  if (zoom === 100 && brightness === 100 && contrast === 100) return undefined;
  return {
    transform: `scale(${zoom / 100})`,
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
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
