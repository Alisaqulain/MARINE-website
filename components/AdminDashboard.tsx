"use client";

import { BrandLogo } from "@/components/Logo";
import {
  ExternalLink,
  Eye,
  LogOut,
  Menu,
  Package,
  Shield,
  Users,
  X,
  MessageSquare,
  FileText,
  RotateCcw,
  Star,
  BookOpen,
  Truck,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { AdminBlogPanel } from "@/components/AdminBlogPanel";
import { AdminCategoriesPanel } from "@/components/AdminCategoriesPanel";
import { AdminProductList } from "@/components/AdminProductList";
import { AdminSalePanel } from "@/components/AdminSalePanel";
import { AdminShipmentsPanel } from "@/components/AdminShipmentsPanel";
import { AdminAiPanel } from "@/components/AdminAiPanel";
import { AdminWhatsAppPanel } from "@/components/AdminWhatsAppPanel";
import { AdminTeamPanel } from "@/components/AdminTeamPanel";
import { BulkActions, deleteUrls, useRowSelection } from "@/components/AdminSelection";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AdminProductImagesField } from "@/components/AdminProductImageField";
import { listingCategories } from "@/lib/listing-categories";
import type { ListingImage } from "@/lib/listing-images";
import { lowStockMessage } from "@/lib/product-display";
import type { AdminProductFilter, AdminProductSort } from "@/lib/admin-catalog";

type Panel = "customer" | "wholesale";

const PRODUCT_DRAFT_KEY = "marina-admin-product-draft";

type Tab =
  | "overview"
  | "products"
  | "add-product"
  | "sales"
  | "categories"
  | "quotes"
  | "applications"
  | "contacts"
  | "returns"
  | "shipments"
  | "testimonials"
  | "blog"
  | "users"
  | "visitors"
  | "team"
  | "ai"
  | "whatsapp";

export function AdminDashboard() {
  const { data: session } = useSession();
  const manageTeam = session?.user?.role === "admin" || session?.user?.manageTeam === true;
  const canAddProduct = !session?.user || session.user.role === "admin" || session.user.canAddProduct === true;
  const canDelete = !session?.user || session.user.role === "admin" || session.user.canDelete === true;
  const [panel, setPanel] = useState<Panel>("customer");
  const [tab, setTab] = useState<Tab>("overview");
  const [restored, setRestored] = useState(false);

  // Phones can reload the page after the OS camera/gallery returns, so the tab and panel are kept
  // in the URL (and sessionStorage) to land back where the admin was instead of the overview.
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const saved = url.get("tab") ?? sessionStorage.getItem("marina-admin-tab");
    const savedPanel = url.get("panel") ?? sessionStorage.getItem("marina-admin-panel");
    if (savedPanel === "customer" || savedPanel === "wholesale") setPanel(savedPanel);
    const allowed: Tab[] = [
      "overview",
      "products",
      "add-product",
      "sales",
      "categories",
      "quotes",
      "applications",
      "contacts",
      "returns",
      "testimonials",
      "blog",
      "users",
      "visitors",
      "team",
      "ai",
      "whatsapp",
      "shipments",
    ];
    if (saved && allowed.includes(saved as Tab)) setTab(saved as Tab);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem("marina-admin-tab", tab);
      sessionStorage.setItem("marina-admin-panel", panel);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.set("panel", panel);
    window.history.replaceState(window.history.state, "", url);
  }, [tab, panel, restored]);
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
  const [productSort, setProductSort] = useState<AdminProductSort>("newest");
  const [productFilter, setProductFilter] = useState<AdminProductFilter>("all");
  const [productCatalogTotal, setProductCatalogTotal] = useState(0);
  const emptyProductForm = () => ({
    name: "",
    sku: "",
    price: "",
    priceIndia: "",
    priceUs: "",
    compareAt: "",
    wholesaleFrom: "",
    wholesalePriceIndia: "",
    wholesalePriceUs: "",
    quantity: "",
    b2cOutOfStock: false,
    b2bOutOfScope: false,
    tags: [] as string[],
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
  const [tagDraft, setTagDraft] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [extraCategories, setExtraCategories] = useState<{ slug: string; name: string }[]>([]);
  const [editing, setEditing] = useState<{ mongoId: string | null; slug: string } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Keep the unsaved Add/Edit product form across a page reload (e.g. after the phone camera).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PRODUCT_DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { form?: Partial<ReturnType<typeof emptyProductForm>>; editing?: typeof editing };
        if (saved.form) setProductForm({ ...emptyProductForm(), ...saved.form });
        if (saved.editing) setEditing(saved.editing);
      }
    } catch {
      /* ignore */
    }
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    try {
      sessionStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify({ form: productForm, editing }));
    } catch {
      /* ignore */
    }
  }, [productForm, editing, draftRestored]);
  const [visitors, setVisitors] = useState<Record<string, unknown>[]>([]);
  const [visitorPage, setVisitorPage] = useState(1);
  const [visitorSummary, setVisitorSummary] = useState({ totalVisitors: 0, today: 0, last7Days: 0 });
  const [listingViews, setListingViews] = useState<{ totalViews: number; listings: { slug: string; views: number }[] }>({
    totalViews: 0,
    listings: [],
  });
  const [visitorPagination, setVisitorPagination] = useState({
    total: 0,
    totalPages: 1,
    pageSize: 25,
  });
  const [customerPage, setCustomerPage] = useState(1);
  const customerPageSize = 15;
  const pageProductIds = products.map((product) => String(product.id));
  const productPick = useRowSelection(pageProductIds);
  const visitorPick = useRowSelection(visitors.map((visitor) => String(visitor.id)));
  const customerPick = useRowSelection(users.map((user) => String(user.id)));

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
        `/api/admin/products?channel=${channel}&page=${productPage}&pageSize=10&sort=${productSort}&filter=${productFilter}${productSearch ? `&q=${encodeURIComponent(productSearch)}` : ""}`
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
  }, [panel, productPage, productSearch, productSort, productFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadVisitors = useCallback(async () => {
    const res = await fetch(`/api/admin/page-views?page=${visitorPage}&pageSize=25`);
    const data = await res.json();
    setVisitors(data.items ?? []);
    setVisitorSummary(data.summary ?? { totalVisitors: 0, today: 0, last7Days: 0 });
    setVisitorPagination(data.pagination ?? { total: 0, totalPages: 1, pageSize: 25 });
    setListingViews(data.listingViews ?? { totalViews: 0, listings: [] });
  }, [visitorPage]);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  useEffect(() => {
    setProductPage(1);
  }, [panel, productSearch, productSort, productFilter]);

  useEffect(() => {
    void fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) {
          setExtraCategories(
            data.items
              .map((item: { slug?: string; name?: string }) => ({
                slug: String(item.slug ?? ""),
                name: String(item.name ?? ""),
              }))
              .filter((item: { slug: string; name: string }) => item.slug && item.name)
          );
        }
      })
      .catch(() => {});
  }, [tab]);

  useEffect(() => {
    setCustomerPage(1);
  }, [panel, users.length]);

  const customerTotalPages = Math.max(1, Math.ceil(users.length / customerPageSize));
  const pagedCustomers = users.slice(
    (customerPage - 1) * customerPageSize,
    customerPage * customerPageSize
  );

  const teamNav = manageTeam ? [{ id: "team" as const, label: "Team access", icon: Shield }] : [];
  const nav: { id: Tab; label: string; icon: typeof Package }[] =
    panel === "wholesale"
      ? [
          { id: "overview", label: "Overview", icon: Package },
          { id: "products", label: "Products", icon: Package },
          ...(canAddProduct
            ? [
                { id: "add-product" as const, label: "Add product", icon: Package },
                { id: "sales" as const, label: "Run a sale", icon: Package },
                { id: "categories" as const, label: "Categories", icon: Package },
              ]
            : []),
          { id: "users", label: "Customers", icon: Users },
          { id: "quotes", label: "Bulk quotes", icon: FileText },
          { id: "applications", label: "Trade accounts", icon: Users },
          { id: "contacts", label: "Contact", icon: MessageSquare },
          { id: "shipments", label: "ShipGlobal", icon: Truck },
          { id: "ai", label: "Marina AI", icon: Sparkles },
          { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
          { id: "testimonials", label: "Reviews", icon: Star },
          { id: "blog", label: "Blog", icon: BookOpen },
          ...teamNav,
        ]
      : [
          { id: "overview", label: "Overview", icon: Package },
          { id: "products", label: "Products", icon: Package },
          ...(canAddProduct
            ? [
                { id: "add-product" as const, label: "Add product", icon: Package },
                { id: "sales" as const, label: "Run a sale", icon: Package },
                { id: "categories" as const, label: "Categories", icon: Package },
              ]
            : []),
          { id: "users", label: "Customers", icon: Users },
          { id: "contacts", label: "Contact", icon: MessageSquare },
          { id: "returns", label: "Returns", icon: RotateCcw },
          { id: "shipments", label: "ShipGlobal", icon: Truck },
          { id: "ai", label: "Marina AI", icon: Sparkles },
          { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
          { id: "testimonials", label: "Reviews", icon: Star },
          { id: "blog", label: "Blog", icon: BookOpen },
          { id: "visitors", label: "Website visitors", icon: Eye },
          ...teamNav,
        ];

  function productPayload() {
    return {
      ...productForm,
      slug: editing?.slug,
      channel: "both",
      priceScope: panel === "wholesale" ? "wholesale" : "retail",
      price: productForm.price,
      priceIndia: productForm.priceIndia,
      priceUs: productForm.priceUs,
      tags: productForm.tags,
      compareAt: productForm.compareAt,
      wholesaleFrom: productForm.wholesaleFrom,
      wholesalePriceIndia: productForm.wholesalePriceIndia,
      wholesalePriceUs: productForm.wholesalePriceUs,
      quantity: productForm.quantity,
      b2cOutOfStock: productForm.b2cOutOfStock,
      b2bOutOfScope: productForm.b2bOutOfScope,
      image: productForm.images[0]?.url ?? productForm.image,
      images: productForm.images,
      freeShipping: productForm.freeShipping,
      categories: productForm.categories,
      zoom: productForm.images[0]?.adjust?.zoom ?? productForm.zoom,
      brightness: productForm.images[0]?.adjust?.brightness ?? productForm.brightness,
      contrast: productForm.images[0]?.adjust?.contrast ?? productForm.contrast,
      colors: productForm.colors,
      materials: productForm.materials,
      sizes: productForm.sizes,
      personalisationPrice: productForm.personalisationPrice,
    };
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (panel === "wholesale") {
      const qty = productForm.quantity === "" ? NaN : Number(productForm.quantity);
      if (!Number.isFinite(qty) || qty < 20) {
        window.alert("Wholesale quantity in stock must be at least 20.");
        return;
      }
    }
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
    setTab("products");
    void load();
  }

  function startEdit(p: Record<string, unknown>) {
    const source = String(p.source ?? "catalog");
    const mongoId = source === "mongodb" ? String(p.id) : null;
    setEditing({ mongoId, slug: String(p.slug) });
    setTab("add-product");
    setProductForm({
      name: String(p.name ?? ""),
      sku: String(p.sku ?? ""),
      price: String(p.price ?? ""),
      priceIndia: p.priceIndia != null && p.priceIndia !== "" ? String(p.priceIndia) : "",
      priceUs: p.priceUs != null && p.priceUs !== "" ? String(p.priceUs) : "",
      compareAt: p.compareAt != null && p.compareAt !== "" ? String(p.compareAt) : "",
      wholesaleFrom: p.wholesaleFrom != null ? String(p.wholesaleFrom) : "",
      wholesalePriceIndia: p.wholesalePriceIndia != null && p.wholesalePriceIndia !== "" ? String(p.wholesalePriceIndia) : "",
      wholesalePriceUs: p.wholesalePriceUs != null && p.wholesalePriceUs !== "" ? String(p.wholesalePriceUs) : "",
      quantity: p.quantity != null ? String(p.quantity) : "",
      b2cOutOfStock: p.b2cOutOfStock === true,
      b2bOutOfScope: p.b2bOutOfScope === true,
      image: String(p.image ?? ""),
      images: Array.isArray(p.images)
        ? (p.images as ListingImage[]).map((image) => ({
            url: String(image?.url ?? ""),
            name: String(image?.name ?? ""),
            color: String(image?.color ?? ""),
            text: String(image?.text ?? ""),
            textX: Number.isFinite(Number(image?.textX)) ? Number(image.textX) : undefined,
            textY: Number.isFinite(Number(image?.textY)) ? Number(image.textY) : undefined,
            adjust: image?.adjust,
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
      tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 13) : [],
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
    if (!canDelete) return;
    if (!window.confirm(`Delete “${p.name}” from the database?`)) return;
    await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (editing?.mongoId === String(p.id)) {
      setEditing(null);
      setProductForm(emptyProductForm());
    }
    void load();
  }

  async function deleteProducts(ids: string[]) {
    const chosen = products.filter((product) => ids.includes(String(product.id)));
    const mongoIds = chosen.filter((product) => product.source === "mongodb").map((product) => String(product.id));
    const catalogCount = chosen.length - mongoIds.length;
    if (!canDelete || !chosen.length) return;
    if (!mongoIds.length) {
      window.alert("These are built-in catalogue items. Edit and save one first, then you can delete that saved copy.");
      return;
    }
    const note = catalogCount
      ? ` ${catalogCount} catalogue item${catalogCount === 1 ? "" : "s"} will stay.`
      : "";
    if (!window.confirm(`Delete ${mongoIds.length} saved product${mongoIds.length === 1 ? "" : "s"}?${note}`)) return;
    const failed = await deleteUrls(mongoIds.map((id) => `/api/admin/products/${id}`));
    if (failed) window.alert(`${failed} product${failed === 1 ? "" : "s"} could not be deleted.`);
    productPick.clear();
    void load();
  }

  async function restrictCustomers(ids: string[], restricted: boolean) {
    if (!canDelete || !ids.length) return;
    const verb = restricted ? "Restrict" : "Unrestrict";
    if (!window.confirm(`${verb} ${ids.length} account${ids.length === 1 ? "" : "s"}?`)) return;
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/customers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restricted }),
        })
      )
    );
    customerPick.clear();
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
              {panel === "wholesale" ? (
                <>
                  <Stat label="Products" value={String(productCatalogTotal)} onClick={() => setTab("products")} />
                  <Stat label="Customers" value={String(users.length)} onClick={() => setTab("users")} />
                  <Stat label="Bulk quotes" value={String(quotes.length)} onClick={() => setTab("quotes")} />
                  <Stat label="Trade accounts" value={String(applications.length)} onClick={() => setTab("applications")} />
                </>
              ) : (
                <>
                  <Stat label="Products" value={String(productCatalogTotal)} onClick={() => setTab("products")} />
                  <Stat label="Customers" value={String(users.length)} onClick={() => setTab("users")} />
                  <Stat label="Website visitors" value={String(visitorSummary.totalVisitors)} onClick={() => setTab("visitors")} />
                  <Stat
                    label="Categories"
                    value={String(listingCategories().length + extraCategories.length)}
                    onClick={() => setTab(canAddProduct ? "categories" : "products")}
                  />
                  <Stat label="Contacts" value={String(contacts.length)} onClick={() => setTab("contacts")} />
                  <Stat label="Returns" value={String(returns.length)} onClick={() => setTab("returns")} />
                  <Stat label="Reviews" value="Open" onClick={() => setTab("testimonials")} />
                  <Stat label="Blog" value="Open" onClick={() => setTab("blog")} />
                </>
              )}
            </div>
          ) : null}

          {tab === "products" ? (
              <div className="rounded-xl bg-white shadow-sm">
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
                <div className="grid grid-cols-2 gap-2 border-b bg-white px-4 py-3 sm:flex sm:flex-wrap sm:items-center">
                  <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-navy-600 sm:flex-row sm:items-center sm:gap-2">
                    Sort
                    <select
                      className="input min-h-9 py-1.5 text-sm font-normal normal-case tracking-normal"
                      value={productSort}
                      onChange={(e) => setProductSort(e.target.value as AdminProductSort)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="updated">Recently updated</option>
                      <option value="name-asc">Name A–Z</option>
                      <option value="name-desc">Name Z–A</option>
                      <option value="price-asc">Price: low to high</option>
                      <option value="price-desc">Price: high to low</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-navy-600 sm:flex-row sm:items-center sm:gap-2">
                    Show
                    <select
                      className="input min-h-9 py-1.5 text-sm font-normal normal-case tracking-normal"
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value as AdminProductFilter)}
                    >
                      <option value="all">All products</option>
                      <option value="added">Added in admin</option>
                      <option value="catalog">Built-in catalogue</option>
                      <option value="on-sale">Run a sale</option>
                      <option value="in-stock">In stock</option>
                      <option value="out-of-stock">Out of stock</option>
                      <option value="low-stock">Low stock (1–5)</option>
                      <option value="hidden">Deactivated</option>
                    </select>
                  </label>
                </div>
                <AdminListPagination
                  className="border-t bg-white px-4 py-3"
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
                <AdminProductList
                  products={products}
                  canDelete={canDelete}
                  canEdit={canAddProduct}
                  selected={productPick.selected}
                  onToggle={productPick.toggle}
                  onToggleAll={productPick.toggleAll}
                  onEdit={startEdit}
                  onDelete={(product) => void deleteProduct(product)}
                  onDeleteSelected={(ids) => void deleteProducts(ids)}
                  onChanged={() => void load()}
                  onRunSale={() => setTab("sales")}
                  priceMode={panel === "wholesale" ? "wholesale" : "retail"}
                />

              </div>
          ) : null}

          {tab === "add-product" && canAddProduct ? (
              <form onSubmit={saveProduct} className="mx-auto max-w-4xl space-y-3 rounded-xl bg-white p-5 shadow-sm">
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
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-navy-600">Tags</legend>
                  <p className="text-[10px] text-navy-500">Add up to 13 tags to help people search for your listings. Shape, colour, style, function, etc.</p>
                  <div className="flex gap-2">
                    <input
                      className="input text-sm"
                      placeholder="Add tag"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-outline shrink-0 px-4 text-xs"
                      onClick={() => {
                        const tag = tagDraft.trim();
                        if (!tag || productForm.tags.length >= 13 || productForm.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return;
                        setProductForm({ ...productForm, tags: [...productForm.tags, tag] });
                        setTagDraft("");
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-[11px] text-navy-500">{13 - productForm.tags.length} left</p>
                  <div className="flex flex-wrap gap-2">
                    {productForm.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="rounded-full bg-[#f4f1ea] px-3 py-1 text-xs text-navy-800"
                        onClick={() => setProductForm({ ...productForm, tags: productForm.tags.filter((item) => item !== tag) })}
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-navy-600">
                    {panel === "wholesale" ? "Wholesale price (US$)" : "Retail price (US$)"}
                  </legend>
                  <p className="text-[10px] text-navy-500">
                    Three prices, all in US dollars. Saving here updates only this panel — retail and wholesale prices stay separate.
                  </p>
                  {panel === "wholesale" ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-xs">
                        <span className="mb-1 block text-navy-600">1. India · US$</span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={productForm.wholesalePriceIndia}
                          onChange={(e) => setProductForm({ ...productForm, wholesalePriceIndia: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="mb-1 block text-navy-600">2. United States · US$</span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={productForm.wholesalePriceUs}
                          onChange={(e) => setProductForm({ ...productForm, wholesalePriceUs: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="mb-1 block text-navy-600">3. Other countries · US$</span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={productForm.wholesaleFrom}
                          onChange={(e) => setProductForm({ ...productForm, wholesaleFrom: e.target.value })}
                          required
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-xs">
                        <span className="mb-1 block text-navy-600">1. India · US$</span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={productForm.priceIndia}
                          onChange={(e) => setProductForm({ ...productForm, priceIndia: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="mb-1 block text-navy-600">2. United States · US$</span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={productForm.priceUs}
                          onChange={(e) => setProductForm({ ...productForm, priceUs: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="mb-1 block text-navy-600">3. Other countries · US$</span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          required
                        />
                      </label>
                    </div>
                  )}
                </fieldset>
                <label className="block text-xs">
                  <span className="mb-1 block text-navy-600">Quantity in stock</span>
                  <input
                    className="input"
                    type="number"
                    min={panel === "wholesale" ? 20 : 0}
                    step={1}
                    placeholder={panel === "wholesale" ? "Min 20" : "e.g. 100"}
                    value={productForm.quantity}
                    onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                    required={panel === "wholesale"}
                  />
                  {panel === "wholesale" ? (
                    <span className="mt-1 block text-[11px] font-semibold text-red-700">
                      Min. stock for wholesale is 20
                    </span>
                  ) : lowStockMessage(productForm.quantity === "" ? undefined : Number(productForm.quantity)) ? (
                    <span className="mt-1 block text-[11px] font-medium text-[#9a3412]">
                      {lowStockMessage(Number(productForm.quantity))}
                    </span>
                  ) : (
                    <span className="mt-1 block text-[10px] text-navy-500">
                      Shared inventory for retail and wholesale. 5 or fewer shows a low-stock note on retail.
                    </span>
                  )}
                </label>
                <fieldset className="space-y-2 rounded-xl border border-[#e6dfd2] p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Availability
                  </legend>
                  {panel === "wholesale" ? (
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-navy-800">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={productForm.b2bOutOfScope}
                        onChange={(e) =>
                          setProductForm({ ...productForm, b2bOutOfScope: e.target.checked })
                        }
                      />
                      <span>
                        <span className="block font-medium">Out of stock</span>
                        <span className="block text-[10px] text-navy-500">
                          Shows “Out of stock” on wholesale and disables wholesale purchase.
                        </span>
                      </span>
                    </label>
                  ) : (
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-navy-800">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={productForm.b2cOutOfStock}
                        onChange={(e) =>
                          setProductForm({ ...productForm, b2cOutOfStock: e.target.checked })
                        }
                      />
                      <span>
                        <span className="block font-medium">Out of stock</span>
                        <span className="block text-[10px] text-navy-500">
                          Shows “Out of stock” on retail and disables customer purchase.
                        </span>
                      </span>
                    </label>
                  )}
                </fieldset>
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
                    {[...listingCategories(), ...extraCategories.filter((item) => !listingCategories().some((category) => category.slug === item.slug))]
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
                  <p className="text-[10px] text-navy-500">
                    {listingCategories().length + extraCategories.filter((item) => !listingCategories().some((category) => category.slug === item.slug)).length} categories
                  </p>
                </fieldset>
                <label className="block text-xs">
                  <span className="mb-1 block text-navy-600">Personalisation charge ($)</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 5.50"
                    value={productForm.personalisationPrice}
                    onChange={(e) => setProductForm({ ...productForm, personalisationPrice: e.target.value })}
                  />
                  <span className="mt-1 block text-[10px] text-navy-500">
                    Enter dollars and cents (e.g. 5.50). Leave blank to hide personalisation.
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
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-navy-600">Description</span>
                    <button
                      type="button"
                      className="rounded border border-[#e6dfd2] px-2 py-0.5 text-xs font-bold"
                      onClick={() => {
                        const area = document.getElementById("admin-product-description") as HTMLTextAreaElement | null;
                        if (!area) return;
                        const start = area.selectionStart;
                        const end = area.selectionEnd;
                        const selected = productForm.description.slice(start, end) || "Heading";
                        const next = `${productForm.description.slice(0, start)}**${selected}**${productForm.description.slice(end)}`;
                        setProductForm({ ...productForm, description: next });
                      }}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#e6dfd2] px-2 py-0.5 text-xs underline"
                      onClick={() => {
                        const area = document.getElementById("admin-product-description") as HTMLTextAreaElement | null;
                        if (!area) return;
                        const start = area.selectionStart;
                        const end = area.selectionEnd;
                        const selected = productForm.description.slice(start, end) || "Heading";
                        const next = `${productForm.description.slice(0, start)}__${selected}__${productForm.description.slice(end)}`;
                        setProductForm({ ...productForm, description: next });
                      }}
                    >
                      Underline
                    </button>
                    <span className="text-[10px] text-navy-500">Select text, then Bold or Underline for a heading.</span>
                  </div>
                  <textarea
                    id="admin-product-description"
                    className="input min-h-28 whitespace-pre-wrap"
                    placeholder="Description. Press Enter for a new line. Use Bold/Underline for headings."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-outline flex-1"
                    onClick={() => {
                      const dirty = JSON.stringify(productForm) !== JSON.stringify(emptyProductForm());
                      if (!editing && dirty && !window.confirm("Discard this product? Your changes will not be saved.")) return;
                      setEditing(null);
                      setProductForm(emptyProductForm());
                      setTab("products");
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-gold flex-1">
                    {editing ? "Update product" : "Save product"}
                  </button>
                </div>
              </form>
          ) : null}

          {tab === "sales" && canAddProduct ? <AdminSalePanel /> : null}

          {tab === "categories" && canAddProduct ? <AdminCategoriesPanel /> : null}

          {tab === "shipments" ? <AdminShipmentsPanel /> : null}
          {tab === "ai" ? <AdminAiPanel /> : null}
          {tab === "whatsapp" ? <AdminWhatsAppPanel /> : null}

          {tab === "quotes" ? (
            <AdminDataTable
              rows={quotes}
              columns={["email", "product", "quantity", "requiredDeliveryDate", "status", "createdAt"]}
              deletePath={(id) => `/api/quotes/${id}`}
              onReload={load}
              canDelete={canDelete}
            />
          ) : null}
          {tab === "applications" ? (
            <TradeAccountsPanel rows={applications} onReload={load} canDelete={canDelete} />
          ) : null}
          {tab === "contacts" ? (
            <AdminDataTable
              rows={contacts}
              columns={["kind", "name", "email", "subject", "createdAt"]}
              deletePath={(id) => `/api/contact/${id}`}
              onReload={load}
              canDelete={canDelete}
            />
          ) : null}
          {tab === "returns" ? (
            <AdminDataTable
              rows={returns}
              columns={["orderNumber", "customerName", "productName", "status", "createdAt"]}
              deletePath={(id) => `/api/returns/${id}`}
              onReload={load}
              canDelete={canDelete}
            />
          ) : null}
          {tab === "users" ? (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
                {panel === "wholesale" ? "Wholesale customers" : "Retail customers"} ({users.length} total). Restrict blocks sign-in.
              </div>
              <BulkActions
                canDelete={canDelete}
                allSelected={customerPick.allSelected}
                selectedCount={customerPick.selected.length}
                onToggleAll={customerPick.toggleAll}
                onDeleteSelected={() =>
                  void deleteMany(
                    customerPick.selected.map((id) => `/api/admin/customers/${id}`),
                    () => {
                      customerPick.clear();
                      void load();
                    }
                  )
                }
                onDeleteAll={() =>
                  void deleteMany(
                    users.map((user) => `/api/admin/customers/${String(user.id)}`),
                    () => {
                      customerPick.clear();
                      void load();
                    }
                  )
                }
                extra={
                  <button
                    type="button"
                    className="font-semibold text-amber-800 underline disabled:opacity-40"
                    disabled={customerPick.selected.length === 0}
                    onClick={() => void restrictCustomers(customerPick.selected, true)}
                  >
                    Restrict selected
                  </button>
                }
              />
              <AdminDataTable
                rows={pagedCustomers}
                columns={["name", "phone", "email", "accountType", "address", "memberSince", "verified", "restricted"]}
                deletePath={(id) => `/api/admin/customers/${id}`}
                onReload={load}
                canDelete={canDelete}
                selected={customerPick.selected}
                onToggle={customerPick.toggle}
                renderExtra={
                  canDelete
                    ? (row) => (
                        <button
                          type="button"
                          className="text-xs font-semibold text-amber-800 underline"
                          onClick={() => void restrictCustomers([String(row.id)], row.restricted !== true)}
                        >
                          {row.restricted === true ? "Unrestrict" : "Restrict"}
                        </button>
                      )
                    : undefined
                }
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
              canDelete={canDelete}
            />
          ) : null}
          {tab === "blog" ? <AdminBlogPanel canEdit={canAddProduct} canDelete={canDelete} /> : null}
          {tab === "team" && manageTeam ? <AdminTeamPanel /> : null}
          {tab === "visitors" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Website visitors" value={String(visitorSummary.totalVisitors)} />
                <Stat label="Today" value={String(visitorSummary.today)} />
                <Stat label="Last 7 days" value={String(visitorSummary.last7Days)} />
                <Stat label="Listing views" value={String(listingViews.totalViews)} />
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg text-navy-900">Shoppers viewed your listings</h3>
                <p className="mt-1 text-sm text-navy-600">
                  Shoppers viewed your listings <span className="font-semibold text-navy-900">{listingViews.totalViews}</span> times.
                </p>
                {listingViews.listings.length ? (
                  <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
                    {listingViews.listings.slice(0, 25).map((row) => (
                      <li key={row.slug} className="flex items-center justify-between gap-3 border-b border-[#f0ebe3] py-2">
                        <a href={`/product/${row.slug}`} className="truncate text-navy-800 hover:text-[#8C6E28]">
                          {row.slug}
                        </a>
                        <span className="shrink-0 font-semibold text-navy-900">{row.views}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-navy-500">No product page views recorded yet.</p>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
                  Each row is one website visitor. Repeat page opens from the same browser are counted together.
                </div>
                <BulkActions
                  canDelete={canDelete}
                  allSelected={visitorPick.allSelected}
                  selectedCount={visitorPick.selected.length}
                  onToggleAll={visitorPick.toggleAll}
                  deleteAllLabel="Delete all visitors"
                  onDeleteSelected={() =>
                    void deleteMany(
                      visitorPick.selected.map((id) => `/api/admin/page-views/${encodeURIComponent(id)}`),
                      () => {
                        visitorPick.clear();
                        void loadVisitors();
                      }
                    )
                  }
                  onDeleteAll={() => void deleteAllVisitors(loadVisitors)}
                />
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
                    <tr>
                      {canDelete ? <th className="px-4 py-3"> </th> : null}
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
                        <td colSpan={canDelete ? 8 : 7} className="px-4 py-8 text-center text-navy-600">
                          No website visitors recorded yet.
                        </td>
                      </tr>
                    ) : (
                      visitors.map((v) => (
                        <tr key={String(v.id)} className="border-b border-[#f0ebe3]">
                          {canDelete ? (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={visitorPick.selected.includes(String(v.id))}
                                onChange={() => visitorPick.toggle(String(v.id))}
                                aria-label="Select visitor"
                              />
                            </td>
                          ) : null}
                          <td className="whitespace-nowrap px-4 py-3 text-navy-600">{formatVisit(v.lastAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-navy-600">{formatVisit(v.firstAt)}</td>
                          <td className="px-4 py-3 font-medium">{String(v.visits ?? 0)}</td>
                          <td className="px-4 py-3">{String(v.pages ?? 0)}</td>
                          <td className="max-w-[220px] truncate px-4 py-3">{String(v.lastPath ?? "—")}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-navy-600">{String(v.device ?? "Unknown")}</td>
                          <td className="px-4 py-3">
                            {canDelete ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-700 underline"
                                onClick={() =>
                                  void deleteRow(`/api/admin/page-views/${encodeURIComponent(String(v.id))}`, loadVisitors)
                                }
                              >
                                Delete
                              </button>
                            ) : (
                              "—"
                            )}
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

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const className = `rounded-xl bg-white p-5 text-left shadow-sm ${onClick ? "transition hover:bg-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40" : ""}`;
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <p className="text-xs uppercase tracking-wider text-navy-500">{label}</p>
        <p className="mt-2 font-serif text-3xl text-navy-900">{value}</p>
        <p className="mt-1 text-[10px] text-[#8C6E28]">Open section →</p>
      </button>
    );
  }
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-navy-500">{label}</p>
      <p className="mt-2 font-serif text-3xl text-navy-900">{value}</p>
    </div>
  );
}

function AdminReviewsPanel({
  rows,
  onReload,
  canDelete = true,
}: {
  rows: Record<string, unknown>[];
  onReload: () => void;
  canDelete?: boolean;
}) {
  const ids = rows.map((row) => String(row.id ?? ""));
  const pick = useRowSelection(ids);
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
      <BulkActions
        canDelete={canDelete}
        allSelected={pick.allSelected}
        selectedCount={pick.selected.length}
        onToggleAll={pick.toggleAll}
        onDeleteSelected={() =>
          void deleteMany(
            pick.selected.map((id) => `/api/testimonials/${id}`),
            () => {
              pick.clear();
              onReload();
            }
          )
        }
        onDeleteAll={() =>
          void deleteMany(
            ids.map((id) => `/api/testimonials/${id}`),
            () => {
              pick.clear();
              onReload();
            }
          )
        }
      />
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
          <tr>
            {canDelete ? <th className="px-4 py-3"> </th> : null}
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
                {canDelete ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={pick.selected.includes(id)}
                      onChange={() => pick.toggle(id)}
                      aria-label="Select review"
                    />
                  </td>
                ) : null}
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
                  {canDelete ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700 underline"
                      onClick={() => void deleteRow(`/api/testimonials/${id}`, onReload)}
                    >
                      Delete
                    </button>
                  ) : (
                    "—"
                  )}
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

async function deleteMany(urls: string[], onDone: () => void) {
  const unique = [...new Set(urls)];
  if (!unique.length) return;
  if (!confirm(`Delete ${unique.length} record${unique.length === 1 ? "" : "s"} permanently?`)) return;
  const failed = await deleteUrls(unique);
  if (failed) alert(`${failed} record${failed === 1 ? "" : "s"} could not be deleted.`);
  onDone();
}

async function deleteAllVisitors(onDone: () => void) {
  if (!confirm("Delete every website visitor record?")) return;
  const res = await fetch("/api/admin/page-views", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true }),
  });
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
  canDelete = true,
  selected,
  onToggle,
  renderExtra,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  deletePath?: (id: string) => string;
  onReload: () => void;
  canDelete?: boolean;
  selected?: string[];
  onToggle?: (id: string) => void;
  renderExtra?: (row: Record<string, unknown>) => ReactNode;
}) {
  const own = useRowSelection(rows.map((row) => String(row.id ?? "")));
  const picked = selected ?? own.selected;
  const toggle = onToggle ?? own.toggle;
  if (!rows.length) return <p className="text-sm text-navy-600">No records yet.</p>;
  const showDelete = Boolean(deletePath) && canDelete;
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      {showDelete && !selected ? (
        <BulkActions
          allSelected={own.allSelected}
          selectedCount={own.selected.length}
          onToggleAll={own.toggleAll}
          onDeleteSelected={() =>
            void deleteMany(
              own.selected.map((id) => deletePath!(id)),
              () => {
                own.clear();
                onReload();
              }
            )
          }
          onDeleteAll={() =>
            void deleteMany(
              rows.map((row) => deletePath!(String(row.id))),
              () => {
                own.clear();
                onReload();
              }
            )
          }
        />
      ) : null}
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
          <tr>
            {showDelete ? <th className="px-4 py-3"> </th> : null}
            {columns.map((c) => (
              <th key={c} className="px-4 py-3">
                {c}
              </th>
            ))}
            {showDelete || renderExtra ? <th className="px-4 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = String(row.id ?? i);
            return (
              <tr key={id} className="border-b border-[#f0ebe3]">
                {showDelete ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={picked.includes(id)}
                      onChange={() => toggle(id)}
                      aria-label={`Select ${id}`}
                    />
                  </td>
                ) : null}
                {columns.map((c) => (
                  <td key={c} className="max-w-xs truncate px-4 py-3">
                    {c === "restricted"
                      ? row.restricted === true
                        ? "Restricted"
                        : "Active"
                      : c === "verified"
                        ? (
                            <span className={row.verified === "Not verified" ? "font-semibold text-[#9a3412]" : "font-semibold text-emerald-800"}>
                              {String(row.verified ?? "Verified")}
                            </span>
                          )
                        : String(row[c] ?? "")}
                  </td>
                ))}
                {showDelete || renderExtra ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {renderExtra ? renderExtra(row) : null}
                      {showDelete ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 underline"
                          onClick={() => void deleteRow(deletePath!(id), onReload)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TradeAccountsPanel({
  rows,
  onReload,
  canDelete = true,
}: {
  rows: Record<string, unknown>[];
  onReload: () => void;
  canDelete?: boolean;
}) {
  const ids = rows.map((row) => String(row.id));
  const pick = useRowSelection(ids);
  if (!rows.length) return <p className="text-sm text-navy-600">No trade applications yet.</p>;

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <BulkActions
        canDelete={canDelete}
        allSelected={pick.allSelected}
        selectedCount={pick.selected.length}
        onToggleAll={pick.toggleAll}
        onDeleteSelected={() =>
          void deleteMany(
            pick.selected.map((id) => `/api/wholesale/application/${id}`),
            () => {
              pick.clear();
              onReload();
            }
          )
        }
        onDeleteAll={() =>
          void deleteMany(
            ids.map((id) => `/api/wholesale/application/${id}`),
            () => {
              pick.clear();
              onReload();
            }
          )
        }
      />
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
          <tr>
            {canDelete ? <th className="px-3 py-3"> </th> : null}
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
                {canDelete ? (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={pick.selected.includes(id)}
                      onChange={() => pick.toggle(id)}
                      aria-label="Select trade account"
                    />
                  </td>
                ) : null}
                <td className="max-w-[140px] px-3 py-3">{String(row.company ?? "")}</td>
                <td className="px-3 py-3">{String(row.contact ?? "")}</td>
                <td className="max-w-[160px] truncate px-3 py-3">{String(row.email ?? "")}</td>
                <td className="whitespace-nowrap px-3 py-3">{String(row.phone ?? "")}</td>
                <td className="px-3 py-3">{String(row.businessType ?? "")}</td>
                <td className="px-3 py-3">{String(row.taxId ?? "")}</td>
                <td className="max-w-[180px] px-3 py-3 text-xs">{String(row.productInterest ?? "")}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-navy-600">{String(row.createdAt ?? "")}</td>
                <td className="px-3 py-3">
                  {canDelete ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700 underline"
                      onClick={() => void deleteRow(`/api/wholesale/application/${id}`, onReload)}
                    >
                      Delete
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
