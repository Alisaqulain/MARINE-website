import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireAdminSession } from "@/lib/admin-auth";
import { isDashboardRole } from "@/lib/staff-access";
import {
  catalogProductsForAdmin,
  mergeAdminProducts,
  type AdminProductRow,
} from "@/lib/admin-catalog";
import { getDb } from "@/lib/mongodb";
import type { AdminProduct } from "@/lib/db/types";
import { slugify } from "@/lib/slugify";
import { parseProductExtras } from "@/lib/product-fields";

export async function GET(req: Request) {
  const session = await auth();
  if (!isDashboardRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const channelParam = searchParams.get("channel");
  const channel =
    channelParam === "retail" || channelParam === "wholesale" ? channelParam : null;

  const catalog = catalogProductsForAdmin(channel);

  const db = await getDb();
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
  }));

  const allItems = mergeAdminProducts(catalog, mongo);
  const q = searchParams.get("q")?.trim().toLowerCase();
  let items = allItems;
  if (q) {
    items = items.filter((p) => {
      const hay = `${p.name} ${p.slug} ${p.sku ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

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

  const extras = parseProductExtras(body);
  const doc: Omit<AdminProduct, "_id"> = {
    slug,
    name,
    sku: String(body.sku ?? ""),
    price: Number(body.price ?? 0),
    compareAt:
      body.compareAt != null && body.compareAt !== "" ? Number(body.compareAt) : undefined,
    wholesaleFrom:
      body.wholesaleFrom != null && body.wholesaleFrom !== "" ? Number(body.wholesaleFrom) : undefined,
    quantity: extras.quantity,
    b2cOutOfStock: extras.b2cOutOfStock,
    b2bOutOfScope: extras.b2bOutOfScope,
    image: extras.images?.[0]?.url || String(body.image ?? ""),
    images: extras.images,
    personalisationPrice: extras.personalisationPrice,
    description: String(body.description ?? ""),
    channel: "both",
    stock: extras.stock,
    active: body.active !== false,
    freeShipping: body.freeShipping !== false,
    categories: extras.categories,
    imageAdjust: extras.imageAdjust,
    colors: extras.colors,
    materials: extras.materials,
    sizes: extras.sizes,
    tags: extras.tags,
    priceIndia: extras.priceIndia,
    priceUs: extras.priceUs,
    listedBy: {
      userId: session.user.id,
      name: session.user.name || session.user.email || "Admin",
      email: session.user.email || "",
    },
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const col = db.collection<AdminProduct>("products");
  const existing = await col.findOne({ slug: doc.slug });
  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      { $set: { ...doc, listedBy: existing.listedBy ?? doc.listedBy, createdAt: existing.createdAt, updatedAt: now } }
    );
    return NextResponse.json({ id: String(existing._id), updated: true });
  }
  const result = await col.insertOne(doc);
  return NextResponse.json({ id: String(result.insertedId) });
}
