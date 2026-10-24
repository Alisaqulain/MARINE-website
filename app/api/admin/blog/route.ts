import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { blogCollection, listAllPosts, readBlogInput } from "@/lib/blog-store";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  try {
    return NextResponse.json({ items: await listAllPosts() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load blog posts.";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const input = readBlogInput((await req.json().catch(() => ({}))) ?? {});
  if (!input.title || !input.slug) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (input.published && !input.body.length) {
    return NextResponse.json({ error: "Write the article text." }, { status: 400 });
  }
  const col = await blogCollection();
  if (await col.findOne({ slug: input.slug })) {
    return NextResponse.json({ error: "A post with this URL already exists. Change the title or URL." }, { status: 409 });
  }
  const now = new Date();
  const result = await col.insertOne({ ...input, createdAt: now, updatedAt: now });
  return NextResponse.json({ id: String(result.insertedId), slug: input.slug });
}
