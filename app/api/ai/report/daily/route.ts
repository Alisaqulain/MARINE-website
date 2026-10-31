import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { cronAllowed } from "@/lib/ai/cron";
import { buildDailyReport, sendDailyReport } from "@/lib/ai/daily-report";
import { recordJobRun } from "@/lib/ai/followups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily owner report. A scheduler calls it with `Authorization: Bearer $CRON_SECRET` to email the report.
 * An admin can preview it in the browser with `?dry=1` (nothing is sent).
 */
export async function GET(req: Request) {
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const fromCron = cronAllowed(req);
  if (!fromCron) {
    const { error } = await requireAdminSession("view");
    if (error) return error;
    if (!dry) return NextResponse.json({ error: "Use ?dry=1 to preview. Sending needs the CRON_SECRET bearer token." }, { status: 403 });
  }
  try {
    if (dry) {
      const report = await buildDailyReport();
      return new NextResponse(`${report.subject}\n\n${report.text}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    const report = await sendDailyReport();
    await recordJobRun("daily_report", true, { subject: report.subject });
    return NextResponse.json({ ok: true, subject: report.subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report failed";
    if (fromCron) await recordJobRun("daily_report", false, { error: message.slice(0, 200) }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export const POST = GET;
