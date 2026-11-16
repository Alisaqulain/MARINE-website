import { NextResponse } from "next/server";
import { cronAllowed } from "@/lib/ai/cron";
import { recordJobRun, runFollowUps } from "@/lib/ai/followups";
import { acquireJobLease, releaseJobLease } from "@/lib/ai/job-lease";
import { messagesCollection } from "@/lib/whatsapp/store";
import { sweepReservations } from "@/lib/whatsapp/recovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Follow-up job (checkout and enquiry recovery) plus the WhatsApp reservation sweep (Phase 2 E: status labels only,
 * never a send). Schedule every 15 minutes with `Authorization: Bearer $CRON_SECRET`. A lease stops overlapping runs.
 */
export async function POST(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lease = await acquireJobLease("followups").catch(() => null);
  if (!lease) return NextResponse.json({ error: "Job lease unavailable." }, { status: 503 });
  if (!lease.ok) return NextResponse.json({ ok: true, skipped: "already running" }, { status: 409 });
  try {
    const summary = await runFollowUps();
    const sweep = await sweepReservations(await messagesCollection());
    await recordJobRun("followups", true, { ...summary, sweep });
    return NextResponse.json({ ok: true, ...summary, sweep });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "Job failed";
    await recordJobRun("followups", false, { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 503 });
  } finally {
    await releaseJobLease("followups", lease.token).catch(() => undefined);
  }
}

export const GET = POST;
