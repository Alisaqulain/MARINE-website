import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { blogCategoryCollection, blogCollection } from "@/lib/blog-store";

/** Rename a category. The slug stays the same so existing posts keep their category. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) ?? {};
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) {
    return NextResponse.json({ error: "Enter a category name." }, { status: 400 });
  }
  const col = await blogCategoryCollection();
  const result = await col.updateOne({ _id: new ObjectId(id) }, { $set: { name } });
  if (!result.matchedCount) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Delete a category; its posts stay published and show under "All". */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  const col = await blogCategoryCollection();
  const doc = await col.findOneAndDelete({ _id: new ObjectId(id) });
  if (doc?.slug) {
    const posts = await blogCollection();
    await posts.updateMany({ category: doc.slug }, { $set: { category: "" } });
  }
  return NextResponse.json({ ok: true });
}
