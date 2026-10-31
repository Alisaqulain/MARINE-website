import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ai/crm";
import { readUnsubscribeToken, recordConsent, suppress, type ConsentChannel } from "@/lib/ai/followups";

export const dynamic = "force-dynamic";

const CHANNELS: ConsentChannel[] = ["email", "whatsapp", "call"];

/** Customer opt-in / opt-out for follow-ups. The customer gives their own address; nothing is sent here. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(`consent:${ip}`, 10)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const channel = CHANNELS.find((c) => c === body?.channel);
  const address = String(body?.address || "").trim().slice(0, 160);
  const sessionId = typeof body?.sessionId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(body.sessionId) ? body.sessionId : undefined;
  const valid = channel === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) : /^\+?\d[\d\s()-]{7,18}$/.test(address);
  if (!channel || !valid || typeof body?.granted !== "boolean") {
    return NextResponse.json({ error: "Send channel (email, whatsapp or call), a valid address and granted true/false." }, { status: 400 });
  }
  try {
    await recordConsent({ channel, address, granted: body.granted, source: "website", sessionId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Consent was not saved." }, { status: 503 });
  }
}

/** One-click unsubscribe link in follow-up emails (`?u=<signed token>`). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("u") || "";
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return new NextResponse("This unsubscribe link is not valid.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  try {
    await suppress(parsed.channel, parsed.address, "unsubscribe_link");
    await recordConsent({ channel: parsed.channel, address: parsed.address, granted: false, source: "unsubscribe_link" });
  } catch {
    return new NextResponse("We could not process this right now. Please reply STOP to our email instead.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse("You're unsubscribed. Marina Muse will not send you follow-up messages.", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
