import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { AdminProduct } from "@/lib/db/types";
import { parseProductExtras } from "@/lib/product-fields";

type Ctx = { params: Promise<{ id: string }> };

function parseBody(body: Record<string, unknown>) {
  return {
    name: body.name != null ? String(body.name) : undefined,
    sku: body.sku != null ? String(body.sku) : undefined,
    price: body.price != null ? Number(body.price) : undefined,
    compareAt: body.compareAt != null && body.compareAt !== "" ? Number(body.compareAt) : undefined,
    wholesaleFrom:
      body.wholesaleFrom != null && body.wholesaleFrom !== "" ? Number(body.wholesaleFrom) : undefined,
    quantity: body.quantity != null && body.quantity !== "" ? Number(body.quantity) : undefined,
    image: body.image != null ? String(body.image) : undefined,
    description: body.description != null ? String(body.description) : undefined,
    channel:
      body.channel === "wholesale" || body.channel === "retail" || body.channel === "both"
        ? (body.channel as AdminProduct["channel"])
        : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined,
    freeShipping: typeof body.freeShipping === "boolean" ? body.freeShipping : undefined,
  };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const body = await req.json();
  const fields = parseBody(body);
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
    quantity: extras.quantity,
    stock: extras.stock,
    channel: "both",
  };
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.sku !== undefined) update.sku = fields.sku;
  if (fields.price !== undefined) update.price = fields.price;
  if (fields.compareAt !== undefined) update.compareAt = fields.compareAt;
  if (fields.wholesaleFrom !== undefined) update.wholesaleFrom = fields.wholesaleFrom;
  if (fields.quantity !== undefined) update.quantity = fields.quantity;
  if (fields.image !== undefined) update.image = fields.image;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.active !== undefined) update.active = fields.active;
  if (fields.freeShipping !== undefined) update.freeShipping = fields.freeShipping;

  const db = await getDb();
  const col = db.collection<AdminProduct>("products");
  const oid = new ObjectId(id);
  const existing = await col.findOne({ _id: oid });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  await col.updateOne({ _id: oid }, { $set: update });
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
