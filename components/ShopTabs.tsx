"use client";

import { CatalogCard } from "@/components/CatalogCard";
import { ProductCard } from "@/components/ProductCard";
import { saleInfo, stockFor, type Product } from "@/lib/products";
import { useRegion } from "@/lib/region-context";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductReviews, type useProductReviews } from "@/components/ProductReviews";

const tabs = ["Items", "Reviews"] as const;
const ITEMS_PAGE = 12;
export type ShopTab = (typeof tabs)[number];

export function ShopTabs({
  items,
  categoryItems,
  categoryLabel,
  wholesale = false,
  currentProduct,
  productReviews,
  tab: controlledTab,
  onTabChange,
}: {
  items: Product[];
  categoryItems?: Product[];
  categoryLabel?: string;
  wholesale?: boolean;
  currentProduct?: Product;
  productReviews?: ReturnType<typeof useProductReviews>;
  tab?: ShopTab;
  onTabChange?: (tab: ShopTab) => void;
}) {
  const hasCategory = Boolean(categoryLabel && categoryItems && categoryItems.length > 0);
  const [scope, setScope] = useState<"category" | "all">(hasCategory ? "category" : "all");
  const base = scope === "category" && hasCategory ? categoryItems! : items;
  const [ownTab, setOwnTab] = useState<ShopTab>("Items");
  const tab = controlledTab ?? ownTab;
  const setTab = (next: ShopTab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(ITEMS_PAGE);
  const { priceFor } = useRegion();

  useEffect(() => {
    setLimit(ITEMS_PAGE);
  }, [query, sort, scope]);

  useEffect(() => {
    setScope(hasCategory ? "category" : "all");
  }, [hasCategory, categoryLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = base.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q)
      );
    });
    const outMarked = (p: (typeof next)[number]) =>
      wholesale ? p.b2bOutOfScope === true : p.b2cOutOfStock === true;
    if (sort === "on-sale") next = next.filter((p) => (saleInfo(p, wholesale).percent ?? 0) > 0);
    if (sort === "personalisation") next = next.filter((p) => p.personalisationPrice != null);
    const qty = (p: Product) => stockFor(p, wholesale);
    if (sort === "in-stock") {
      next = next.filter((p) => !outMarked(p) && (qty(p) == null || qty(p)! > 0));
    }
    if (sort === "out-of-stock") {
      next = next.filter((p) => outMarked(p) || (qty(p) != null && qty(p)! <= 0));
    }
    if (sort === "low-stock") {
      next = next.filter((p) => {
        const n = qty(p);
        return !outMarked(p) && n != null && n > 0 && n <= 5;
      });
    }
    // Sort by the price the card shows (visitor region, retail or wholesale, sale applied).
    const shown = (p: Product) => priceFor(p, wholesale);
    if (sort === "price-asc") next = [...next].sort((a, b) => shown(a) - shown(b));
    if (sort === "price-desc") next = [...next].sort((a, b) => shown(b) - shown(a));
    if (sort === "rating") next = [...next].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    return next;
  }, [base, query, sort, wholesale, priceFor]);

  return (
    <div className="bg-white">
      <div className="sticky top-[var(--site-nav)] z-20 bg-[#C9A84C] text-[#1a1408]">
        <div className="grid grid-cols-2">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative py-3 text-[13px] sm:py-3.5 sm:text-[15px] ${
                tab === t ? "font-semibold text-[#1a1408]" : "font-normal text-[#1a1408]/70"
              }`}
            >
              {t}
              {tab === t ? (
                <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-[#1a1408] sm:inset-x-6" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "Items" && (
        <div className="px-3 pb-8 pt-4 lg:px-0 lg:pt-6">
          <label className="relative block w-full">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                scope === "category" && hasCategory
                  ? `Search ${base.length} items in ${categoryLabel}`
                  : `Search all ${items.length} items`
              }
              className="h-10 w-full rounded-full border border-[#d4d4d4] bg-white pl-4 pr-12 text-[14px] text-[#222] outline-none placeholder:text-[#8a8a8a] sm:h-11 sm:text-[15px]"
            />
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#222]" />
          </label>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto">
              {hasCategory ? (
                <button
                  type="button"
                  onClick={() => setScope("category")}
                  aria-pressed={scope === "category"}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                    scope === "category"
                      ? "border-[#1a1408] bg-[#1a1408] text-white"
                      : "border-[#d4d4d4] bg-white text-[#222]"
                  }`}
                >
                  {categoryLabel} ({categoryItems!.length})
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setScope("all")}
                aria-pressed={scope === "all"}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                  scope === "all" || !hasCategory
                    ? "border-[#1a1408] bg-[#1a1408] text-white"
                    : "border-[#d4d4d4] bg-white text-[#222]"
                }`}
              >
                All ({items.length})
              </button>
            </div>
            <button
              type="button"
              aria-label="Sort and filter"
              onClick={() => setFiltersOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center text-[#222]"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          {filtersOpen ? (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-3 w-full rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm text-[#222]"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Avg. Customer Review</option>
              <option value="on-sale">Run a sale</option>
              <option value="personalisation">Personalisation</option>
              <option value="in-stock">In stock</option>
              <option value="out-of-stock">Out of stock</option>
              <option value="low-stock">Low stock (1–5)</option>
            </select>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8">
            {filtered.slice(0, limit).map((p) =>
              wholesale ? (
                <CatalogCard key={p.slug} product={p} wholesale />
              ) : (
                <ProductCard key={p.slug} product={p} />
              ),
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#666]">No items match that search.</p>
          ) : null}
          {filtered.length > limit ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-xs text-[#888]">
                Showing {limit} of {filtered.length}
              </p>
              <button
                type="button"
                onClick={() => setLimit((n) => n + ITEMS_PAGE)}
                className="rounded-full border border-[#222] px-8 py-2.5 text-sm font-medium text-[#222]"
              >
                Show more
              </button>
            </div>
          ) : null}
        </div>
      )}

      {tab === "Reviews" && (
        <ReviewsPanel
          productSection={
            currentProduct && productReviews ? (
              <ProductReviews slug={currentProduct.slug} productName={currentProduct.name} reviews={productReviews} />
            ) : null
          }
        />
      )}
    </div>
  );
}

function ReviewsPanel({ productSection }: { productSection?: React.ReactNode }) {
  return (
    <div className="px-4 pb-10 pt-5 lg:max-w-3xl lg:px-0 lg:pt-6">
      {productSection ?? <p className="text-[14px] text-[#595959]">No reviews yet.</p>}
    </div>
  );
}
