import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { AdminProduct } from "@/lib/db/types";
import { parseProductExtras } from "@/lib/product-fields";

type Ctx = { params: Promise<{ id: string }> };

function money(value: unknown) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const body = await req.json();
  // "both" lists one product on retail and wholesale and saves both price sets.
  const scope: AdminProduct["channel"] =
    body.priceScope === "both" ? "both" : body.priceScope === "wholesale" ? "wholesale" : "retail";
  const extras = parseProductExtras(body);
  const update: Partial<AdminProduct> = {
    updatedAt: new Date(),
    categories: extras.categories,
    imageAdjust: extras.imageAdjust,
    colors: extras.colors,
    materials: extras.materials,
    sizes: extras.sizes,
    images: extras.images,
    personalisationPrice: extras.personalisationPrice,
    b2cOutOfStock: extras.b2cOutOfStock,
    b2bOutOfScope: extras.b2bOutOfScope,
    stock: extras.stock,
    channel: scope,
    tags: extras.tags,
  };

  if (body.name != null) update.name = String(body.name);
  if (body.sku != null) update.sku = String(body.sku);
  if (body.image != null) update.image = String(body.image);
  if (body.description != null) update.description = String(body.description);
  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.freeShipping === "boolean") update.freeShipping = body.freeShipping;

  const unset: Record<string, 1> = {};

  update.quantity = extras.quantity;
  if (scope !== "wholesale") {
    if (body.price != null && body.price !== "") update.price = Number(body.price);
    update.priceIndia = extras.priceIndia;
    update.priceUs = extras.priceUs;
    update.compareAt = money(body.compareAt);
    if (body.priceIndia === "") {
      delete update.priceIndia;
      unset.priceIndia = 1;
    }
    if (body.priceUs === "") {
      delete update.priceUs;
      unset.priceUs = 1;
    }
  }
  if (scope !== "retail") {
    update.wholesaleFrom = money(body.wholesaleFrom);
    update.wholesalePriceIndia = extras.wholesalePriceIndia;
    update.wholesalePriceUs = extras.wholesalePriceUs;
    if (body.wholesaleFrom === "") {
      delete update.wholesaleFrom;
      unset.wholesaleFrom = 1;
    }
    if (body.wholesalePriceIndia === "") {
      delete update.wholesalePriceIndia;
      unset.wholesalePriceIndia = 1;
    }
    if (body.wholesalePriceUs === "") {
      delete update.wholesalePriceUs;
      unset.wholesalePriceUs = 1;
    }
  }

  const db = await getDb();
  const col = db.collection<AdminProduct>("products");
  const oid = new ObjectId(id);
  const existing = await col.findOne({ _id: oid });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  await col.updateOne({ _id: oid }, { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<AdminProduct>("products").deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
