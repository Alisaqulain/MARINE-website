"use client";

import { CatalogCard } from "@/components/CatalogCard";
import { getProductCategory } from "@/lib/catalog";
import { productInCategory } from "@/lib/product-display";
import { findNamedCategory, type NamedCategory } from "@/lib/category-label";
import { findShopNowLabel, shopNowSubtree, shopNowTree } from "@/lib/shop-now-data";
import { products as staticProducts, saleInfo, type Product } from "@/lib/products";
import { Camera, ChevronDown, ChevronRight, LayoutGrid, LayoutList, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 24;

export function ShopNowCatalog({ retail = false }: { retail?: boolean }) {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(staticProducts);
  const [open, setOpen] = useState<string | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [sort, setSort] = useState("new");
  const [grid, setGrid] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [extraCategories, setExtraCategories] = useState<{ slug: string; name: string }[]>([]);
  const [remoteTree, setRemoteTree] = useState<NamedCategory[] | null>(null);
  const visualSearchRef = useRef<HTMLInputElement>(null);

  const categoryTree = useMemo(() => {
    if (remoteTree) return remoteTree;
    const extras = extraCategories
      .filter((item) => !shopNowTree.some((parent) => parent.slug === item.slug))
      .map((item) => ({ slug: item.slug, name: item.name, children: [] }));
    return [...shopNowTree, ...extras];
  }, [extraCategories, remoteTree]);

  useEffect(() => {
    void fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.tree)) setRemoteTree(data.tree);
        if (Array.isArray(data.items)) setExtraCategories(data.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const channel = retail ? "retail" : "wholesale";
    void fetch(`/api/catalog/products?channel=${channel}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items) && data.items.length) setCatalogProducts(data.items);
      })
      .catch(() => {});
  }, [retail]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("category");
    const q = params.get("q");
    if (q) setQuery(q);
    const node = categoryTree.find((c) => c.slug === slug);
    if (!node) return;
    setParent(node.slug);
    setSub(null);
    setOpen(null);
  }, [categoryTree]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [parent, sub, sort, query]);

  const list = useMemo(() => {
    let next = [...catalogProducts];
    if (sub) {
      const slugs = shopNowSubtree(sub);
      next = next.filter(
        (p) =>
          (p.subcategory && slugs.includes(p.subcategory)) ||
          slugs.some((slug) => productInCategory(p, slug))
      );
    } else if (parent) {
      next = next.filter((p) => productInCategory(p, parent) || getProductCategory(p) === parent);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.finish.toLowerCase().includes(q)
      );
    }

    const outMarked = (p: (typeof next)[number]) =>
      retail ? p.b2cOutOfStock === true : p.b2bOutOfScope === true;
    if (sort === "on-sale") next = next.filter((p) => (saleInfo(p, !retail).percent ?? 0) > 0);
    if (sort === "personalisation") next = next.filter((p) => p.personalisationPrice != null);
    if (sort === "in-stock") {
      next = next.filter((p) => !outMarked(p) && (p.quantity == null || p.quantity > 0));
    }
    if (sort === "out-of-stock") {
      next = next.filter((p) => outMarked(p) || (p.quantity != null && p.quantity <= 0));
    }
    if (sort === "low-stock") {
      next = next.filter(
        (p) => !outMarked(p) && p.quantity != null && p.quantity > 0 && p.quantity <= 5
      );
    }
    if (sort === "price-asc") next.sort((a, b) => (a.wholesaleFrom ?? a.price) - (b.wholesaleFrom ?? b.price));
    if (sort === "price-desc") next.sort((a, b) => b.price - a.price);
    if (sort === "rating") next.sort((a, b) => b.rating - a.rating);
    if (sort === "new") next.reverse();
    return next;
  }, [parent, sub, sort, query, catalogProducts, retail]);

  const filtered = Boolean(sub || parent);
  const activeSlug = sub || parent;
  const liveName = findNamedCategory(categoryTree, activeSlug);
  const title = filtered ? liveName || (remoteTree ? "Shop" : findShopNowLabel(activeSlug)) : "All products";
  const Title = retail ? "h1" : "h2";

  function showAll() {
    setOpen(null);
    setParent(null);
    setSub(null);
  }

  function toggleParent(slug: string) {
    const node = categoryTree.find((c) => c.slug === slug);
    setParent(slug);
    setSub(null);
    if (!node?.children?.length) {
      setOpen(null);
      return;
    }
    setOpen(open === slug ? null : slug);
  }

  function pickChild(parentSlug: string, childSlug: string) {
    setOpen(parentSlug);
    setParent(parentSlug);
    setSub(childSlug);
  }

  const openParent = categoryTree.find((c) => c.slug === parent);
  const mobileChildren = openParent?.children ?? [];

  return (
    <div className="bg-white">
      <div className="border-b border-[#eee] bg-[#fcfbf8] md:hidden">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <button
            type="button"
            onClick={showAll}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] ${
              !filtered ? "border-[#031D38] bg-[#031D38] text-white" : "border-[#ddd] bg-white text-[#222]"
            }`}
          >
            All
          </button>
          {categoryTree.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => toggleParent(c.slug)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] ${
                parent === c.slug ? "border-[#031D38] bg-[#031D38] text-white" : "border-[#ddd] bg-white text-[#222]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {mobileChildren.length > 0 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-[#eee] bg-white px-4 py-2.5">
            {mobileChildren.map((child) => (
              <button
                key={child.slug}
                type="button"
                onClick={() => pickChild(parent!, child.slug)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] ${
                  sub === child.slug || (sub && shopNowSubtree(child.slug).includes(sub))
                    ? "bg-[#C9A84C]/20 font-semibold text-[#7a5c12]"
                    : "bg-[#f4f1ea] text-[#444]"
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-row">
        <aside className="hidden w-[300px] shrink-0 border-r border-[#eee] bg-white md:block">
          <nav className="no-scrollbar sticky top-[var(--site-nav)] max-h-[calc(100dvh-var(--site-nav))] overflow-y-auto py-2 pb-6">
            <p className="px-2 pb-2 pt-3 text-[13px] font-medium text-[#b0893a] sm:px-4 sm:text-[15px]">Product categories</p>
            <button
              type="button"
              onClick={showAll}
              className={`flex w-full items-center justify-between border-b border-l-[3px] border-b-[#f0f0f0] px-2 py-2.5 text-left text-[11px] leading-snug md:px-4 md:py-3 md:text-[14px] ${
                !filtered
                  ? "border-l-[#C9A84C] bg-[#faf7f2] font-medium text-[#b0893a]"
                  : "border-l-transparent text-[#222] hover:bg-[#fafafa]"
              }`}
            >
              <span>All products</span>
              <span className="text-[11px] text-[#999]">{catalogProducts.length}</span>
            </button>
            {categoryTree.map((c) => {
              const hasChildren = (c.children?.length ?? 0) > 0;
              const expanded = hasChildren && open === c.slug;
              const parentActive = parent === c.slug && !sub;
              const inBranch = parent === c.slug;
              return (
                <div key={c.slug} className="border-b border-[#f0f0f0]">
                  <button
                    type="button"
                    onClick={() => toggleParent(c.slug)}
                    className={`flex w-full items-center justify-between gap-1 border-l-[3px] px-2 py-2.5 text-left text-[11px] leading-snug md:px-4 md:py-3 md:text-[14px] ${
                      parentActive
                        ? "border-l-[#C9A84C] bg-[#faf7f2] font-medium text-[#b0893a]"
                        : inBranch
                          ? "border-l-[#C9A84C]/40 font-medium text-[#222]"
                          : "border-l-transparent text-[#222] hover:bg-[#fafafa]"
                    }`}
                  >
                    <span className="min-w-0 break-words">{c.name}</span>
                    {hasChildren ? (
                      expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#bbb]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#bbb]" />
                      )
                    ) : null}
                  </button>
                  {expanded ? (
                    <div className="bg-white pb-1 md:bg-[#fcfcfc]">
                      {(c.children ?? []).map((child) => {
                        const types = child.children ?? [];
                        const childOpen = types.length > 0 && shopNowSubtree(child.slug).includes(sub ?? "");
                        return (
                          <div key={child.slug}>
                            <button
                              type="button"
                              onClick={() => pickChild(c.slug, child.slug)}
                              className={`flex w-full items-center justify-between gap-1 py-2 pl-3 pr-1.5 text-left text-[10.5px] leading-snug md:px-8 md:text-[13px] ${
                                sub === child.slug ? "font-semibold text-[#b0893a]" : "text-[#555] hover:text-[#b0893a]"
                              }`}
                            >
                              <span>{child.name}</span>
                              {types.length > 0 &&
                                (childOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#bbb]" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#bbb]" />
                                ))}
                            </button>
                            {childOpen &&
                              types.map((t) => (
                                <button
                                  key={t.slug}
                                  type="button"
                                  onClick={() => pickChild(c.slug, t.slug)}
                                  className={`w-full py-1.5 pl-5 pr-1.5 text-left text-[10px] leading-snug md:pl-12 md:pr-4 md:text-[12.5px] ${
                                    sub === t.slug ? "font-semibold text-[#b0893a]" : "text-[#777] hover:text-[#b0893a]"
                                  }`}
                                >
                                  {t.name}
                                </button>
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-4 md:py-6 lg:px-6">
          <div className="mb-4 flex flex-col gap-4">
            <Title className="whitespace-nowrap font-serif text-lg leading-tight text-navy-900 sm:text-2xl">
              {title}
              <span className="ml-2 text-[11px] font-normal text-[#999] sm:text-[13px]">({list.length})</span>
            </Title>
            <div className="flex w-full min-w-0 items-center gap-3">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{retail ? "Search B2C products" : "Search B2B products"}</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#999] md:left-3 md:h-4 md:w-4" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={retail ? "Search retail…" : "Search wholesale…"}
                  className="w-full rounded-full border border-[#ddd] bg-white py-1.5 pl-8 pr-2 text-xs text-[#222] placeholder:text-[#aaa] focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/40 md:py-2 md:pl-9 md:pr-4 md:text-sm"
                />
              </label>
              <input
                ref={visualSearchRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
                  if (base.length > 2) setQuery(base);
                }}
              />
              <button
                type="button"
                aria-label="Search by photo name"
                title="Pick a photo — we match products from the file name (use a clear product photo name when possible)"
                onClick={() => visualSearchRef.current?.click()}
                className="shrink-0 rounded-full border border-[#ddd] bg-white p-1.5 text-[#666] hover:border-[#C9A84C] md:p-2"
              >
                <Camera className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort and filter products"
                className="max-w-[7.5rem] shrink-0 rounded-full border border-[#ddd] bg-white px-2 py-1.5 text-[11px] sm:max-w-none sm:px-3 sm:text-[12px] md:py-1.5 md:text-sm"
              >
                <option value="new">New</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="rating">Top rated</option>
                <option value="on-sale">Run a sale</option>
                <option value="personalisation">Personalisation</option>
                <option value="in-stock">In stock</option>
                <option value="out-of-stock">Out of stock</option>
                <option value="low-stock">Low stock (1–5)</option>
              </select>
              <div className="flex shrink-0 items-center gap-0.5 text-[#888] sm:gap-1.5">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={grid}
                  onClick={() => setGrid(true)}
                  className={`p-0.5 ${grid ? "text-[#222]" : ""}`}
                >
                  <LayoutGrid className="h-4 w-4 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={!grid}
                  onClick={() => setGrid(false)}
                  className={`p-0.5 ${!grid ? "text-[#222]" : ""}`}
                >
                  <LayoutList className="h-4 w-4 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5" />
                </button>
              </div>
            </div>
          </div>

          <div
            className={
              grid
                ? "grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8"
                : "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
            }
          >
            {list.slice(0, limit).map((p) => (
              <CatalogCard key={p.slug} product={p} wholesale={!retail} />
            ))}
          </div>
          {list.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#666]">
              {query.trim() ? "No products match your search." : "No products in this category yet."}
            </p>
          ) : null}
          {list.length > limit ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <p className="text-xs text-[#888]">
                Showing {limit} of {list.length}
              </p>
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="rounded-full border border-[#222] px-6 py-2 text-[13px] font-medium text-[#222] transition hover:bg-[#222] hover:text-white sm:px-8 sm:py-2.5 sm:text-sm"
              >
                Show more
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
