"use client";

import { CatalogCard } from "@/components/CatalogCard";
import { products as staticProducts, type Product } from "@/lib/products";
import { canAccessWholesale, isRetailCustomer } from "@/lib/wholesale-access";
import { wholesaleCatalogHref } from "@/lib/wholesale-links";
import { useWholesaleGate } from "@/components/WholesaleGateProvider";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 8;
const PAGE_WINDOW = 10;
const MOBILE_WINDOW = 7;

type SortKey = "newest" | "name" | "price-asc" | "price-desc";

export function HomeAllProducts() {
  const [mode, setMode] = useState<"b2c" | "b2b">("b2c");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("newest");
  const [goPage, setGoPage] = useState("");
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const wholesaleOk = canAccessWholesale(session?.user);
  const { promptSwitchToWholesale } = useWholesaleGate();
  const [products, setProducts] = useState<Product[]>(staticProducts);

  useEffect(() => {
    let cancelled = false;
    function load() {
      void fetch("/api/catalog/products", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data.items) && data.items.length) setProducts(data.items);
        })
        .catch(() => {});
    }
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const sorted = useMemo(() => {
    const next = [...products];
    if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "price-asc") next.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") next.sort((a, b) => b.price - a.price);
    // newest: API already returns mongo/new items first
    return next;
  }, [products, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const items = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const start = Math.max(1, Math.min(safePage - Math.floor(PAGE_WINDOW / 2), totalPages - PAGE_WINDOW + 1));
  const pages = Array.from({ length: Math.min(PAGE_WINDOW, totalPages) }, (_, i) => start + i);
  const mobileStart = Math.max(1, Math.min(safePage - Math.floor(MOBILE_WINDOW / 2), totalPages - MOBILE_WINDOW + 1));
  const onMobile = (n: number) => n >= mobileStart && n < mobileStart + MOBILE_WINDOW;

  function go(next: number) {
    setPage(Math.min(totalPages, Math.max(1, next)));
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function switchMode(next: "b2c" | "b2b") {
    if (next === "b2b" && isRetailCustomer(session?.user)) {
      promptSwitchToWholesale("/wholesale");
      return;
    }
    if (next === "b2b" && !wholesaleOk) {
      router.push(wholesaleCatalogHref(session?.user));
      return;
    }
    setMode(next);
    setPage(1);
  }

  const displayMode = mode === "b2b" && wholesaleOk ? "b2b" : "b2c";

  return (
    <section ref={ref} className="scroll-mt-24 bg-white px-4 pb-10 pt-4 md:px-5 md:pb-14 md:pt-5">
      <div className="mx-auto max-w-[1320px]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-px w-16 bg-[#C9A84C]" />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="inline-flex rounded-full border border-[#031D38]/15 bg-[#FAF7F2] p-1">
            {(
              [
                ["b2c", "Retail"],
                ["b2b", "Wholesale"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition sm:px-6 sm:text-xs ${
                  (key === "b2b" ? displayMode === "b2b" : displayMode === "b2c")
                    ? "bg-[#031D38] text-white"
                    : "text-[#031D38] hover:text-[#3A6EA5]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-navy-700">
            Sort
            <select
              className="input min-h-9 py-1.5 text-sm"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                setPage(1);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 lg:grid-cols-4">
          {items.map((p) => (
            <CatalogCard key={`${displayMode}-${p.slug}`} product={p} wholesale={displayMode === "b2b"} />
          ))}
        </div>

        <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-sm">
          {safePage > 1 && (
            <button type="button" onClick={() => go(safePage - 1)} className="px-2 py-1 text-[#1a0dab] hover:underline">
              Previous
            </button>
          )}
          {pages.map((n) =>
            n === safePage ? (
              <span key={n} aria-current="page" className="min-w-[1.75rem] px-1.5 py-1 text-center font-semibold text-[#222222]">
                {n}
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => go(n)}
                className={`${onMobile(n) ? "" : "hidden sm:inline-block"} min-w-[1.75rem] px-1.5 py-1 text-center text-[#1a0dab] hover:underline`}
              >
                {n}
              </button>
            )
          )}
          {safePage < totalPages && (
            <button type="button" onClick={() => go(safePage + 1)} className="px-2 py-1 text-[#1a0dab] hover:underline">
              Next
            </button>
          )}
        </nav>

        <form
          className="mt-4 flex items-center justify-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const next = Number(goPage);
            if (Number.isFinite(next)) go(next);
            setGoPage("");
          }}
        >
          <label className="inline-flex items-center gap-2 text-navy-700">
            Go to page
            <input
              className="input h-9 w-20 py-0 text-sm"
              inputMode="numeric"
              value={goPage}
              onChange={(e) => setGoPage(e.target.value.replace(/\D/g, ""))}
              placeholder={`1–${totalPages}`}
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[#031D38]/25 bg-[#031D38] px-4 text-xs font-semibold uppercase tracking-wide text-white"
          >
            Go
          </button>
        </form>

        <div className="mt-6 text-center">
          {displayMode === "b2b" ? (
            <WholesaleNavLink
              callbackUrl="/wholesale"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3A6EA5] hover:underline"
            >
              View full wholesale catalogue →
            </WholesaleNavLink>
          ) : (
            <Link href="/retail" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3A6EA5] hover:underline">
              View full retail catalogue →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
