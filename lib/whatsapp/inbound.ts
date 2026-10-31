import { getDb } from "@/lib/mongodb";
import { handleCustomerMessage, regionFromPhone } from "@/lib/ai/crm";
import { isSuppressed, recordConsent } from "@/lib/ai/followups";
import type { WaPlan } from "@/lib/whatsapp/coexistence";
import { isOptOut, postMessage, resolveCredentials, sendGate, textPayload, type WaStatusUpdate } from "@/lib/whatsapp/cloud";
import { readCoexistenceState } from "@/lib/whatsapp/store";

const OPT_IN = /^\s*(start|subscribe|yes,? (?:send|keep) me updates)\s*[.!]?\s*$/i;

async function deliver(to: string, body: string, sessionId: string) {
  const db = await getDb();
  const creds = resolveCredentials(await readCoexistenceState());
  const gate = sendGate({ to, suppressed: await isSuppressed("whatsapp", to), template: false, windowOpen: true, consent: false, creds });
  const at = new Date().toISOString();
  if (!gate.allowed) {
    await db.collection("ai_wa_messages").insertOne({ direction: "out", to, sessionId, text: body, status: "withheld", reason: gate.reason, at });
    return { sent: false as const, drafted: true as const, reason: gate.reason };
  }
  const res = await postMessage(creds, textPayload(to, body));
  await db.collection("ai_wa_messages").insertOne({
    direction: "out",
    to,
    sessionId,
    text: body,
    wamid: res.ok ? res.wamid : "",
    status: res.ok ? "sent" : "failed",
    ...(res.ok ? {} : { reason: res.error }),
    at,
  });
  return res.ok ? { sent: true as const, drafted: false as const } : { sent: false as const, drafted: true as const, reason: res.error };
}

/**
 * Agent 4: one WhatsApp conversation per sender. Gemini writes the reply from catalogue facts (shared with chat);
 * it is sent only when every send rule passes, otherwise it is kept as a withheld draft for the admin.
 */
export async function draftInbound(plan: WaPlan) {
  if (plan.action !== "draft" || !plan.text || !plan.messageId) return { sent: false as const, drafted: false as const };
  const from = (plan.from || "").replace(/\D/g, "");
  if (!from) return { sent: false as const, drafted: false as const };
  const sessionId = `wa_${from}`.slice(0, 80);
  try {
    const db = await getDb();
    await db.collection("ai_wa_messages").insertOne({ direction: "in", from, sessionId, wamid: plan.messageId, text: plan.text, at: new Date().toISOString() });

    if (isOptOut(plan.text)) {
      await recordConsent({ channel: "whatsapp", address: from, granted: false, source: "whatsapp_stop", sessionId });
      return deliver(from, "You're unsubscribed and won't receive follow-up messages from Marina Muse. Reply START any time to opt back in.", sessionId);
    }
    if (OPT_IN.test(plan.text)) {
      await db.collection("ai_suppression").deleteOne({ phone: from });
      await recordConsent({ channel: "whatsapp", address: from, granted: true, source: "whatsapp_start", sessionId });
      return deliver(from, "Thank you — you'll receive order and enquiry updates from Marina Muse on WhatsApp. Reply STOP any time to opt out.", sessionId);
    }

    const result = await handleCustomerMessage({
      sessionId,
      message: plan.text,
      region: regionFromPhone(from),
      channel: "whatsapp",
      knownContact: { phone: `+${from}`, ...(plan.profileName ? { name: plan.profileName } : {}) },
    });
    if ("error" in result || !result.reply) return { sent: false as const, drafted: false as const };
    return deliver(from, result.reply, sessionId);
  } catch (err) {
    console.error("[whatsapp] inbound failed", err instanceof Error ? err.message : "failed");
    return { sent: false as const, drafted: false as const };
  }
}

/** Delivery receipts: sent → delivered → read, or failed. Out-of-order receipts never move a message backwards. */
export async function applyStatusUpdates(updates: WaStatusUpdate[]) {
  if (!updates.length) return 0;
  const db = await getDb();
  const order = ["sent", "delivered", "read"];
  let applied = 0;
  for (const update of updates) {
    const current = await db.collection("ai_wa_messages").findOne({ wamid: update.wamid });
    if (!current) continue;
    const before = order.indexOf(String(current.status));
    const after = order.indexOf(update.status);
    if (update.status !== "failed" && after <= before) continue;
    await db.collection("ai_wa_messages").updateOne(
      { wamid: update.wamid },
      { $set: { status: update.status, statusAt: update.at, ...(update.error ? { reason: update.error } : {}) } }
    );
    applied += 1;
  }
  return applied;
}
