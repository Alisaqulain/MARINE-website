"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { formatPrice, getProduct, type Product } from "@/lib/products";
import { useRegion } from "@/lib/region-context";

/** "Recommended Product" box inside a blog article, priced for the reader's location. */
export function BlogProductCard({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | undefined>(() => getProduct(slug));
  const { priceFor } = useRegion();

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/catalog/product/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.product) setProduct(data.product);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!product) return null;
  const summary = (product.description || "").replace(/[#*_>]/g, "").trim();

  return (
    <div className="not-prose my-2 flex flex-col gap-4 rounded-xl border border-[#E8D6AE] bg-[#FFFBF3] p-4 sm:flex-row sm:items-center">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-[#f4f1ea] sm:w-40">
        <ProductImage src={product.image} alt={product.name} fill sizes="160px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B8892F]">Recommended Product</p>
        <p className="mt-1 font-serif text-lg font-semibold text-navy-900">{product.name}</p>
        {summary ? <p className="mt-1 line-clamp-2 text-sm text-navy-600">{summary}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xl font-bold text-[#2F6B1F]">{formatPrice(priceFor(product))}</span>
          <Link
            href={`/product/${product.slug}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#031D38] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0a3358]"
          >
            View Product <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
