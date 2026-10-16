import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { loadCategoryCatalog } from "@/lib/shop-categories";

function builtinSlug(id: string) {
  return id.startsWith("builtin__") ? id.slice("builtin__".length) : "";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }
  const db = await getDb();
  const slug = builtinSlug(decoded);
  if (slug) {
    await db.collection("category_overrides").updateOne(
      { slug },
      { $set: { slug, name, deleted: false, updatedAt: new Date() } },
      { upsert: true }
    );
  } else if (ObjectId.isValid(decoded)) {
    await db.collection("shop_categories").updateOne(
      { _id: new ObjectId(decoded) },
      { $set: { name, updatedAt: new Date() } }
    );
  } else {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...(await loadCategoryCatalog()) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const db = await getDb();
  const slug = builtinSlug(decoded);
  if (slug) {
    await db.collection("category_overrides").updateOne(
      { slug },
      { $set: { slug, deleted: true, updatedAt: new Date() } },
      { upsert: true }
    );
  } else if (ObjectId.isValid(decoded)) {
    const doc = await db.collection("shop_categories").findOne({ _id: new ObjectId(decoded) });
    if (doc?.slug) {
      const drop = new Set<string>([String(doc.slug)]);
      let growing = true;
      while (growing) {
        growing = false;
        const children = await db
          .collection("shop_categories")
          .find({ parentSlug: { $in: [...drop] } })
          .toArray();
        for (const child of children) {
          const childSlug = String(child.slug ?? "");
          if (childSlug && !drop.has(childSlug)) {
            drop.add(childSlug);
            growing = true;
          }
        }
      }
      await db.collection("shop_categories").deleteMany({ slug: { $in: [...drop] } });
    }
  } else {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...(await loadCategoryCatalog()) });
}
