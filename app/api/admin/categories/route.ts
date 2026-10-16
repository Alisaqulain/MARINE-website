import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { loadCategoryCatalog, takenCategorySlugs, uniqueCategorySlug } from "@/lib/shop-categories";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  return NextResponse.json(await loadCategoryCatalog());
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const parentSlug = String(body.parentSlug ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }
  const db = await getDb();
  const existing = await db.collection("shop_categories").find({}, { projection: { slug: 1 } }).toArray();
  const taken = takenCategorySlugs(existing.map((doc) => String(doc.slug ?? "")));
  const slug = uniqueCategorySlug(name, taken);
  await db.collection("shop_categories").insertOne({
    name,
    slug,
    parentSlug: parentSlug || undefined,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true, ...(await loadCategoryCatalog()) });
}
