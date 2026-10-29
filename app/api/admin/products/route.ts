import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireAdminSession } from "@/lib/admin-auth";
import { isDashboardRole } from "@/lib/staff-access";
import {
  ADMIN_PRODUCT_FILTERS,
  ADMIN_PRODUCT_SORTS,
  catalogProductsForAdmin,
  filterAdminProducts,
  mergeAdminProducts,
  sortAdminProducts,
  type AdminProductFilter,
  type AdminProductRow,
  type AdminProductSort,
} from "@/lib/admin-catalog";
import { getDb } from "@/lib/mongodb";
import type { AdminProduct, CatalogOverride } from "@/lib/db/types";
import { slugify } from "@/lib/slugify";
import { parseProductExtras } from "@/lib/product-fields";
import { loadActiveSales, saleAppliesTo } from "@/lib/sales";

function money(value: unknown) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!isDashboardRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const channelParam = searchParams.get("channel");
  const channel =
    channelParam === "retail" || channelParam === "wholesale" ? channelParam : null;

  const db = await getDb();
  const overrides = await db.collection<CatalogOverride>("catalog_overrides").find({}).toArray();
  const overrideBySlug = new Map(overrides.map((o) => [o.slug, o]));
  const catalog = catalogProductsForAdmin(channel).map((row) => {
    const o = overrideBySlug.get(row.slug);
    if (!o) return row;
    return {
      ...row,
      active: o.active ?? row.active,
      featured: o.featured ?? row.featured,
      renewsAt: o.renewsAt ?? row.renewsAt,
    };
  });

  const filter =
    channel === "retail" || channel === "wholesale"
      ? { channel: { $in: [channel, "both"] as const } }
      : {};
  const dbDocs = await db
    .collection<AdminProduct>("products")
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray();

  const mongo: AdminProductRow[] = dbDocs.map((p) => ({
    id: String(p._id),
    source: "mongodb",
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    price: p.price,
    compareAt: p.compareAt,
    wholesaleFrom: p.wholesaleFrom,
    wholesalePriceIndia: p.wholesalePriceIndia,
    wholesalePriceUs: p.wholesalePriceUs,
    quantity: p.quantity,
    b2cOutOfStock: p.b2cOutOfStock,
    b2bOutOfScope: p.b2bOutOfScope,
    image: p.image,
    description: p.description,
    channel: p.channel,
    stock: p.stock,
    active: p.active,
    freeShipping: p.freeShipping !== false,
    categories: p.categories,
    imageAdjust: p.imageAdjust,
    colors: p.colors,
    materials: p.materials,
    sizes: p.sizes,
    images: p.images,
    personalisationPrice: p.personalisationPrice,
    tags: p.tags,
    priceIndia: p.priceIndia,
    priceUs: p.priceUs,
    featured: p.featured,
    renewsAt: p.renewsAt,
    listedBy: p.listedBy,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
  }));

  const allItems = mergeAdminProducts(catalog, mongo);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const sortParam = searchParams.get("sort");
  const sort: AdminProductSort = ADMIN_PRODUCT_SORTS.includes(sortParam as AdminProductSort)
    ? (sortParam as AdminProductSort)
    : "newest";
  const filterParam = searchParams.get("filter");
  const show: AdminProductFilter = ADMIN_PRODUCT_FILTERS.includes(filterParam as AdminProductFilter)
    ? (filterParam as AdminProductFilter)
    : "all";
  const sales = show === "on-sale" ? await loadActiveSales() : [];
  const onSaleSlugs =
    show === "on-sale"
      ? new Set(allItems.filter((item) => sales.some((sale) => saleAppliesTo(sale, item.slug))).map((item) => item.slug))
      : undefined;
  let items = filterAdminProducts(allItems, show, onSaleSlugs, channel);
  if (q) {
    items = items.filter((p) => {
      const hay = `${p.name} ${p.slug} ${p.sku ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  items = sortAdminProducts(items, sort);

  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(5, Number(searchParams.get("pageSize") ?? 10)));
  const total = items.length;
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return NextResponse.json({
    items: pageItems,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    counts: { catalog: catalog.length, mongodb: mongo.length, total: allItems.length },
  });
}

export async function POST(req: Request) {
  const { session, error } = await requireAdminSession("addProduct");
  if (error || !session) return error;
  const body = await req.json();
  const now = new Date();
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim() || slugify(name);
  if (!name || !slug) {
    return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  }

  const scope = body.priceScope === "wholesale" ? "wholesale" : "retail";
  const extras = parseProductExtras(body);
  const wholesaleFrom = money(body.wholesaleFrom);
  const retailPrice = money(body.price) ?? wholesaleFrom ?? 0;

  const db = await getDb();
  const col = db.collection<AdminProduct>("products");
  const existing = await col.findOne({ slug });

  const shared = {
    slug,
    name,
    sku: String(body.sku ?? existing?.sku ?? ""),
    image: extras.images?.[0]?.url || String(body.image ?? existing?.image ?? ""),
    images: extras.images ?? existing?.images,
    personalisationPrice: extras.personalisationPrice,
    description: String(body.description ?? existing?.description ?? ""),
    channel: "both" as const,
    stock: extras.stock,
    active: body.active !== false,
    freeShipping: body.freeShipping !== false,
    categories: extras.categories ?? existing?.categories,
    imageAdjust: extras.imageAdjust ?? existing?.imageAdjust,
    colors: extras.colors ?? existing?.colors,
    materials: extras.materials ?? existing?.materials,
    sizes: extras.sizes ?? existing?.sizes,
    tags: extras.tags ?? existing?.tags,
    b2cOutOfStock: extras.b2cOutOfStock,
    b2bOutOfScope: extras.b2bOutOfScope,
    updatedAt: now,
  };

  if (existing) {
    const set: Partial<AdminProduct> = {
      ...shared,
      listedBy: existing.listedBy,
      createdAt: existing.createdAt,
    };
    if (scope === "retail") {
      set.price = retailPrice;
      set.priceIndia = extras.priceIndia;
      set.priceUs = extras.priceUs;
      set.compareAt = money(body.compareAt);
      set.quantity = extras.quantity;
    } else {
      set.wholesaleFrom = wholesaleFrom;
      set.wholesalePriceIndia = extras.wholesalePriceIndia;
      set.wholesalePriceUs = extras.wholesalePriceUs;
      set.quantity = extras.quantity;
    }
    await col.updateOne({ _id: existing._id }, { $set: set });
    return NextResponse.json({ id: String(existing._id), updated: true });
  }

  const doc: Omit<AdminProduct, "_id"> = {
    ...shared,
    price: scope === "retail" ? retailPrice : wholesaleFrom ?? 0,
    compareAt: money(body.compareAt),
    wholesaleFrom,
    wholesalePriceIndia: extras.wholesalePriceIndia,
    wholesalePriceUs: extras.wholesalePriceUs,
    quantity: extras.quantity,
    priceIndia: extras.priceIndia,
    priceUs: extras.priceUs,
    listedBy: {
      userId: session.user.id,
      name: session.user.name || session.user.email || "Admin",
      email: session.user.email || "",
    },
    createdAt: now,
  };
  const result = await col.insertOne(doc);
  return NextResponse.json({ id: String(result.insertedId) });
}
