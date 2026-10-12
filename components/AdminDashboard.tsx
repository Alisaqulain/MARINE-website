"use client";

import { BrandLogo } from "@/components/Logo";
import {
  ExternalLink,
  Eye,
  LogOut,
  Menu,
  Package,
  Users,
  X,
  MessageSquare,
  FileText,
  RotateCcw,
  Star,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ProductImage } from "@/components/ProductImage";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AdminProductImagesField } from "@/components/AdminProductImageField";
import { listingCategories } from "@/lib/listing-categories";
import type { ListingImage } from "@/lib/listing-images";
import { imageAdjustStyle } from "@/lib/product-display";

type Panel = "customer" | "wholesale";

type Tab =
  | "overview"
  | "products"
  | "quotes"
  | "applications"
  | "contacts"
  | "returns"
  | "testimonials"
  | "users"
  | "visitors";

export function AdminDashboard() {
  const [panel, setPanel] = useState<Panel>("customer");
  const [tab, setTab] = useState<Tab>("overview");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.innerWidth >= 1024);
  }, []);
  const [quotes, setQuotes] = useState<Record<string, unknown>[]>([]);
  const [applications, setApplications] = useState<Record<string, unknown>[]>([]);
  const [contacts, setContacts] = useState<Record<string, unknown>[]>([]);
  const [returns, setReturns] = useState<Record<string, unknown>[]>([]);
  const [testimonials, setTestimonials] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState({
    total: 0,
    totalPages: 1,
    pageSize: 10,
  });
  const [productSearch, setProductSearch] = useState("");
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productCatalogTotal, setProductCatalogTotal] = useState(0);
  const emptyProductForm = () => ({
    name: "",
    sku: "",
    price: "",
    compareAt: "",
    wholesaleFrom: "",
    quantity: "",
    image: "",
    images: [] as ListingImage[],
    description: "",
    channel: "both" as const,
    freeShipping: true,
    categories: [] as string[],
    zoom: "100",
    brightness: "100",
    contrast: "100",
    colors: "",
    materials: "",
    sizes: "",
    personalisationPrice: "",
  });
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [categoryQuery, setCategoryQuery] = useState("");
  const [editing, setEditing] = useState<{ mongoId: string | null; slug: string } | null>(null);
  const [visitors, setVisitors] = useState<Record<string, unknown>[]>([]);
  const [visitorPage, setVisitorPage] = useState(1);
  const [visitorSummary, setVisitorSummary] = useState({ totalVisitors: 0, today: 0, last7Days: 0 });
  const [visitorPagination, setVisitorPagination] = useState({
    total: 0,
    totalPages: 1,
    pageSize: 25,
  });
  const [customerPage, setCustomerPage] = useState(1);
  const customerPageSize = 15;

  const load = useCallback(async () => {
    const segment = panel === "wholesale" ? "wholesale" : "customer";
    const channel = panel === "wholesale" ? "wholesale" : "retail";
    const [q, a, c, r, t, u, p] = await Promise.all([
      fetch("/api/quotes").then((x) => x.json()),
      fetch("/api/wholesale/application").then((x) => x.json()),
      fetch("/api/contact").then((x) => x.json()),
      fetch("/api/returns").then((x) => x.json()),
      fetch("/api/testimonials").then((x) => x.json()),
      fetch(`/api/admin/customers?segment=${segment}`).then((x) => x.json()),
      fetch(
        `/api/admin/products?channel=${channel}&page=${productPage}&pageSize=10${productSearch ? `&q=${encodeURIComponent(productSearch)}` : ""}`
      ).then((x) => x.json()),
    ]);
    setQuotes(q.items ?? []);
    setApplications(a.items ?? []);
    setContacts(c.items ?? []);
    setReturns(r.items ?? []);
    setTestimonials(t.items ?? []);
    setUsers(u.items ?? []);
    setProducts(p.items ?? []);
    setProductPagination(
      p.pagination ?? { total: p.items?.length ?? 0, totalPages: 1, pageSize: 10 }
    );
    if (typeof p.counts?.total === "number") setProductCatalogTotal(p.counts.total);
  }, [panel, productPage, productSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadVisitors = useCallback(async () => {
    const res = await fetch(`/api/admin/page-views?page=${visitorPage}&pageSize=25`);
    const data = await res.json();
    setVisitors(data.items ?? []);
    setVisitorSummary(data.summary ?? { totalVisitors: 0, today: 0, last7Days: 0 });
    setVisitorPagination(data.pagination ?? { total: 0, totalPages: 1, pageSize: 25 });
  }, [visitorPage]);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  useEffect(() => {
    setProductPage(1);
  }, [panel, productSearch]);

  useEffect(() => {
    setCustomerPage(1);
  }, [panel, users.length]);

  const customerTotalPages = Math.max(1, Math.ceil(users.length / customerPageSize));
  const pagedCustomers = users.slice(
    (customerPage - 1) * customerPageSize,
    customerPage * customerPageSize
  );

  const nav: { id: Tab; label: string; icon: typeof Package }[] =
    panel === "wholesale"
      ? [
          { id: "overview", label: "Overview", icon: Package },
          { id: "products", label: "Products", icon: Package },
          { id: "users", label: "Customers", icon: Users },
          { id: "quotes", label: "Bulk quotes", icon: FileText },
          { id: "applications", label: "Trade accounts", icon: Users },
          { id: "contacts", label: "Contact", icon: MessageSquare },
          { id: "testimonials", label: "Reviews", icon: Star },
        ]
      : [
          { id: "overview", label: "Overview", icon: Package },
          { id: "products", label: "Products", icon: Package },
          { id: "users", label: "Customers", icon: Users },
          { id: "contacts", label: "Contact", icon: MessageSquare },
          { id: "returns", label: "Returns", icon: RotateCcw },
          { id: "testimonials", label: "Reviews", icon: Star },
          { id: "visitors", label: "Website visitors", icon: Eye },
        ];

  function productPayload() {
    return {
      ...productForm,
      slug: editing?.slug,
      channel: panel === "wholesale" ? "wholesale" : "retail",
      price: productForm.price,
      compareAt: productForm.compareAt,
      wholesaleFrom: productForm.wholesaleFrom,
      quantity: productForm.quantity,
      image: productForm.images[0]?.url ?? productForm.image,
      images: productForm.images,
      freeShipping: productForm.freeShipping,
      categories: productForm.categories,
      zoom: productForm.zoom,
      brightness: productForm.brightness,
      contrast: productForm.contrast,
      colors: productForm.colors,
      materials: productForm.materials,
      sizes: productForm.sizes,
      personalisationPrice: productForm.personalisationPrice,
    };
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    const payload = productPayload();

    if (editing?.mongoId) {
      await fetch(`/api/admin/products/${editing.mongoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setProductForm(emptyProductForm());
    setEditing(null);
    void load();
  }

  function startEdit(p: Record<string, unknown>) {
    const source = String(p.source ?? "catalog");
    const mongoId = source === "mongodb" ? String(p.id) : null;
    setEditing({ mongoId, slug: String(p.slug) });
    setProductForm({
      name: String(p.name ?? ""),
      sku: String(p.sku ?? ""),
      price: String(p.price ?? ""),
      compareAt: p.compareAt != null && p.compareAt !== "" ? String(p.compareAt) : "",
      wholesaleFrom: p.wholesaleFrom != null ? String(p.wholesaleFrom) : "",
      quantity: p.quantity != null ? String(p.quantity) : "",
      image: String(p.image ?? ""),
      images: Array.isArray(p.images)
        ? (p.images as ListingImage[]).map((image) => ({
            url: String(image?.url ?? ""),
            name: String(image?.name ?? ""),
            color: String(image?.color ?? ""),
            text: String(image?.text ?? ""),
          })).filter((image) => image.url)
        : p.image
          ? [{ url: String(p.image), name: "", color: "", text: "" }]
          : [],
      description: String(p.description ?? ""),
      channel: "both",
      freeShipping: p.freeShipping !== false,
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
      zoom: String((p.imageAdjust as { zoom?: number } | undefined)?.zoom ?? 100),
      brightness: String((p.imageAdjust as { brightness?: number } | undefined)?.brightness ?? 100),
      contrast: String((p.imageAdjust as { contrast?: number } | undefined)?.contrast ?? 100),
      colors: Array.isArray(p.colors) ? p.colors.join(", ") : "",
      materials: Array.isArray(p.materials) ? p.materials.join(", ") : "",
      sizes: Array.isArray(p.sizes) ? p.sizes.join(", ") : "",
      personalisationPrice:
        p.personalisationPrice != null && p.personalisationPrice !== ""
          ? String(p.personalisationPrice)
          : "",
    });
  }

  async function deleteProduct(p: Record<string, unknown>) {
    if (String(p.source) !== "mongodb") {
      window.alert("Catalog items cannot be deleted. Edit and save to override, or remove the MongoDB copy only.");
      return;
    }
    if (!window.confirm(`Delete “${p.name}” from the database?`)) return;
    await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (editing?.mongoId === String(p.id)) {
      setEditing(null);
      setProductForm(emptyProductForm());
    }
    void load();
  }

  return (
    <div className="min-h-screen bg-[#F4F1EA]">
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[260px] flex-col overflow-hidden bg-[#031D38] text-white transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative shrink-0 border-b border-white/10 px-5 py-5 pr-12">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <Link href="/" className="block">
            <BrandLogo size="admin" priority />
          </Link>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#C9A84C]">Admin</p>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1 text-xs">
            <button
              type="button"
              className={`rounded-md py-1.5 ${panel === "customer" ? "bg-[#C9A84C] text-[#031D38]" : "text-white/80"}`}
              onClick={() => {
                setPanel("customer");
                setTab("overview");
              }}
            >
              Customer
            </button>
            <button
              type="button"
              className={`rounded-md py-1.5 ${panel === "wholesale" ? "bg-[#C9A84C] text-[#031D38]" : "text-white/80"}`}
              onClick={() => {
                setPanel("wholesale");
                setTab("overview");
              }}
            >
              Wholesale
            </button>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                if (window.innerWidth < 1024) setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                tab === item.id ? "bg-white/10 text-[#C9A84C]" : "text-white/80 hover:bg-white/5"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#031D38] p-4 text-xs text-white/60">
          <Link href="/" className="inline-flex items-center gap-1.5 hover:text-[#C9A84C]">
            <ExternalLink className="h-3.5 w-3.5" />
            View storefront
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/admin/login" })}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-white/80 hover:bg-white/5 hover:text-[#C9A84C]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      <div
        className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ${open ? "lg:pl-[260px]" : ""}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#e6dfd2] bg-white px-4 py-3 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {!open ? (
              <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu className="h-6 w-6 shrink-0 text-navy-900" />
              </button>
            ) : null}
            <h1 className="min-w-0 font-serif text-xl text-navy-900 capitalize">
              {panel} · {nav.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="text-sm text-[#8C6E28] underline" onClick={() => void load()}>
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/admin/login" })}
              className="inline-flex items-center gap-1.5 rounded-full border border-navy-800/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-900 hover:bg-navy-900 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {tab === "overview" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Products" value={String(productCatalogTotal)} />
              <Stat label="Website visitors" value={String(visitorSummary.totalVisitors)} />
              <Stat label="Contacts" value={String(contacts.length)} />
              {panel === "wholesale" ? (
                <>
                  <Stat label="Quotes" value={String(quotes.length)} />
                  <Stat label="Trade apps" value={String(applications.length)} />
                </>
              ) : (
                <>
                  <Stat label="Customers" value={String(users.length)} />
                  <Stat label="Returns" value={String(returns.length)} />
                </>
              )}
            </div>
          ) : null}

          {tab === "products" ? (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b bg-[#FAF7F2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-navy-600">
                    Live catalogue from the shop plus MongoDB overrides ({productPagination.total} products).
                  </p>
                  <form
                    className="flex w-full max-w-md gap-2 sm:w-auto"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setProductSearch(productSearchInput.trim());
                    }}
                  >
                    <input
                      className="input min-h-9 flex-1 py-1.5 text-sm"
                      placeholder="Search name, SKU, slug…"
                      value={productSearchInput}
                      onChange={(e) => setProductSearchInput(e.target.value)}
                    />
                    <button type="submit" className="btn-gold shrink-0 px-4 py-1.5 text-xs">
                      Search
                    </button>
                    {productSearch ? (
                      <button
                        type="button"
                        className="btn-outline shrink-0 px-3 py-1.5 text-xs"
                        onClick={() => {
                          setProductSearch("");
                          setProductSearchInput("");
                        }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </form>
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
                    <tr>
                      <th className="px-4 py-3">Image</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Sale $</th>
                      <th className="px-4 py-3">Regular $</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-navy-600">
                          No products loaded. Check MongoDB connection on /test
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => (
                        <tr key={String(p.id)} className="border-b border-[#f0ebe3]">
                          <td className="px-4 py-2">
                            {p.image ? (
                              <div className="relative h-10 w-10 overflow-hidden rounded bg-[#f4f1ea]">
                                <ProductImage
                                  src={String(p.image)}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                />
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium">{String(p.name)}</td>
                          <td className="px-4 py-3 text-navy-600">{String(p.sku)}</td>
                          <td className="px-4 py-3">${String(p.price)}</td>
                          <td className="px-4 py-3 text-navy-600">
                            {p.compareAt != null && p.compareAt !== "" ? `$${String(p.compareAt)}` : "—"}
                          </td>
                          <td className="px-4 py-3">{p.quantity != null && p.quantity !== "" ? String(p.quantity) : "—"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                p.source === "mongodb"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-[#F4EBD2] text-[#7A5C12]"
                              }`}
                            >
                              {String(p.source ?? "catalog")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="text-xs font-semibold text-[#8C6E28] underline"
                                onClick={() => startEdit(p)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-700 underline"
                                onClick={() => void deleteProduct(p)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <AdminListPagination
                  className="border-t bg-[#FAF7F2] px-4 py-3"
                  page={productPagination.totalPages ? productPage : 0}
                  totalPages={productPagination.totalPages}
                  summary={
                    <>
                      Page {productPagination.totalPages ? productPage : 0} of {productPagination.totalPages} ·{" "}
                      {productPagination.total} products
                    </>
                  }
                  onPageChange={setProductPage}
                />
              </div>
              <form onSubmit={saveProduct} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
                <h2 className="font-serif text-lg">{editing ? "Edit product" : "Add product"}</h2>
                {editing ? (
                  <p className="text-xs text-navy-600">
                    {editing.mongoId
                      ? "Updating saved product."
                      : "Saving will store your changes in MongoDB (overrides catalogue item)."}
                  </p>
                ) : null}
                <AdminProductImagesField
                  images={productForm.images}
                  onChange={(images) =>
                    setProductForm((form) => ({ ...form, images, image: images[0]?.url ?? "" }))
                  }
                />
                <input
                  className="input"
                  placeholder="Product name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
                <input
                  className="input"
                  placeholder="SKU (optional)"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs">
                    <span className="mb-1 block text-navy-600">Sale price ($)</span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block text-navy-600">Regular price ($)</span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="Shows as discount"
                      value={productForm.compareAt}
                      onChange={(e) => setProductForm({ ...productForm, compareAt: e.target.value })}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-navy-500">
                  If regular price is higher than sale price, the shop can show a discount (was / now).
                </p>
                {panel === "wholesale" ? (
                  <input
                    className="input"
                    placeholder="Wholesale from ($)"
                    type="number"
                    step="0.01"
                    value={productForm.wholesaleFrom}
                    onChange={(e) => setProductForm({ ...productForm, wholesaleFrom: e.target.value })}
                  />
                ) : null}
                <label className="block text-xs">
                  <span className="mb-1 block text-navy-600">Quantity in stock</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 100"
                    value={productForm.quantity}
                    onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                  />
                  <span className="mt-1 block text-[10px] text-navy-500">
                    5 or fewer shows “Low in stock, only 2 left” on the shop.
                  </span>
                </label>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Categories
                  </legend>
                  <p className="text-[10px] text-navy-500">
                    Every category and subcategory. Tag the ones this product should appear in, for both customer and wholesale.
                  </p>
                  <input
                    className="input text-sm"
                    placeholder="Search categories"
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                  />
                  <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-[#e6dfd2] p-2">
                    {listingCategories()
                      .filter((category) => {
                        const q = categoryQuery.trim().toLowerCase();
                        if (!q) return true;
                        return category.name.toLowerCase().includes(q) || category.slug.includes(q);
                      })
                      .map((category) => {
                      const checked = productForm.categories.includes(category.slug);
                      return (
                        <label key={category.slug} className="flex items-start gap-2 text-xs text-navy-800">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() =>
                              setProductForm((form) => ({
                                ...form,
                                categories: checked
                                  ? form.categories.filter((slug) => slug !== category.slug)
                                  : [...form.categories, category.slug],
                              }))
                            }
                          />
                          <span>{category.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-navy-500">{listingCategories().length} categories</p>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Listing image
                  </legend>
                  {(
                    [
                      ["zoom", "Zoom", 50, 160],
                      ["brightness", "Brightness", 40, 160],
                      ["contrast", "Contrast", 40, 160],
                    ] as const
                  ).map(([key, label, min, max]) => (
                    <label key={key} className="block text-xs text-navy-700">
                      <span className="mb-1 flex justify-between">
                        {label}
                        <span>{productForm[key]}%</span>
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={productForm[key]}
                        onChange={(e) => setProductForm({ ...productForm, [key]: e.target.value })}
                        className="w-full"
                      />
                    </label>
                  ))}
                  {(productForm.images.length
                    ? productForm.images
                    : productForm.image
                      ? [{ url: productForm.image, name: "", color: "", text: "" }]
                      : []
                  ).length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(productForm.images.length
                        ? productForm.images
                        : [{ url: productForm.image, name: "", color: "", text: "" }]
                      ).map((image, index) => (
                        <div key={`${image.url}-${index}`} className="space-y-1">
                          <div className="relative h-24 overflow-hidden rounded-lg bg-[#f5f5f5]">
                            <img
                              src={image.url}
                              alt={image.name || `Image ${index + 1}`}
                              className="h-full w-full object-cover"
                              style={imageAdjustStyle({
                                zoom: Number(productForm.zoom),
                                brightness: Number(productForm.brightness),
                                contrast: Number(productForm.contrast),
                              })}
                            />
                            {image.text ? (
                              <span className="pointer-events-none absolute inset-x-1 top-1 text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
                                {image.text}
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-[10px] text-navy-600">
                            {image.name || `Image ${index + 1}`}
                            {image.color ? ` · ${image.color}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </fieldset>
                <label className="block text-xs">
                  <span className="mb-1 block text-navy-600">Personalisation charge ($)</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 5"
                    value={productForm.personalisationPrice}
                    onChange={(e) => setProductForm({ ...productForm, personalisationPrice: e.target.value })}
                  />
                  <span className="mt-1 block text-[10px] text-navy-500">
                    Buyers choose No Personalisation or Yes Personalisation. Yes adds this amount and asks for a message. Leave blank to hide it.
                  </span>
                </label>
                {(
                  [
                    ["colors", "Primary colors", "Antique brass, Black, Gold"],
                    ["materials", "Materials", "Brass, Leather, Wood"],
                    ["sizes", "Sizes", "Small, Medium, Large"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key} className="block text-xs">
                    <span className="mb-1 block text-navy-600">{label}</span>
                    <input
                      className="input"
                      placeholder={placeholder}
                      value={productForm[key]}
                      onChange={(e) => setProductForm({ ...productForm, [key]: e.target.value })}
                    />
                    <span className="mt-1 block text-[10px] text-navy-500">
                      {key === "colors"
                        ? "Extra colors, separated by commas. A color typed on an image also appears here and shows that photo."
                        : "Separate choices with commas. Buyers pick one on the product page."}
                    </span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-navy-800">
                  <input
                    type="checkbox"
                    checked={productForm.freeShipping}
                    onChange={(e) => setProductForm({ ...productForm, freeShipping: e.target.checked })}
                  />
                  FREE shipping (show badge on retail shop cards)
                </label>
                <textarea
                  className="input min-h-20"
                  placeholder="Description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
                <div className="flex gap-2">
                  {editing ? (
                    <button
                      type="button"
                      className="btn-outline flex-1"
                      onClick={() => {
                        setEditing(null);
                        setProductForm(emptyProductForm());
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button type="submit" className="btn-gold flex-1">
                    {editing ? "Update product" : "Save product"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {tab === "quotes" ? (
            <AdminDataTable
              rows={quotes}
              columns={["email", "product", "quantity", "requiredDeliveryDate", "status", "createdAt"]}
              deletePath={(id) => `/api/quotes/${id}`}
              onReload={load}
            />
          ) : null}
          {tab === "applications" ? (
            <TradeAccountsPanel rows={applications} onReload={load} />
          ) : null}
          {tab === "contacts" ? (
            <AdminDataTable
              rows={contacts}
              columns={["kind", "name", "email", "subject", "createdAt"]}
              deletePath={(id) => `/api/contact/${id}`}
              onReload={load}
            />
          ) : null}
          {tab === "returns" ? (
            <AdminDataTable
              rows={returns}
              columns={["orderNumber", "customerName", "productName", "status", "createdAt"]}
              deletePath={(id) => `/api/returns/${id}`}
              onReload={load}
            />
          ) : null}
          {tab === "users" ? (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
                {panel === "wholesale" ? "Wholesale customers" : "Retail customers"} ({users.length} total)
              </div>
              <AdminDataTable
                rows={pagedCustomers}
                columns={["name", "email", "role", "createdAt"]}
                deletePath={(id) => `/api/admin/customers/${id}`}
                onReload={load}
              />
              <AdminListPagination
                className="border-t px-4 py-3"
                page={customerPage}
                totalPages={customerTotalPages}
                summary={
                  <>
                    Page {customerPage} of {customerTotalPages}
                  </>
                }
                onPageChange={setCustomerPage}
                compact
              />
            </div>
          ) : null}
          {tab === "testimonials" ? (
            <AdminReviewsPanel
              rows={testimonials}
              onReload={() => void load()}
              onDelete={(id) => void deleteRow(`/api/testimonials/${id}`, load)}
            />
          ) : null}
          {tab === "visitors" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Website visitors" value={String(visitorSummary.totalVisitors)} />
                <Stat label="Today" value={String(visitorSummary.today)} />
                <Stat label="Last 7 days" value={String(visitorSummary.last7Days)} />
              </div>
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
                  Each row is one website visitor. Repeat page opens from the same browser are counted together.
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
                    <tr>
                      <th className="px-4 py-3">Last visit</th>
                      <th className="px-4 py-3">First visit</th>
                      <th className="px-4 py-3">Visits</th>
                      <th className="px-4 py-3">Pages</th>
                      <th className="px-4 py-3">Last page</th>
                      <th className="px-4 py-3">Device</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-navy-600">
                          No website visitors recorded yet.
                        </td>
                      </tr>
                    ) : (
                      visitors.map((v) => (
                        <tr key={String(v.id)} className="border-b border-[#f0ebe3]">
                          <td className="whitespace-nowrap px-4 py-3 text-navy-600">{formatVisit(v.lastAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-navy-600">{formatVisit(v.firstAt)}</td>
                          <td className="px-4 py-3 font-medium">{String(v.visits ?? 0)}</td>
                          <td className="px-4 py-3">{String(v.pages ?? 0)}</td>
                          <td className="max-w-[220px] truncate px-4 py-3">{String(v.lastPath ?? "—")}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-navy-600">{String(v.device ?? "Unknown")}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700 underline"
                              onClick={() =>
                                void deleteRow(`/api/admin/page-views/${encodeURIComponent(String(v.id))}`, loadVisitors)
                              }
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <AdminListPagination
                  className="border-t px-4 py-3"
                  page={visitorPage}
                  totalPages={visitorPagination.totalPages}
                  summary={
                    <>
                      Page {visitorPage} of {visitorPagination.totalPages} · {visitorPagination.total} visitors
                    </>
                  }
                  onPageChange={setVisitorPage}
                  compact
                />
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function AdminListPagination({
  page,
  totalPages,
  summary,
  onPageChange,
  className = "",
  compact = false,
}: {
  page: number;
  totalPages: number;
  summary: ReactNode;
  onPageChange: (page: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const [goTo, setGoTo] = useState(String(page));
  const maxPage = Math.max(1, totalPages);

  useEffect(() => {
    setGoTo(String(page));
  }, [page]);

  function jump(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(goTo, 10);
    if (!Number.isFinite(n)) return;
    onPageChange(Math.min(maxPage, Math.max(1, n)));
  }

  const btn = compact
    ? "btn-outline px-3 py-1 text-xs disabled:opacity-40"
    : "rounded border border-[#e8dfd0] bg-white px-3 py-1.5 disabled:opacity-40";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-xs text-navy-600 ${className}`}
    >
      <span>{summary}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={page <= 1 || totalPages < 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>
        <form onSubmit={jump} className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="admin-page-jump">
            Go to page
          </label>
          <input
            id="admin-page-jump"
            type="number"
            min={1}
            max={maxPage}
            value={goTo}
            onChange={(e) => setGoTo(e.target.value)}
            className="w-14 rounded border border-[#e8dfd0] bg-white px-2 py-1 text-center text-xs text-navy-900"
          />
          <span className="whitespace-nowrap text-navy-500">of {totalPages || 1}</span>
          <button type="submit" className={btn} disabled={totalPages < 1}>
            Go
          </button>
        </form>
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages || totalPages < 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function formatVisit(value: unknown) {
  const raw = String(value ?? "");
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-navy-500">{label}</p>
      <p className="mt-2 font-serif text-3xl text-navy-900">{value}</p>
    </div>
  );
}

function AdminReviewsPanel({
  rows,
  onReload,
  onDelete,
}: {
  rows: Record<string, unknown>[];
  onReload: () => void;
  onDelete: (id: string) => void;
}) {
  if (!rows.length) return <p className="text-sm text-navy-600">No reviews yet.</p>;

  async function patch(id: string, body: { showOnHome?: boolean; published?: boolean }) {
    await fetch(`/api/testimonials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onReload();
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <p className="border-b bg-[#FAF7F2] px-4 py-2 text-xs text-navy-600">
        Toggle &quot;Show on home&quot; to control which reviews appear on the homepage.
      </p>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Show on home</th>
            <th className="px-4 py-3">Published</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = String(row.id ?? "");
            const showOnHome = row.showOnHome !== false;
            const published = row.published !== false;
            return (
              <tr key={id} className="border-b border-[#f0ebe3]">
                <td className="max-w-xs truncate px-4 py-3 font-medium">{String(row.title ?? "")}</td>
                <td className="px-4 py-3">
                  {String(row.name ?? "")}
                  {row.location ? ` · ${String(row.location)}` : ""}
                </td>
                <td className="max-w-[10rem] truncate px-4 py-3 text-navy-600">{String(row.product ?? "")}</td>
                <td className="px-4 py-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={showOnHome}
                      onChange={(e) => void patch(id, { showOnHome: e.target.checked })}
                    />
                    {showOnHome ? "Visible" : "Hidden"}
                  </label>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={(e) => void patch(id, { published: e.target.checked })}
                    />
                    {published ? "Yes" : "No"}
                  </label>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-700 underline"
                    onClick={() => onDelete(id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function deleteRow(url: string, onDone: () => void) {
  if (!confirm("Delete this record permanently?")) return;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(typeof data.error === "string" ? data.error : "Delete failed");
    return;
  }
  onDone();
}

function AdminDataTable({
  rows,
  columns,
  deletePath,
  onReload,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  deletePath?: (id: string) => string;
  onReload: () => void;
}) {
  if (!rows.length) return <p className="text-sm text-navy-600">No records yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3">
                {c}
              </th>
            ))}
            {deletePath ? <th className="px-4 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)} className="border-b border-[#f0ebe3]">
              {columns.map((c) => (
                <td key={c} className="max-w-xs truncate px-4 py-3">
                  {String(row[c] ?? "")}
                </td>
              ))}
              {deletePath ? (
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-700 underline"
                    onClick={() => void deleteRow(deletePath(String(row.id)), onReload)}
                  >
                    Delete
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeAccountsPanel({
  rows,
  onReload,
}: {
  rows: Record<string, unknown>[];
  onReload: () => void;
}) {
  if (!rows.length) return <p className="text-sm text-navy-600">No trade applications yet.</p>;

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
          <tr>
            {[
              "company",
              "contact",
              "email",
              "phone",
              "businessType",
              "taxId",
              "productInterest",
              "createdAt",
            ].map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-3">
                {c}
              </th>
            ))}
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = String(row.id);
            return (
              <tr key={id} className="border-b border-[#f0ebe3] align-top">
                <td className="max-w-[140px] px-3 py-3">{String(row.company ?? "")}</td>
                <td className="px-3 py-3">{String(row.contact ?? "")}</td>
                <td className="max-w-[160px] truncate px-3 py-3">{String(row.email ?? "")}</td>
                <td className="whitespace-nowrap px-3 py-3">{String(row.phone ?? "")}</td>
                <td className="px-3 py-3">{String(row.businessType ?? "")}</td>
                <td className="px-3 py-3">{String(row.taxId ?? "")}</td>
                <td className="max-w-[180px] px-3 py-3 text-xs">{String(row.productInterest ?? "")}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-navy-600">{String(row.createdAt ?? "")}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-700 underline"
                    onClick={() => void deleteRow(`/api/wholesale/application/${id}`, onReload)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
