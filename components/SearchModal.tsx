"use client";

import { products as staticProducts, formatPrice, type Product } from "@/lib/products";
import { filterProductsByQuery } from "@/lib/product-search";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductImage } from "./ProductImage";

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>(staticProducts);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    // Load the live catalogue (built-in + admin-added listings) each time search opens.
    let cancelled = false;
    void fetch("/api/catalog/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.items)) setProducts(data.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const results = useMemo(() => {
    if (!q.trim()) return products.slice(0, 6);
    return filterProductsByQuery(products, q);
  }, [q, products]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-navy-950/70 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="mx-auto mt-[max(0.75rem,calc(var(--site-nav)-2rem))] max-h-[calc(100dvh-2rem)] max-w-2xl overflow-hidden rounded-2xl bg-cream-50 shadow-2xl sm:mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-cream-300 px-4 py-3">
          <Search className="h-5 w-5 text-navy-600" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search compasses, telescopes, gifts…"
            className="w-full bg-transparent text-navy-900 outline-none placeholder:text-navy-500/50"
          />
          <button onClick={onClose} aria-label="Close search">
            <X className="h-5 w-5 text-navy-600" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="p-6 text-center text-sm text-navy-600">No pieces found.</p>
          )}
          {results.map((p) => (
            <Link
              key={p.slug}
              href={`/product/${p.slug}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl p-3 hover:bg-cream-200"
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-cream-300">
                <ProductImage src={p.image} alt={p.name} fill sizes="56px" className="object-cover" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-navy-900">{p.name}</p>
                <p className="text-xs text-navy-600">{p.sku}</p>
              </div>
              <p className="font-serif text-lg text-navy-900">{formatPrice(p.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
