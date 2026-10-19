"use client";

import { listingCategories } from "@/lib/listing-categories";
import type { ShopSale } from "@/lib/sales";
import { shopNowTree, type ShopNowChild } from "@/lib/shop-now-data";
import { useEffect, useMemo, useState } from "react";

function saleIsLive(sale: ShopSale) {
  const today = new Date().toISOString().slice(0, 10);
  return sale.startsAt.slice(0, 10) <= today && today <= sale.endsAt.slice(0, 10);
}

function categoryWithChildren(slug: string): Set<string> {
  const out = new Set([slug]);
  function collect(nodes: ShopNowChild[]) {
    for (const node of nodes) {
      out.add(node.slug);
      if (node.children) collect(node.children);
    }
  }
  function find(nodes: ShopNowChild[]): boolean {
    for (const node of nodes) {
      if (node.slug === slug) {
        collect(node.children ?? []);
        return true;
      }
      if (node.children && find(node.children)) return true;
    }
    return false;
  }
  find(shopNowTree.map((parent) => ({ slug: parent.slug, name: parent.name, children: parent.children })));
  return out;
}

type Listing = { id: string; slug: string; name: string; categories?: string[]; price?: number };

const COUNTRIES = ["Everywhere", "India", "United States", "United Kingdom", "United Arab Emirates", "Canada", "Australia", "Germany", "France"];

export function AdminSalePanel() {
  const [step, setStep] = useState<"home" | "customise" | "listings">("home");
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [percent, setPercent] = useState("25");
  const [region, setRegion] = useState("Everywhere");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [terms, setTerms] = useState("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [saleRes, productRes, categoryRes] = await Promise.all([
      fetch("/api/admin/sales").then((res) => res.json()).catch(() => ({})),
      fetch("/api/admin/products?pageSize=200").then((res) => res.json()).catch(() => ({})),
      fetch("/api/categories").then((res) => res.json()).catch(() => ({})),
    ]);
    setSales(Array.isArray(saleRes.items) ? saleRes.items : []);
    setListings(
      Array.isArray(productRes.items)
        ? productRes.items.map((item: Listing) => ({
            id: String(item.id),
            slug: String(item.slug),
            name: String(item.name),
            categories: Array.isArray(item.categories) ? item.categories.map(String) : [],
            price: Number(item.price),
          }))
        : []
    );
    const extras = Array.isArray(categoryRes.items)
      ? categoryRes.items
          .map((item: { slug?: string; name?: string }) => ({ slug: String(item.slug ?? ""), name: String(item.name ?? "") }))
          .filter((item: { slug: string; name: string }) => item.slug && item.name)
      : [];
    const base = listingCategories();
    setCategories([...base, ...extras.filter((item: { slug: string }) => !base.some((category) => category.slug === item.slug))]);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A parent category also covers every subcategory under it.
    const inCategory = category === "all" ? null : categoryWithChildren(category);
    return listings.filter((item) => {
      if (inCategory && !(item.categories ?? []).some((slug) => inCategory.has(slug))) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
    });
  }, [listings, category, query]);

  async function save() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          percent: Number(percent),
          region: region === "Everywhere" ? "everywhere" : region,
          startsAt,
          endsAt,
          terms,
          scope,
          productSlugs: picked,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save this sale.");
        return;
      }
      setStep("home");
      setName("");
      setTerms("");
      setPicked([]);
      setScope("all");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (step === "home") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-[#eee] bg-white p-6">
          <h2 className="font-serif text-2xl text-navy-900">Run a sale</h2>
          <p className="mt-2 max-w-xl text-sm text-navy-700">
            Set lower prices for your whole shop or just a few items, no code needed for the discount.
          </p>
          <button type="button" className="btn-gold mt-4 px-5 py-2 text-sm" onClick={() => setStep("customise")}>
            Set up
          </button>
        </div>
        {sales.length ? (
          <div className="overflow-hidden rounded-2xl border border-[#eee] bg-white">
            {sales.map((sale) => (
              <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3efe7] px-5 py-4 last:border-0">
                <div>
                  <p className="font-semibold text-navy-900">{sale.name}</p>
                  <p className="text-xs text-navy-600">
                    {sale.percent}% off · {sale.region === "everywhere" ? "Everywhere" : sale.region} · {sale.startsAt} to {sale.endsAt}
                    {saleIsLive(sale) ? " · Live" : ""}
                    {sale.scope === "all" ? " · All listings" : ` · ${sale.productSlugs.length} listings`}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700 underline"
                  onClick={() => {
                    if (!window.confirm(`Remove sale ${sale.name}?`)) return;
                    void fetch(`/api/admin/sales?id=${encodeURIComponent(sale.id)}`, { method: "DELETE" }).then(() => load());
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (step === "customise") {
    return (
      <form
        className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!/^[A-Za-z0-9]+$/.test(name.trim())) {
            setError("Sale name can use only letters and numbers.");
            return;
          }
          setStep("listings");
        }}
      >
        <h2 className="font-serif text-2xl text-navy-900">Customise your sale</h2>
        <p className="text-sm text-navy-700">
          Running a sale can help you clear out inventory, attract new customers, and encourage shoppers to spend more. The discount you offer is totally up to you.
        </p>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Discount amount</span>
          <span className="mt-1 block text-xs text-navy-600">Sellers that offered at least 25% off received more orders during their sale.</span>
          <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-navy-600">Percentage off</span>
          <input className="input mt-1 max-w-[8rem]" type="number" min={1} max={99} value={percent} onChange={(e) => setPercent(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Where is this offer valid?</span>
          <span className="mt-1 block text-xs text-navy-600">Everywhere updates shop and checkout prices. A single country is saved on the sale.</span>
          <select className="input mt-2" value={region} onChange={(e) => setRegion(e.target.value)}>
            {COUNTRIES.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-sm font-semibold text-navy-900">Sale duration</p>
          <p className="mt-1 text-xs text-navy-600">Sales can be set to run up to 30 days.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Duration start date
              <input className="input mt-1" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </label>
            <label className="text-xs">
              Duration end date
              <input className="input mt-1" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
            </label>
          </div>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Terms and conditions (if applicable)</span>
          <span className="mt-1 block text-xs text-navy-600">This info will show on eligible listings during your sale.</span>
          <textarea className="input mt-2 min-h-24" maxLength={500} value={terms} onChange={(e) => setTerms(e.target.value)} />
          <span className="mt-1 block text-xs text-navy-500">{500 - terms.length} characters remaining</span>
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Sale name</span>
          <span className="mt-1 block text-xs text-navy-600">Buyers won’t see this. Each name should be unique, and only use letters and numbers.</span>
          <input className="input mt-2" placeholder="Ex. SPRINGSALE" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-full bg-[#031D38] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0a3358]"
            onClick={() => setStep("home")}
          >
            Cancel
          </button>
          <button type="submit" className="btn-gold flex-1">Set up a sale</button>
        </div>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl text-navy-900">Which listings are included in your sale?</h2>
      <p className="text-sm text-navy-700">Your discount can apply shop-wide, or be limited to specific items.</p>
      <label className="flex gap-3 rounded-xl border border-[#eee] p-4 text-sm">
        <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />
        <span>
          <span className="block font-semibold">All listings</span>
          This sale is shop-wide, and includes all current and future listings.
        </span>
      </label>
      <label className="flex gap-3 rounded-xl border border-[#eee] p-4 text-sm">
        <input type="radio" checked={scope === "selected"} onChange={() => setScope("selected")} />
        <span>
          <span className="block font-semibold">Select listings</span>
          This sale is limited to specific listings.
        </span>
      </label>
      {scope === "selected" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Choose which listings to include ({picked.length} selected)</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" className={`shrink-0 rounded-full px-3 py-1 text-xs ${category === "all" ? "bg-[#031D38] text-white" : "border"}`} onClick={() => setCategory("all")}>
              All categories
            </button>
            {categories.map((item) => (
              <button key={item.slug} type="button" className={`shrink-0 rounded-full px-3 py-1 text-xs ${category === item.slug ? "bg-[#031D38] text-white" : "border"}`} onClick={() => setCategory(item.slug)}>
                {item.name}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Search for a specific listing" value={query} onChange={(e) => setQuery(e.target.value)} />
          {visible.length ? (
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                className="font-semibold text-[#8C6E28] underline"
                onClick={() => setPicked((current) => [...new Set([...current, ...visible.map((item) => item.slug)])])}
              >
                Select all {visible.length} shown
              </button>
              <button
                type="button"
                className="text-navy-600 underline"
                onClick={() => {
                  const shown = new Set(visible.map((item) => item.slug));
                  setPicked((current) => current.filter((slug) => !shown.has(slug)));
                }}
              >
                Clear shown
              </button>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-navy-600">Add some listings to get started</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border p-2">
              {visible.map((item) => {
                const checked = picked.includes(item.slug);
                return (
                  <label key={item.slug} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[#faf8f4]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setPicked((current) => (checked ? current.filter((slug) => slug !== item.slug) : [...current, item.slug]))}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-full bg-[#031D38] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0a3358]"
          onClick={() => setStep("customise")}
        >
          Go back
        </button>
        <button type="button" className="btn-gold flex-1" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Publish sale"}
        </button>
      </div>
    </div>
  );
}
