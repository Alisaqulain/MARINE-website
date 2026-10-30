import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { storeImage } from "@/lib/image-upload";
import { addProductReview, listHomeProductReviews, listProductReviews } from "@/lib/product-reviews";

export const runtime = "nodejs";

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

const MAX_IMAGES = 5;
const MAX_IMAGE_MB = 5;
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Signed-in customers can rate and review any product; the review is saved under their account name. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to write a review." }, { status: 401 });
  }
  // Multipart when the customer attaches photos; plain JSON still works.
  const multipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");
  const form = multipart ? await req.formData().catch(() => null) : null;
  const body = multipart
    ? form && Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"))
    : await req.json().catch(() => null);
  const productSlug = String(body?.productSlug ?? "").trim().slice(0, 200);
  const productName = String(body?.productName ?? "").trim().slice(0, 300);
  const rating = Math.round(Number(body?.rating));
  const text = String(body?.body ?? "").trim().slice(0, 2000);
  if (!productSlug) return NextResponse.json({ error: "Product is missing." }, { status: 400 });
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Choose a star rating from 1 to 5." }, { status: 400 });
  }
  if (text.length < 3) return NextResponse.json({ error: "Please write a short review." }, { status: 400 });

  const files = (form?.getAll("images") ?? []).filter((v): v is File => v instanceof Blob && v.size > 0);
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `You can attach up to ${MAX_IMAGES} photos.` }, { status: 400 });
  }
  for (const file of files) {
    if (!IMAGE_EXT[file.type]) {
      return NextResponse.json({ error: "Photos must be JPG, PNG, WebP or GIF." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Each photo must be under ${MAX_IMAGE_MB} MB.` }, { status: 400 });
    }
  }

  const name = (session.user.name || session.user.email?.split("@")[0] || "Customer").slice(0, 120);
  try {
    const images: string[] = [];
    for (const [i, file] of files.entries()) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await storeImage(req, bytes, `review-${i + 1}.${IMAGE_EXT[file.type]}`);
      images.push(stored.path ?? stored.url);
    }
    const review = await addProductReview({
      productSlug,
      productName: productName || productSlug,
      rating,
      body: text,
      images,
      name,
      email: session.user.email ?? undefined,
      userId: session.user.id,
    });
    return NextResponse.json({ review });
  } catch {
    return NextResponse.json({ error: "Could not save your review. Please try again." }, { status: 500 });
  }
}
