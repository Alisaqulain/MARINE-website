"use client";

import { ProductImage } from "@/components/ProductImage";
import { listingCategories } from "@/lib/listing-categories";
import type { ShopSale } from "@/lib/sales";
import { shopNowTree, type ShopNowChild } from "@/lib/shop-now-data";
import { useEffect, useMemo, useState } from "react";

function saleIsLive(sale: ShopSale) {
  const today = new Date().toISOString().slice(0, 10);
  return sale.startsAt.slice(0, 10) <= today && today <= sale.endsAt.slice(0, 10);
}

function saleIsPast(sale: ShopSale) {
  return sale.endsAt.slice(0, 10) < new Date().toISOString().slice(0, 10);
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

type Listing = { id: string; slug: string; name: string; categories?: string[]; price?: number; image?: string };

const COUNTRIES = ["Everywhere", "India", "United States", "United Kingdom", "United Arab Emirates", "Canada", "Australia", "Germany", "France"];

const emptyForm = () => ({
  percent: "25",
  region: "Everywhere",
  startsAt: "",
  endsAt: "",
  terms: "",
  name: "",
  scope: "all" as "all" | "selected",
  picked: [] as string[],
});

/** Sales are separate per shop: the customer panel runs B2C sales, the wholesale panel B2B sales. */
export function AdminSalePanel({ channel }: { channel: "retail" | "wholesale" }) {
  const shopLabel = channel === "wholesale" ? "wholesale (B2B)" : "customer (B2C)";
  const [step, setStep] = useState<"home" | "customise" | "listings">("home");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSales() {
    const saleRes = await fetch(`/api/admin/sales?channel=${channel}`, { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => ({}));
    setSales(Array.isArray(saleRes.items) ? saleRes.items : []);
    setSalesLoading(false);
  }

  async function load() {
    void loadSales();
    const [productRes, categoryRes] = await Promise.all([
      fetch(`/api/admin/products?pageSize=1000&sort=newest&channel=${channel}`).then((res) => res.json()).catch(() => ({})),
      fetch("/api/categories").then((res) => res.json()).catch(() => ({})),
    ]);
    setListings(
      Array.isArray(productRes.items)
        ? productRes.items.map((item: Listing & { image?: string }) => ({
            id: String(item.id),
            slug: String(item.slug),
            name: String(item.name),
            categories: Array.isArray(item.categories) ? item.categories.map(String) : [],
            price: Number(item.price),
            image: item.image ? String(item.image) : undefined,
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
    const inCategory = category === "all" ? null : categoryWithChildren(category);
    return listings.filter((item) => {
      if (inCategory && !(item.categories ?? []).some((slug) => inCategory.has(slug))) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
    });
  }, [listings, category, query]);

  const listingName = (slug: string) => listings.find((item) => item.slug === slug)?.name ?? slug;

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setStep("customise");
  }

  function startEdit(sale: ShopSale) {
    setEditingId(sale.id);
    setForm({
      percent: String(sale.percent),
      region: sale.region === "everywhere" ? "Everywhere" : sale.region,
      startsAt: sale.startsAt.slice(0, 10),
      endsAt: sale.endsAt.slice(0, 10),
      terms: sale.terms,
      name: sale.name,
      scope: sale.scope,
      picked: [...sale.productSlugs],
    });
    setError("");
    setStep("customise");
  }

  async function save() {
    setError("");
    setBusy(true);
    try {
      const payload = {
        id: editingId || undefined,
        name: form.name,
        percent: Number(form.percent),
        region: form.region === "Everywhere" ? "everywhere" : form.region,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        terms: form.terms,
        scope: form.scope,
        productSlugs: form.picked,
        channel,
      };
      const res = await fetch("/api/admin/sales", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save this sale.");
        return;
      }
      setStep("home");
      setEditingId(null);
      setForm(emptyForm());
      await loadSales();
    } finally {
      setBusy(false);
    }
  }

  if (step === "home") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-[#eee] bg-white p-6">
          <h2 className="font-serif text-2xl text-navy-900">Run a sale · {channel === "wholesale" ? "Wholesale" : "Customer"}</h2>
          <p className="mt-2 max-w-xl text-sm text-navy-700">
            Set lower prices in the {shopLabel} shop for all items or just a few. Sales here do not change the
            {channel === "wholesale" ? " customer" : " wholesale"} shop.
          </p>
          <button type="button" className="btn-gold mt-4 px-5 py-2 text-sm" onClick={startCreate}>
            Set up
          </button>
        </div>
        {salesLoading ? (
          <p className="rounded-2xl border border-[#eee] bg-white px-5 py-6 text-sm text-navy-600">Loading sales…</p>
        ) : (
          [
            { title: "Current & upcoming sales", items: sales.filter((sale) => !saleIsPast(sale)), empty: "No current sale." },
            { title: "Past sales", items: sales.filter(saleIsPast), empty: "No past sales." },
          ].map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-600">
                {group.title} ({group.items.length})
              </h3>
              {group.items.length ? (
                <div className="overflow-hidden rounded-2xl border border-[#eee] bg-white">
                  {group.items.map((sale) => (
              <div key={sale.id} className="border-b border-[#f3efe7] px-5 py-4 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy-900">{sale.name}</p>
                    <p className="text-xs text-navy-600">
                      {sale.percent}% off · {sale.region === "everywhere" ? "Everywhere" : sale.region} · {sale.startsAt} to{" "}
                      {sale.endsAt}
                      {saleIsLive(sale) ? " · Live" : saleIsPast(sale) ? " · Ended" : " · Upcoming"}
                      {sale.channel === "both" ? " · Customer & wholesale" : ""}
                      {sale.scope === "all" ? " · All listings" : ` · ${sale.productSlugs.length} listings`}
                    </p>
                    {sale.scope === "selected" && sale.productSlugs.length ? (
                      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-navy-800">
                        {sale.productSlugs.map((slug) => (
                          <li key={slug} className="truncate">
                            · {listingName(slug)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button type="button" className="text-xs font-semibold text-[#8C6E28] underline" onClick={() => startEdit(sale)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700 underline"
                      onClick={() => {
                        if (!window.confirm(`Remove sale ${sale.name}?`)) return;
                        void fetch(`/api/admin/sales?id=${encodeURIComponent(sale.id)}`, { method: "DELETE" }).then(() => loadSales());
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#e6dfd2] bg-white px-5 py-4 text-sm text-navy-600">
                  {group.empty}
                </p>
              )}
            </section>
          ))
        )}
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
          if (!/^[A-Za-z0-9]+$/.test(form.name.trim())) {
            setError("Sale name can use only letters and numbers.");
            return;
          }
          setStep("listings");
        }}
      >
        <h2 className="font-serif text-2xl text-navy-900">{editingId ? "Edit sale" : "Customise your sale"}</h2>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Discount amount</span>
          <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-navy-600">Percentage off</span>
          <input
            className="input mt-1 max-w-[8rem]"
            type="number"
            min={1}
            max={99}
            value={form.percent}
            onChange={(e) => setForm({ ...form, percent: e.target.value })}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Where is this offer valid?</span>
          <select className="input mt-2" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
            {COUNTRIES.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-sm font-semibold text-navy-900">Sale duration</p>
          <p className="mt-1 text-xs text-navy-600">Sales can run up to 30 days. Countdown on the shop shows hours:minutes:seconds.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Duration start date
              <input
                className="input mt-1"
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </label>
            <label className="text-xs">
              Duration end date
              <input
                className="input mt-1"
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </label>
          </div>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Terms and conditions (if applicable)</span>
          <textarea
            className="input mt-2 min-h-24"
            maxLength={500}
            value={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-navy-900">Sale name</span>
          <input
            className="input mt-2"
            placeholder="Ex. SPRINGSALE"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={Boolean(editingId)}
          />
          {editingId ? <span className="mt-1 block text-xs text-navy-500">Sale name cannot change when editing.</span> : null}
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-full bg-[#031D38] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0a3358]"
            onClick={() => {
              setStep("home");
              setEditingId(null);
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn-gold flex-1">
            Continue
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl text-navy-900">Which listings are included in your sale?</h2>
      <p className="text-sm text-navy-700">
        {listings.length} products available. Your discount can apply shop-wide, or be limited to specific items.
      </p>
      <label className="flex gap-3 rounded-xl border border-[#eee] p-4 text-sm">
        <input type="radio" checked={form.scope === "all"} onChange={() => setForm({ ...form, scope: "all" })} />
        <span>
          <span className="block font-semibold">All listings</span>
          This sale is shop-wide, and includes all current and future listings.
        </span>
      </label>
      <label className="flex gap-3 rounded-xl border border-[#eee] p-4 text-sm">
        <input type="radio" checked={form.scope === "selected"} onChange={() => setForm({ ...form, scope: "selected" })} />
        <span>
          <span className="block font-semibold">Select listings</span>
          This sale is limited to specific listings.
        </span>
      </label>
      {form.scope === "selected" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            Choose which listings to include ({form.picked.length} selected · {visible.length} shown of {listings.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${category === "all" ? "bg-[#031D38] text-white" : "border"}`}
              onClick={() => setCategory("all")}
            >
              All categories
            </button>
            {categories.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${category === item.slug ? "bg-[#031D38] text-white" : "border"}`}
                onClick={() => setCategory(item.slug)}
              >
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
                onClick={() => setForm((current) => ({ ...current, picked: [...new Set([...current.picked, ...visible.map((item) => item.slug)])] }))}
              >
                Select all {visible.length} shown
              </button>
              <button
                type="button"
                className="text-navy-600 underline"
                onClick={() => {
                  const shown = new Set(visible.map((item) => item.slug));
                  setForm((current) => ({ ...current, picked: current.picked.filter((slug) => !shown.has(slug)) }));
                }}
              >
                Clear shown
              </button>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-navy-600">Add some listings to get started</p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto rounded-xl border p-2">
              {visible.map((item) => {
                const checked = form.picked.includes(item.slug);
                return (
                  <label key={item.slug} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[#faf8f4]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          picked: checked ? current.picked.filter((slug) => slug !== item.slug) : [...current.picked, item.slug],
                        }))
                      }
                    />
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#f3efe7]">
                      {item.image ? (
                        <ProductImage src={item.image} alt="" fill sizes="48px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 break-words leading-snug">{item.name}</span>
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
          {busy ? "Saving…" : editingId ? "Update sale" : "Publish sale"}
        </button>
      </div>
    </div>
  );
}
