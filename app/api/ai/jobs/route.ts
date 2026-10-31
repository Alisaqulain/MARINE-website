import { NextResponse } from "next/server";
import { cronAllowed } from "@/lib/ai/cron";
import { recordJobRun, runFollowUps } from "@/lib/ai/followups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Follow-up job (checkout and enquiry recovery). Schedule every 15 minutes with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await runFollowUps();
    await recordJobRun("followups", true, summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "Job failed";
    await recordJobRun("followups", false, { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export const GET = POST;
