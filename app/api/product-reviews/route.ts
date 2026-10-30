import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addProductReview, listHomeProductReviews, listProductReviews } from "@/lib/product-reviews";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("home") === "1") {
    try {
      return NextResponse.json({ items: await listHomeProductReviews() });
    } catch {
      return NextResponse.json({ items: [] });
    }
  }
  const slug = params.get("slug")?.trim() ?? "";
  if (!slug) return NextResponse.json({ items: [], count: 0, average: 0 });
  try {
    return NextResponse.json(await listProductReviews(slug));
  } catch {
    return NextResponse.json({ items: [], count: 0, average: 0 });
  }
}

/** Signed-in customers can rate and review any product; the review is saved under their account name. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to write a review." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const productSlug = String(body?.productSlug ?? "").trim().slice(0, 200);
  const productName = String(body?.productName ?? "").trim().slice(0, 300);
  const rating = Math.round(Number(body?.rating));
  const text = String(body?.body ?? "").trim().slice(0, 2000);
  if (!productSlug) return NextResponse.json({ error: "Product is missing." }, { status: 400 });
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Choose a star rating from 1 to 5." }, { status: 400 });
  }
  if (text.length < 3) return NextResponse.json({ error: "Please write a short review." }, { status: 400 });

  const name = (session.user.name || session.user.email?.split("@")[0] || "Customer").slice(0, 120);
  try {
    const review = await addProductReview({
      productSlug,
      productName: productName || productSlug,
      rating,
      body: text,
      name,
      email: session.user.email ?? undefined,
      userId: session.user.id,
    });
    return NextResponse.json({ review });
  } catch {
    return NextResponse.json({ error: "Could not save your review. Please try again." }, { status: 500 });
  }
}
