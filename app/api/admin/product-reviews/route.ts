import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { deleteProductReview, listAllProductReviews, updateProductReview } from "@/lib/product-reviews";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  try {
    return NextResponse.json({ items: await listAllProductReviews() });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const body = await req.json().catch(() => null);
  const flags: { published?: boolean; showOnHome?: boolean } = {};
  if (typeof body?.published === "boolean") flags.published = body.published;
  if (typeof body?.showOnHome === "boolean") flags.showOnHome = body.showOnHome;
  if (!Object.keys(flags).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const ok = await updateProductReview(String(body.id ?? ""), flags);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Review not found." }, { status: 404 });
}

export async function DELETE(req: Request) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const ok = await deleteProductReview(new URL(req.url).searchParams.get("id") ?? "");
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Review not found." }, { status: 404 });
}
