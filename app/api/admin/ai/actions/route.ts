import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { getSiteOrigin } from "@/lib/auth-url";
import { rateLimit } from "@/lib/ai/crm";
import { hasConsent, isSuppressed, type FollowUp } from "@/lib/ai/followups";
import { CONTENT_KINDS, decideContent, generateContentDraft, type ContentKind } from "@/lib/ai/growth-agent";
import { startOutboundCall, syncAssistant } from "@/lib/ai/vapi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Owner actions for the four agents. Billable or outward actions (Vapi config, outbound calls) need the main admin;
 * content drafts need product-edit rights. Every action is written to ai_audit.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");
  const ownerOnly = action === "vapi_sync" || action === "approve_callback";
  const { error, session } = await requireAdminSession(ownerOnly ? "team" : "addProduct");
  if (error) return error;
  const actor = session?.user?.email || "admin";
  if (!rateLimit(`admin-ai:${actor}`, 20)) return NextResponse.json({ error: "Too many actions. Wait a minute." }, { status: 429 });
  const db = await getDb();
  const audit = (detail: Record<string, unknown>) => db.collection("ai_audit").insertOne({ at: new Date().toISOString(), action: `admin_${action}`, actor, ...detail });

  if (action === "vapi_sync") {
    const result = await syncAssistant(getSiteOrigin());
    await audit({ ok: result.ok });
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 502 });
  }

  if (action === "approve_callback" || action === "dismiss_followup") {
    const id = String(body?.id || "");
    const row = await db.collection<FollowUp>("ai_followups").findOne({ id });
    if (!row || !["needs_approval", "pending"].includes(row.status)) return NextResponse.json({ error: "Follow-up not found or already handled." }, { status: 404 });
    if (action === "dismiss_followup") {
      await db.collection("ai_followups").updateOne({ id }, { $set: { status: "skipped", lastError: `Dismissed by ${actor}`, updatedAt: new Date().toISOString() } });
      await audit({ followUpId: id });
      return NextResponse.json({ ok: true });
    }
    if (row.channel !== "call") return NextResponse.json({ error: "Only call follow-ups need approval." }, { status: 400 });
    if (await isSuppressed("call", row.to)) return NextResponse.json({ error: "This number opted out of calls." }, { status: 403 });
    if (!(await hasConsent("call", row.to))) return NextResponse.json({ error: "No recorded consent to call this number." }, { status: 403 });
    const call = await startOutboundCall({ number: row.to, leadId: row.leadId });
    await db.collection("ai_followups").updateOne(
      { id },
      { $set: { status: call.ok ? "sent" : "needs_approval", updatedAt: new Date().toISOString(), ...(call.ok ? { callId: call.callId } : { lastError: call.error }) }, $inc: { attempts: 1 } }
    );
    await audit({ followUpId: id, ok: call.ok, callId: call.ok ? call.callId : undefined });
    return call.ok ? NextResponse.json({ ok: true, callId: call.callId }) : NextResponse.json({ error: call.error }, { status: 502 });
  }

  if (action === "generate_content") {
    const kind = CONTENT_KINDS.find((k) => k === body?.kind) as ContentKind | undefined;
    if (!kind) return NextResponse.json({ error: `kind must be one of ${CONTENT_KINDS.join(", ")}` }, { status: 400 });
    const result = await generateContentDraft({
      kind,
      slug: typeof body?.slug === "string" ? body.slug.slice(0, 120) : undefined,
      topic: typeof body?.topic === "string" ? body.topic : undefined,
      actor,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, content: result.content });
  }

  if (action === "decide_content") {
    const status = body?.status === "approved" || body?.status === "rejected" ? body.status : null;
    if (!status) return NextResponse.json({ error: "status must be approved or rejected." }, { status: 400 });
    const result = await decideContent({ id: String(body?.id || ""), status, actor });
    return "error" in result ? NextResponse.json({ error: result.error }, { status: 404 }) : NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
