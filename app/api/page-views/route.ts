import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/page-views";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path : "";
  if (!path.startsWith("/") || path.startsWith("//")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }
  if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/_next")) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const ua = req.headers.get("user-agent") ?? undefined;
  const visitorId =
    typeof body?.visitorId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.visitorId) ? body.visitorId : undefined;
  await recordPageView(path, ua, visitorId);
  return NextResponse.json({ ok: true });
}
