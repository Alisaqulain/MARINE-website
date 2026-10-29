import { recordTouch } from "@/lib/ai/growth";
import { rateLimit } from "@/lib/ai/crm";
import { sourceFromVisit, type Touch } from "@/lib/ai/attribution";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(`attr:${ip}`, 30)) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => null);
  const sessionId = String(body?.sessionId || "");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }
  const touch: Touch = {
    source: sourceFromVisit({
      referrer: typeof body?.referrer === "string" ? body.referrer.slice(0, 300) : "",
      utmSource: typeof body?.utmSource === "string" ? body.utmSource.slice(0, 80) : "",
      utmMedium: typeof body?.utmMedium === "string" ? body.utmMedium.slice(0, 80) : "",
    }),
    at: new Date().toISOString(),
    campaign: typeof body?.utmCampaign === "string" ? body.utmCampaign.slice(0, 80) : undefined,
    landingPath: typeof body?.path === "string" ? body.path.slice(0, 200) : undefined,
    referrer: typeof body?.referrer === "string" ? body.referrer.slice(0, 300) : undefined,
  };
  try {
    await recordTouch({ sessionId, touch });
  } catch (err) {
    console.error("[attribution]", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Attribution was not saved." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, source: touch.source });
}
