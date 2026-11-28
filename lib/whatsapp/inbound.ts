import { getDb } from "@/lib/mongodb";
import { handleCustomerMessage, regionFromPhone } from "@/lib/ai/crm";
import { agentEnabled } from "@/lib/ai/agents";
import { isSuppressed, recordConsent } from "@/lib/ai/followups";
import { HUMAN_TAKEOVER_HOURS, type CoexistenceUpdates, type WaPlan } from "@/lib/whatsapp/coexistence";
import { isOptOut, postMessage, resolveCredentials, sendGate, textPayload, type WaStatusUpdate } from "@/lib/whatsapp/cloud";
import { readCoexistenceState, updateOnboardingFields, messagesCollection, deliveryEventsCollection } from "@/lib/whatsapp/store";
import { finishOriginal, newToken, withholdOriginal } from "@/lib/whatsapp/recovery";
import { isDirectMode } from "@/lib/whatsapp/mode";
import { isDuplicateKeyError, recordInboundOnce, reserveReply } from "@/lib/whatsapp/event-claims";

const OPT_IN = /^\s*(start|subscribe|yes,? (?:send|keep) me updates)\s*[.!]?\s*$/i;

/**
 * Sends (or withholds) the single reply to inbound message `inReplyTo`.
 * C5: the reply is RESERVED (unique per inReplyTo) before any gate or send, so a webhook retry can never send twice;
 * a retry that finds the reservation does nothing. Database errors propagate (the webhook answers 500).
 * C2: in direct mode no Coexistence state is read; the mode-aware sendGate decides.
 */
async function deliver(to: string, body: string, sessionId: string, inReplyTo: string, options: { system?: boolean; inboundAt?: number } = {}) {
  const db = await getDb();
  const messages = await messagesCollection();
  const at = new Date().toISOString();
  // Phase 2 E: sendToken fences this worker; inboundAt (Meta timestamp) is the only reply-window clock.
  const sendToken = newToken();
  const reservation = await reserveReply(messages, inReplyTo, {
    direction: "out",
    to,
    sessionId,
    text: body,
    at,
    sendToken,
    ...(typeof options.inboundAt === "number" ? { inboundAt: options.inboundAt } : {}),
  });
  if (!reservation.reserved) return { sent: false as const, drafted: false as const, reason: "already handled" };

  const state = isDirectMode() ? null : await readCoexistenceState();
  const creds = resolveCredentials(state);
  // The owner replied from the WhatsApp Business app recently: keep the AI quiet (opt-out confirmations still go out).
  const session = options.system ? null : await db.collection("ai_sessions").findOne({ id: sessionId }, { projection: { humanTakeoverUntil: 1 } });
  if (typeof session?.humanTakeoverUntil === "string" && session.humanTakeoverUntil > at) {
    const reason = "The business is replying from the WhatsApp Business app, so the AI reply was held.";
    await withholdOriginal(messages, inReplyTo, sendToken, reason);
    return { sent: false as const, drafted: true as const, reason };
  }
  const gate = sendGate({
    to,
    suppressed: await isSuppressed("whatsapp", to),
    template: false,
    windowOpen: true,
    consent: false,
    creds,
    ...(state ? { businessNumber: state.displayNumber } : {}),
  });
  if (!gate.allowed) {
    await withholdOriginal(messages, inReplyTo, sendToken, gate.reason);
    return { sent: false as const, drafted: true as const, reason: gate.reason };
  }
  // Phase 2 D: one attempt, never retried. Evidence is written before the guarded status change (finishOriginal).
  // If the status write fails after a successful send, the reservation stays "pending" → the sweep marks it stale →
  // an admin decides; nothing is ever resent automatically.
  const res = await postMessage(creds, textPayload(to, body));
  const events = await deliveryEventsCollection();
  await finishOriginal(messages, events, {
    inReplyTo,
    sendToken,
    result: res.delivery,
    wamid: res.ok ? res.wamid : undefined,
    error: res.ok ? undefined : res.error,
  });
  return res.ok ? { sent: true as const, drafted: false as const } : { sent: false as const, drafted: true as const, reason: res.error };
}

/**
 * Agent 4: one WhatsApp conversation per sender. Gemini writes the reply from catalogue facts (shared with chat);
 * it is sent only when every send rule passes, otherwise it is kept as a withheld draft for the admin.
 * C5: the inbound record is written at most once per wamid; a retry skips the AI when a reply is already reserved;
 * any error propagates so the webhook answers 500 and the event is retried (it is not marked done).
 */
export async function draftInbound(plan: WaPlan) {
  if (plan.action !== "draft" || !plan.text || !plan.messageId) return { sent: false as const, drafted: false as const };
  const from = (plan.from || "").replace(/\D/g, "");
  if (!from) return { sent: false as const, drafted: false as const };
  const sessionId = `wa_${from}`.slice(0, 80);
  const wamid = plan.messageId;
  try {
    const db = await getDb();
    const messages = await messagesCollection();
    await recordInboundOnce(messages, { from, sessionId, wamid, text: plan.text, at: new Date().toISOString() });
    if (await messages.findOne({ inReplyTo: wamid })) return { sent: false as const, drafted: false as const };

    if (isOptOut(plan.text)) {
      await recordConsent({ channel: "whatsapp", address: from, granted: false, source: "whatsapp_stop", sessionId });
      // Consent is always recorded; the confirmation is a send, so it needs the WhatsApp agent (fail-closed).
      if (!agentEnabled("whatsapp")) return { sent: false as const, drafted: false as const };
      return deliver(from, "You're unsubscribed and won't receive follow-up messages from Marina Muse. Reply START any time to opt back in.", sessionId, wamid, { system: true, inboundAt: plan.inboundAt });
    }
    if (OPT_IN.test(plan.text)) {
      await db.collection("ai_suppression").deleteOne({ phone: from });
      await recordConsent({ channel: "whatsapp", address: from, granted: true, source: "whatsapp_start", sessionId });
      if (!agentEnabled("whatsapp")) return { sent: false as const, drafted: false as const };
      return deliver(from, "Thank you — you'll receive order and enquiry updates from Marina Muse on WhatsApp. Reply STOP any time to opt out.", sessionId, wamid, { system: true, inboundAt: plan.inboundAt });
    }

    // Agent not enabled (fail-closed switch, lib/ai/agents.ts): the message is kept for the team, no AI reply is drafted.
    if (!agentEnabled("whatsapp")) return { sent: false as const, drafted: false as const };

    // When the customer replied to a specific message, show the AI which one (otherwise "this" has no meaning).
    let quoted = "";
    if (plan.contextId) {
      const original = await db.collection("ai_wa_messages").findOne({ wamid: plan.contextId }, { projection: { text: 1 } });
      if (typeof original?.text === "string" && original.text.trim()) quoted = original.text.trim().slice(0, 800);
    }
    const result = await handleCustomerMessage({
      sessionId,
      message: quoted ? `${plan.text}\n\n(The customer is replying to this earlier message: "${quoted}")` : plan.text,
      region: regionFromPhone(from),
      channel: "whatsapp",
      knownContact: { phone: `+${from}`, ...(plan.profileName ? { name: plan.profileName } : {}) },
    });
    if ("error" in result || !result.reply) return { sent: false as const, drafted: false as const };
    return deliver(from, result.reply, sessionId, wamid, { inboundAt: plan.inboundAt });
  } catch (err) {
    // Fixed label only (no message text, numbers or error details); the error goes up so the event is retried.
    console.error("[whatsapp] inbound failed");
    throw err;
  }
}

/**
 * Coexistence data from the WhatsApp Business app. Only keys the duplicate store saw for the first time are applied.
 * History and business-app messages become conversation context for the CRM and AI; nothing here sends a message.
 */
export async function applyCoexistenceUpdates(updates: CoexistenceUpdates, newKeys: Set<string>) {
  const db = await getDb();
  const counts = { historyMessages: 0, contacts: 0, echoes: 0 };

  for (const chunk of updates.history.filter((h) => newKeys.has(h.key))) {
    const now = new Date().toISOString();
    if (chunk.declined) {
      await updateOnboardingFields({ historyStatus: { phase: chunk.phase, progress: chunk.progress, declined: true, updatedAt: now } });
      continue;
    }
    await updateOnboardingFields({ historyStatus: { phase: chunk.phase, progress: chunk.progress, declined: false, updatedAt: now } });
    for (const m of chunk.messages.slice(0, 1000)) {
      if (await db.collection("ai_wa_messages").findOne({ wamid: m.id }, { projection: { _id: 1 } })) continue;
      const sessionId = `wa_${m.customer}`.slice(0, 80);
      try {
        await db.collection("ai_wa_messages").insertOne({
          direction: m.fromBusiness ? "out" : "in",
          source: "history",
          ...(m.fromBusiness ? { to: m.customer } : { from: m.customer }),
          sessionId,
          wamid: m.id,
          type: m.type,
          text: m.text,
          status: "history",
          at: m.timestamp,
        });
      } catch (err) {
        // C5: the same message was recorded concurrently (unique inbound index) — already present.
        if (isDuplicateKeyError(err)) continue;
        throw err;
      }
      if (m.text) {
        // C5: keyed by wamid so a redelivery after a partial failure does not add the line twice.
        await db
          .collection("ai_messages")
          .updateOne({ sessionId, wamid: m.id, source: "history" }, { $setOnInsert: { sessionId, wamid: m.id, role: m.fromBusiness ? "business" : "customer", text: m.text, source: "history", at: m.timestamp } }, { upsert: true });
      }
      counts.historyMessages += 1;
    }
  }

  for (const contact of updates.contacts.filter((c) => newKeys.has(c.key))) {
    await db.collection("wa_contacts").updateOne(
      { phone: contact.phone },
      {
        $set: {
          phone: contact.phone,
          removed: contact.action === "remove",
          ...(contact.fullName ? { fullName: contact.fullName } : {}),
          ...(contact.firstName ? { firstName: contact.firstName } : {}),
          source: "business_app",
          updatedAt: contact.at,
        },
      },
      { upsert: true }
    );
    counts.contacts += 1;
  }

  for (const echo of updates.echoes.filter((e) => newKeys.has(e.key))) {
    if (!echo.customer) continue;
    const sessionId = `wa_${echo.customer}`.slice(0, 80);
    if (echo.revokeOf) {
      await db.collection("ai_wa_messages").updateOne({ wamid: echo.revokeOf }, { $set: { status: "revoked", text: null } });
    } else if (echo.editOf) {
      await db.collection("ai_wa_messages").updateOne({ wamid: echo.editOf }, { $set: { text: echo.text, editedAt: echo.timestamp } });
    } else if (!echo.id) {
      // No wamid to key on (not expected from Meta): recorded as before, without the retry guarantee.
      await db.collection("ai_wa_messages").insertOne({ direction: "out", source: "business_app", to: echo.customer, sessionId, wamid: "", type: echo.type, text: echo.text, status: "sent", at: echo.timestamp });
    } else {
      // C5: upserts keyed by the echo's wamid, so a redelivery after a partial failure writes nothing twice.
      await db.collection("ai_wa_messages").updateOne(
        { wamid: echo.id, source: "business_app" },
        { $setOnInsert: { direction: "out", source: "business_app", to: echo.customer, sessionId, wamid: echo.id, type: echo.type, text: echo.text, status: "sent", at: echo.timestamp } },
        { upsert: true }
      );
      if (echo.text) {
        await db
          .collection("ai_messages")
          .updateOne({ sessionId, wamid: echo.id, source: "business_app" }, { $setOnInsert: { sessionId, wamid: echo.id, role: "business", text: echo.text, source: "business_app", at: echo.timestamp } }, { upsert: true });
      }
    }
    // A person is handling this chat from the phone: the AI must not reply on top of them.
    await db.collection("ai_sessions").updateOne(
      { id: sessionId },
      { $set: { id: sessionId, channel: "whatsapp", humanTakeoverUntil: new Date(Date.now() + HUMAN_TAKEOVER_HOURS * 3_600_000).toISOString() } },
      { upsert: true }
    );
    counts.echoes += 1;
  }
  return counts;
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
    // Phase 2 E: matched by wamid only. Receipts update the provider delivery status; they change the record's
    // `status` only while it is in the plain sent → delivered → read flow, never a recovery lifecycle state
    // (sent_late, resolved, expired, resent, …), so a receipt can never reopen or close a recovery record.
    await db.collection("ai_wa_delivery_events").updateMany({ wamid: update.wamid }, { $set: { deliveryStatus: update.status, deliveryStatusAt: update.at } });
    const before = order.indexOf(String(current.status));
    const after = order.indexOf(update.status);
    if (before < 0) {
      await db.collection("ai_wa_messages").updateOne({ wamid: update.wamid }, { $set: { deliveryStatus: update.status, statusAt: update.at, ...(update.error ? { deliveryError: update.error } : {}) } });
      applied += 1;
      continue;
    }
    if (update.status !== "failed" && after <= before) continue;
    await db.collection("ai_wa_messages").updateOne(
      { wamid: update.wamid },
      { $set: { status: update.status, deliveryStatus: update.status, statusAt: update.at, ...(update.error ? { reason: update.error } : {}) } }
    );
    applied += 1;
  }
  return applied;
}
