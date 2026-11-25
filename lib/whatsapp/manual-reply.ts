import { getDb } from "@/lib/mongodb";
import { isSuppressed } from "@/lib/ai/followups";
import { postMessage, resolveCredentials, sendGate, textPayload } from "@/lib/whatsapp/cloud";
import { isDirectMode } from "@/lib/whatsapp/mode";
import { messagesCollection, readCoexistenceState } from "@/lib/whatsapp/store";

/** Meta's customer service window: free-form replies only within 24 h of the customer's LAST incoming message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MANUAL_REPLY_MAX = 4096;

export type ManualReplyOutcome =
  | { result: "sent"; wamid: string }
  | { result: "failed"; reason: string }
  | { result: "refused"; reason: string };

function maskNumber(digits: string) {
  return digits.length > 4 ? `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : "••••";
}

/**
 * Manual admin reply (the only WhatsApp send path that does not need the WhatsApp AI agent).
 * Everything is decided on the server: the recipient comes from the stored incoming message, the 24-hour window from
 * the sender's latest stored incoming message, and the usual send gates (outbound flags, test-mode recipients,
 * opt-out, business number) still apply. Every attempt — sent, failed or refused — is written to ai_audit.
 */
export async function sendManualReply(input: { inboundWamid: string; text: string; actor: string }): Promise<ManualReplyOutcome> {
  const db = await getDb();
  const at = new Date().toISOString();
  const text = String(input.text ?? "").trim();
  let to = "";

  const finish = async (outcome: ManualReplyOutcome) => {
    await db.collection("ai_audit").insertOne({
      at,
      action: "admin_wa_manual_reply",
      actor: input.actor,
      to: to ? maskNumber(to) : "",
      inbound: input.inboundWamid.slice(-6),
      chars: text.length,
      result: outcome.result,
      reason: outcome.result === "sent" ? undefined : outcome.reason.slice(0, 300),
      wamid: outcome.result === "sent" ? outcome.wamid : undefined,
    });
    return outcome;
  };

  if (!text) return finish({ result: "refused", reason: "The reply is empty." });
  if (text.length > MANUAL_REPLY_MAX) return finish({ result: "refused", reason: `The reply is longer than ${MANUAL_REPLY_MAX} characters.` });

  const messages = await messagesCollection();
  const inbound = await messages.findOne({ wamid: input.inboundWamid, direction: "in" });
  if (!inbound) return finish({ result: "refused", reason: "Incoming message not found." });
  to = String(inbound.from ?? "").replace(/\D/g, "");
  if (!to) return finish({ result: "refused", reason: "The incoming message has no sender number." });

  // Window from the database: the sender's most recent incoming message, never from the browser.
  const latest = await db
    .collection("ai_wa_messages")
    .find({ from: to, direction: "in" })
    .sort({ at: -1 })
    .limit(1)
    .toArray();
  const lastAt = Date.parse(String(latest[0]?.at ?? inbound.at ?? ""));
  const windowOpen = Number.isFinite(lastAt) && Date.now() - lastAt < SERVICE_WINDOW_MS;

  const creds = resolveCredentials(isDirectMode() ? null : await readCoexistenceState());
  const gate = sendGate({ to, suppressed: await isSuppressed("whatsapp", to), template: false, windowOpen, consent: false, creds });
  if (!gate.allowed) return finish({ result: "refused", reason: gate.reason });

  const res = await postMessage(creds, textPayload(to, text));
  await db.collection("ai_wa_messages").insertOne({
    direction: "out",
    manual: true,
    to,
    text,
    actor: input.actor,
    replyToWamid: input.inboundWamid,
    status: res.ok ? "manual_sent" : "manual_failed",
    wamid: res.ok ? res.wamid : undefined,
    reason: res.ok ? undefined : res.error,
    at,
  });
  return finish(res.ok ? { result: "sent", wamid: res.wamid } : { result: "failed", reason: res.error });
}
