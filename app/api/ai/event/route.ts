import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { rateLimit } from "@/lib/ai/crm";

export const dynamic = "force-dynamic";

const TYPES = ["add_to_cart", "begin_checkout"] as const;

/**
 * Shopper journey events for the Growth agent's funnel (add to cart, begin checkout).
 * Stores only the random attribution session id, event type, product slug and quantity — no personal data.
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(`event:${ip}`, 60)) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => null);
  const type = TYPES.find((t) => t === body?.type);
  const sessionId = typeof body?.sessionId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(body.sessionId) ? body.sessionId : "";
  if (!type || !sessionId) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const slug = typeof body?.slug === "string" ? body.slug.slice(0, 200) : undefined;
  const qty = Number.isFinite(Number(body?.qty)) ? Math.max(1, Math.min(10_000, Math.round(Number(body.qty)))) : undefined;
  try {
    const db = await getDb();
    await db.collection("ai_events").insertOne({ type, sessionId, slug, qty, b2b: body?.b2b === true, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Event was not saved." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
