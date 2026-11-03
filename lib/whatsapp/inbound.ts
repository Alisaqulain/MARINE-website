import { getDb } from "@/lib/mongodb";
import { handleCustomerMessage, regionFromPhone } from "@/lib/ai/crm";
import { agentEnabled } from "@/lib/ai/agents";
import { isSuppressed, recordConsent } from "@/lib/ai/followups";
import { HUMAN_TAKEOVER_HOURS, type CoexistenceUpdates, type WaPlan } from "@/lib/whatsapp/coexistence";
import { isOptOut, postMessage, resolveCredentials, sendGate, textPayload, type WaStatusUpdate } from "@/lib/whatsapp/cloud";
import { readCoexistenceState, updateOnboardingFields } from "@/lib/whatsapp/store";

const OPT_IN = /^\s*(start|subscribe|yes,? (?:send|keep) me updates)\s*[.!]?\s*$/i;

async function deliver(to: string, body: string, sessionId: string, options: { system?: boolean } = {}) {
  const db = await getDb();
  const state = await readCoexistenceState();
  const creds = resolveCredentials(state);
  const at = new Date().toISOString();
  // The owner replied from the WhatsApp Business app recently: keep the AI quiet (opt-out confirmations still go out).
  const session = options.system ? null : await db.collection("ai_sessions").findOne({ id: sessionId }, { projection: { humanTakeoverUntil: 1 } });
  if (typeof session?.humanTakeoverUntil === "string" && session.humanTakeoverUntil > at) {
    const reason = "The business is replying from the WhatsApp Business app, so the AI reply was held.";
    await db.collection("ai_wa_messages").insertOne({ direction: "out", to, sessionId, text: body, status: "withheld", reason, at });
    return { sent: false as const, drafted: true as const, reason };
  }
  const gate = sendGate({
    to,
    suppressed: await isSuppressed("whatsapp", to),
    template: false,
    windowOpen: true,
    consent: false,
    creds,
    businessNumber: state?.displayNumber,
  });
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
      return deliver(from, "You're unsubscribed and won't receive follow-up messages from Marina Muse. Reply START any time to opt back in.", sessionId, { system: true });
    }
    if (OPT_IN.test(plan.text)) {
      await db.collection("ai_suppression").deleteOne({ phone: from });
      await recordConsent({ channel: "whatsapp", address: from, granted: true, source: "whatsapp_start", sessionId });
      return deliver(from, "Thank you — you'll receive order and enquiry updates from Marina Muse on WhatsApp. Reply STOP any time to opt out.", sessionId, { system: true });
    }

    // Agent switched off (AI_AGENTS_DISABLED): the message is kept for the team, no AI reply is drafted.
    if (!agentEnabled("whatsapp")) return { sent: false as const, drafted: false as const };

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
      if (m.text) {
        await db.collection("ai_messages").insertOne({ sessionId, role: m.fromBusiness ? "business" : "customer", text: m.text, source: "history", at: m.timestamp });
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
    } else {
      await db.collection("ai_wa_messages").insertOne({
        direction: "out",
        source: "business_app",
        to: echo.customer,
        sessionId,
        wamid: echo.id,
        type: echo.type,
        text: echo.text,
        status: "sent",
        at: echo.timestamp,
      });
      if (echo.text) await db.collection("ai_messages").insertOne({ sessionId, role: "business", text: echo.text, source: "business_app", at: echo.timestamp });
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
