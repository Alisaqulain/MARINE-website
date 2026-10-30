"use client";

import { ChevronDown, Clock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import type { ListingStatRange, ListingStatRow } from "@/lib/listing-stats";

const RANGES: { value: ListingStatRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "this-month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
  { value: "this-year", label: "This year" },
  { value: "all", label: "All time" },
];

type SortKey = "views" | "favourites" | "orders" | "revenue";
const PAGE = 25;

function rangeDates(range: ListingStatRange) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const end = new Date();
  const start = new Date();
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "this-month") start.setDate(1);
  if (range === "this-year") start.setMonth(0, 1);
  if (range === "all") return "";
  return range === "today" ? fmt(end) : `${fmt(start)} - ${fmt(end)}`;
}

function money(n: number) {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** Etsy-style "how shoppers found your listings": views, favourites, orders and revenue per product. */
export function AdminListingStats() {
  const [range, setRange] = useState<ListingStatRange>("this-month");
  const [rows, setRows] = useState<ListingStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [menuOpen, setMenuOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [hideEmpty, setHideEmpty] = useState(true);

  const load = useCallback(async (next: ListingStatRange) => {
    setLoading(true);
    setError("");
    const data = await fetch(`/api/admin/listing-stats?range=${next}`, { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => ({ error: "Could not load listing stats." }));
    setRows(Array.isArray(data.items) ? data.items : []);
    setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : "");
    if (data.error) setError(String(data.error));
    setLoading(false);
  }, []);

  useEffect(() => {
    setLimit(PAGE);
    void load(range);
  }, [range, load]);

  const sorted = useMemo(() => {
    const list = hideEmpty ? rows.filter((r) => r.views || r.favourites || r.orders || r.revenue) : rows;
    return [...list].sort((a, b) => b[sort] - a[sort] || b.views - a.views || a.name.localeCompare(b.name));
  }, [rows, sort, hideEmpty]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          views: t.views + r.views,
          favourites: t.favourites + r.favourites,
          orders: t.orders + r.orders,
          revenue: t.revenue + r.revenue,
        }),
        { views: 0, favourites: 0, orders: 0, revenue: 0 }
      ),
    [rows]
  );

  const current = RANGES.find((r) => r.value === range) ?? RANGES[2];
  const header = (key: SortKey, label: string) => (
    <th className="px-3 py-3 text-right">
      <button
        type="button"
        onClick={() => setSort(key)}
        className={`inline-flex flex-col items-center font-semibold ${sort === key ? "text-[#222]" : "text-[#555]"}`}
      >
        {label}
        {sort === key ? <ChevronDown className="h-3.5 w-3.5" /> : <span className="h-3.5" />}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Views", String(totals.views)],
          ["Favourites", String(totals.favourites)],
          ["Orders", String(totals.orders)],
          ["Revenue", money(Number(totals.revenue.toFixed(2)))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-navy-600">{label}</p>
            <p className="mt-1 font-serif text-2xl text-navy-900">{loading ? "…" : value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-[#FAF8F4] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe5da] px-4 py-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-[#efebe4] px-4 py-2 text-sm font-semibold text-[#222]"
            >
              {current.label}
              {rangeDates(range) ? `: ${rangeDates(range)}` : ""}
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute left-0 z-20 mt-1 w-48 rounded-xl border bg-white py-1 text-sm shadow-lg">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRange(r.value);
                      setMenuOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left hover:bg-[#faf8f4] ${r.value === range ? "font-semibold" : ""}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-xs text-navy-600">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              Hide listings with no activity
            </label>
            {updatedAt ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[#222]">
                <Clock className="h-3.5 w-3.5" />
                Updated {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <button type="button" className="text-[#8C6E28] underline" onClick={() => void load(range)}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="text-[#222]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Listing</th>
                {header("views", "Views")}
                {header("favourites", "Favourites")}
                {header("orders", "Orders")}
                {header("revenue", "Revenue")}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-navy-600">
                    Loading listing stats…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-navy-600">
                    No views, favourites or orders in this period yet.
                  </td>
                </tr>
              ) : (
                sorted.slice(0, limit).map((r) => (
                  <tr key={r.slug} className="border-t border-[#ebe5da]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-4">
                        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#efebe4]">
                          {r.image ? <ProductImage src={r.image} alt="" fill sizes="64px" className="object-cover" /> : null}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/product/${r.slug}`}
                            target="_blank"
                            className="line-clamp-2 text-[15px] text-[#222] underline underline-offset-2"
                          >
                            {r.name}
                          </Link>
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.active ? "bg-[#F6C343] text-[#222]" : "bg-[#e5e5e5] text-[#555]"
                            }`}
                          >
                            {r.active ? "Active" : "Deactivated"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right text-[15px]">{r.views}</td>
                    <td className="px-3 py-4 text-right text-[15px]">{r.favourites}</td>
                    <td className="px-3 py-4 text-right text-[15px]">{r.orders}</td>
                    <td className="px-4 py-4 text-right text-[15px]">{money(r.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && sorted.length > limit ? (
          <div className="flex flex-col items-center gap-2 border-t border-[#ebe5da] py-4">
            <p className="text-xs text-navy-600">
              Showing {limit} of {sorted.length}
            </p>
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="rounded-full border border-[#222] px-6 py-2 text-sm font-medium"
            >
              Show more
            </button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-navy-500">
        Views count product page visits. Favourites count wishlist hearts (started tracking with this update). Orders
        and revenue count paid orders only.
      </p>
    </div>
  );
}
