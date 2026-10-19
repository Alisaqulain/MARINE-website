import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { blogCollection, readBlogInput } from "@/lib/blog-store";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid post." }, { status: 400 });
  }
  const input = readBlogInput((await req.json().catch(() => ({}))) ?? {});
  if (!input.title || !input.slug) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!input.body.length) {
    return NextResponse.json({ error: "Write the article text." }, { status: 400 });
  }
  const col = await blogCollection();
  const _id = new ObjectId(id);
  if (await col.findOne({ slug: input.slug, _id: { $ne: _id } })) {
    return NextResponse.json({ error: "Another post already uses this URL." }, { status: 409 });
  }
  const result = await col.updateOne({ _id }, { $set: { ...input, updatedAt: new Date() } });
  if (!result.matchedCount) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, slug: input.slug });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid post." }, { status: 400 });
  }
  const col = await blogCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}
