import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { blogCategoryCollection, listBlogCategories } from "@/lib/blog-store";
import { slugify } from "@/lib/slugify";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  return NextResponse.json({ items: await listBlogCategories() });
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) ?? {};
  const name = String(body.name ?? "").trim().slice(0, 60);
  const slug = slugify(name);
  if (!name || !slug) {
    return NextResponse.json({ error: "Enter a category name." }, { status: 400 });
  }
  const col = await blogCategoryCollection();
  if (await col.findOne({ slug })) {
    return NextResponse.json({ error: "That category already exists." }, { status: 409 });
  }
  const result = await col.insertOne({ name, slug, createdAt: new Date() });
  return NextResponse.json({ id: String(result.insertedId), name, slug });
}
