import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * Wishlists live in each shopper's browser, so every heart tap is also logged here.
 * Admin "Listing stats" counts favourites from these events.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim().slice(0, 200) : "";
  const action = body?.action === "remove" ? "remove" : body?.action === "add" ? "add" : null;
  if (!slug || !action) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const visitorId =
    typeof body?.visitorId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.visitorId) ? body.visitorId : undefined;
  try {
    const db = await getDb();
    const channel = body?.channel === "wholesale" ? "wholesale" : "retail";
    await db.collection("favourite_events").insertOne({ slug, action, visitorId, channel, at: new Date().toISOString() });
  } catch {
    /* Stats are best-effort; the wishlist itself still works. */
  }
  return NextResponse.json({ ok: true });
}
