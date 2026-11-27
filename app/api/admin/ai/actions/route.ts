import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { getSiteOrigin } from "@/lib/auth-url";
import { rateLimit } from "@/lib/ai/crm";
import { hasConsent, isSuppressed, type FollowUp } from "@/lib/ai/followups";
import { CONTENT_KINDS, decideContent, generateContentDraft, type ContentKind } from "@/lib/ai/growth-agent";
import { startOutboundCall, syncAssistant } from "@/lib/ai/vapi";
import { agentEnabled } from "@/lib/ai/agents";
import { originMatches } from "@/lib/whatsapp/coexistence";
import { postMessage, resolveCredentials, sendGate, textPayload } from "@/lib/whatsapp/cloud";
import { isDirectMode } from "@/lib/whatsapp/mode";
import { deliveryEventsCollection, messagesCollection, readCoexistenceState } from "@/lib/whatsapp/store";
import { sendManualReply } from "@/lib/whatsapp/manual-reply";
import { isSuperAdminEmail } from "@/lib/staff-access";
import { DUPLICATE_RISK_WARNING, claimResend, completeResend, markResolved, reconcileResend } from "@/lib/whatsapp/recovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Owner actions for the four agents. Billable or outward actions (Vapi config, outbound calls) need the main admin;
 * content drafts need product-edit rights. Every action is written to ai_audit.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");
  const ownerOnly = action === "vapi_sync" || action === "approve_callback" || action === "wa_expand_message" || action === "wa_expand_inbound" || action === "wa_conversation" || action === "wa_manual_reply" || action === "wa_resend" || action === "wa_reconcile_resend";
  const { error, session } = await requireAdminSession(ownerOnly ? "team" : "addProduct");
  if (error) return error;
  const actor = session?.user?.email || "admin";
  if (!rateLimit(`admin-ai:${actor}`, 20)) return NextResponse.json({ error: "Too many actions. Wait a minute." }, { status: 429 });
  const db = await getDb();
  const audit = (detail: Record<string, unknown>) => db.collection("ai_audit").insertOne({ at: new Date().toISOString(), action: `admin_${action}`, actor, ...detail });

  // ── Phase 2 E: WhatsApp reply recovery (no automatic sending anywhere; every action audited) ──
  if (action.startsWith("wa_")) {
    if (!originMatches(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const messages = await messagesCollection();

    if (action === "wa_expand_message") {
      const doc = await messages.findOne({ inReplyTo: id });
      if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
      await audit({ reservation: id.slice(-6) });
      return NextResponse.json({ ok: true, text: String(doc.text || "") });
    }

    if (action === "wa_expand_inbound") {
      const doc = await messages.findOne({ wamid: id, direction: "in" });
      if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
      await audit({ inbound: id.slice(-6) });
      return NextResponse.json({ ok: true, text: String(doc.text || ""), from: String(doc.from || "") });
    }

    // Manual admin reply: main admin only (ownerOnly above), same-origin, rate-limited; window and gates on the server.
    if (action === "wa_manual_reply") {
      // Main admin only (ADMIN_EMAILS), not every admin-role account; a refusal is audited like any other attempt.
      if (!isSuperAdminEmail(actor)) {
        await audit({ inbound: id.slice(-6), result: "refused", reason: "not the main admin" });
        return NextResponse.json({ error: "Only the main admin can send WhatsApp replies.", result: "refused" }, { status: 403 });
      }
      const outcome = await sendManualReply({ inboundWamid: id, text: String(body?.text ?? ""), actor });
      if (outcome.result === "sent") return NextResponse.json({ ok: true, result: "sent" });
      return NextResponse.json({ error: outcome.reason, result: outcome.result }, { status: outcome.result === "refused" ? 409 : 502 });
    }

    if (action === "wa_conversation") {
      if (!isSuperAdminEmail(actor)) return NextResponse.json({ error: "Only the main admin can open WhatsApp conversations." }, { status: 403 });
      const first = await messages.findOne({ wamid: id, direction: "in" });
      const from = String(first?.from || "");
      if (!from) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const rows = await (await getDb())
        .collection("ai_wa_messages")
        .find({ $or: [{ from, direction: "in" }, { to: from, direction: "out" }] }, { projection: { _id: 0, direction: 1, text: 1, at: 1, status: 1, manual: 1 } })
        .sort({ at: 1 })
        .limit(200)
        .toArray();
      await audit({ conversation: from.slice(-4), messages: rows.length });
      return NextResponse.json({
        ok: true,
        from,
        messages: rows.map((r) => ({ direction: r.direction, text: String(r.text ?? ""), at: String(r.at ?? ""), status: r.status, manual: Boolean(r.manual) })),
      });
    }

    if (action === "wa_mark_resolved") {
      const ok = await markResolved(messages, { inReplyTo: id, actor, note: typeof body?.note === "string" ? body.note : "" });
      await audit({ reservation: id.slice(-6), ok });
      return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not in a resolvable state." }, { status: 409 });
    }

    if (action === "wa_reconcile_resend") {
      const outcome = ["resent", "resend_failed", "resend_unknown"].find((o) => o === body?.outcome) as "resent" | "resend_failed" | "resend_unknown" | undefined;
      const claimAt = String(body?.claimAt || "");
      const reason = String(body?.reason || "").trim();
      if (!outcome || !claimAt || reason.length < 5) return NextResponse.json({ error: "outcome, the claim time shown and a reason are required." }, { status: 400 });
      // The admin confirms which claim they reviewed (its timestamp); the server uses that claim's token, so a newer
      // claim can never be reconciled from a stale screen.
      const current = await messages.findOne({ inReplyTo: id });
      const claim = (current?.resendClaim || null) as { token?: string; at?: string } | null;
      if (current?.status !== "resend_claimed" || !claim?.token || claim.at !== claimAt) return NextResponse.json({ error: "No open claim matching the one reviewed. Reload." }, { status: 409 });
      const token = claim.token;
      const evidence = await (await deliveryEventsCollection()).find({ inReplyTo: id }, { limit: 20 }).toArray();
      const ok = await reconcileResend(messages, { inReplyTo: id, token, outcome, actor, reason });
      await audit({ reservation: id.slice(-6), token: token.slice(-6), outcome, reason: reason.slice(0, 200), evidenceRows: evidence.length, ok });
      return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No open claim with that token." }, { status: 409 });
    }

    if (action === "wa_resend") {
      if (!agentEnabled("whatsapp")) return NextResponse.json({ error: "The WhatsApp agent is not enabled (AI_AGENTS_ENABLED); nothing was sent." }, { status: 409 });
      if (body?.confirm !== true || body?.acknowledgeDuplicateRisk !== true) {
        return NextResponse.json({ error: "Confirmation and duplicate-risk acknowledgement are required.", warning: DUPLICATE_RISK_WARNING }, { status: 400 });
      }
      const workerId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
      const claim = await claimResend(messages, { inReplyTo: id, actor, workerId });
      if (!claim.ok) {
        await audit({ reservation: id.slice(-6), ok: false, refused: claim.reason });
        return NextResponse.json({ error: `Resend refused: ${claim.reason}.` }, { status: 409 });
      }
      const to = String(claim.doc.to || "");
      const creds = resolveCredentials(isDirectMode() ? null : await readCoexistenceState());
      const gate = sendGate({ to, suppressed: await isSuppressed("whatsapp", to), template: false, windowOpen: true, consent: false, creds });
      // The claim is recorded before the gate so that a refusal is also an explicit, audited outcome (failed: nothing sent).
      const res = gate.allowed ? await postMessage(creds, textPayload(to, String(claim.doc.text || ""))) : ({ ok: false, delivery: "failed", error: gate.reason } as const);
      const done = await completeResend(messages, await deliveryEventsCollection(), {
        inReplyTo: id,
        token: claim.token,
        result: res.delivery,
        wamid: res.ok ? res.wamid : undefined,
        error: res.ok ? undefined : res.error,
        workerId,
        to,
      });
      await audit({ reservation: id.slice(-6), token: claim.token.slice(-6), warning: DUPLICATE_RISK_WARNING, acknowledged: true, result: res.delivery, status: done.status });
      return res.ok ? NextResponse.json({ ok: true, status: done.status }) : NextResponse.json({ error: res.error, status: done.status }, { status: 502 });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  // Fail-closed agent switch for actions with external side effects.
  if ((action === "vapi_sync" || action === "approve_callback") && !agentEnabled("voice")) {
    return NextResponse.json({ error: "The voice agent is not enabled (AI_AGENTS_ENABLED); nothing was changed at Vapi and no call was placed." }, { status: 409 });
  }

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
    if (!agentEnabled("growth")) return NextResponse.json({ error: "Content drafts are switched off: the Growth agent is not enabled yet (needs Ahmad bhai's approval). Nothing is broken." }, { status: 409 });
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
