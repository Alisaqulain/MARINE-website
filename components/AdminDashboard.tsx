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
import { AdminProductImageField } from "@/components/AdminProductImageField";

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
    description: "",
    channel: "both" as const,
    freeShipping: true,
  });
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [editing, setEditing] = useState<{ mongoId: string | null; slug: string } | null>(null);
  const [visitors, setVisitors] = useState<Record<string, unknown>[]>([]);
  const [visitorPage, setVisitorPage] = useState(1);
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

  useEffect(() => {
    if (tab !== "visitors") return;
    void (async () => {
      const res = await fetch(`/api/admin/page-views?page=${visitorPage}&pageSize=25`);
      const data = await res.json();
      setVisitors(data.items ?? []);
      setVisitorPagination(
        data.pagination ?? { total: 0, totalPages: 1, pageSize: 25 }
      );
    })();
  }, [tab, visitorPage]);

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
          { id: "visitors", label: "Page visitors", icon: Eye },
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
      freeShipping: productForm.freeShipping,
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
      description: String(p.description ?? ""),
      channel: "both",
      freeShipping: p.freeShipping !== false,
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
    <div className="flex min-h-screen bg-[#F4F1EA]">
      {open ? (
        <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[260px] flex-col overflow-hidden bg-[#031D38] text-white transition-transform lg:sticky lg:top-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="shrink-0 border-b border-white/10 px-5 py-5">
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
                setOpen(false);
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#e6dfd2] bg-white px-4 py-3 lg:px-8">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6 text-navy-900" />
          </button>
          <h1 className="font-serif text-xl text-navy-900 capitalize">
            {panel} · {nav.find((n) => n.id === tab)?.label}
          </h1>
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
                <AdminProductImageField
                  value={productForm.image}
                  onChange={(image) => setProductForm((f) => ({ ...f, image }))}
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
                </label>
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

          {tab === "quotes" ? <DataTable rows={quotes} columns={["email", "product", "quantity", "requiredDeliveryDate", "status", "createdAt"]} /> : null}
          {tab === "applications" ? <DataTable rows={applications} columns={["company", "contact", "email", "businessType", "status", "createdAt"]} /> : null}
          {tab === "contacts" ? <DataTable rows={contacts} columns={["kind", "name", "email", "subject", "createdAt"]} /> : null}
          {tab === "returns" ? <DataTable rows={returns} columns={["orderNumber", "customerName", "productName", "status", "createdAt"]} /> : null}
          {tab === "users" ? (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
                Customers ({users.length} total)
              </div>
              <DataTable rows={pagedCustomers} columns={["name", "email", "role", "createdAt"]} />
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
            <AdminReviewsPanel rows={testimonials} onReload={() => void load()} />
          ) : null}
          {tab === "visitors" ? (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
                Recent storefront page views ({visitorPagination.total} total).
              </div>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Path</th>
                    <th className="px-4 py-3">User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-navy-600">
                        No visits recorded yet.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={String(v.id)} className="border-b border-[#f0ebe3]">
                        <td className="whitespace-nowrap px-4 py-3 text-navy-600">{String(v.at ?? "—")}</td>
                        <td className="max-w-[280px] truncate px-4 py-3 font-medium">{String(v.path ?? "—")}</td>
                        <td className="max-w-[360px] truncate px-4 py-3 text-xs text-navy-500">{String(v.userAgent ?? "—")}</td>
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
                    Page {visitorPage} of {visitorPagination.totalPages} · {visitorPagination.total} visits
                  </>
                }
                onPageChange={setVisitorPage}
                compact
              />
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
}: {
  rows: Record<string, unknown>[];
  onReload: () => void;
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DataTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
