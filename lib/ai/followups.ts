import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/mongodb";
import { getSiteOrigin } from "@/lib/auth-url";
import { sendCustomerMail } from "@/lib/mail";
import { readCoexistenceState } from "@/lib/whatsapp/store";
import { postMessage, resolveCredentials, sendGate, templatePayload } from "@/lib/whatsapp/cloud";

/**
 * Permission-based follow-ups shared by all agents: consent, opt-outs, and a queue processed by the jobs cron.
 * Email and WhatsApp follow-ups need recorded opt-in. Calls always wait for an owner (outbound_call is restricted).
 */

export type ConsentChannel = "email" | "whatsapp" | "call";
export type FollowUpReason = "missed_call" | "enquiry_recovery" | "checkout_recovery";

export type FollowUp = {
  id: string;
  channel: ConsentChannel;
  to: string;
  reason: FollowUpReason;
  status: "pending" | "needs_approval" | "sent" | "skipped" | "failed";
  leadId?: string;
  sessionId?: string;
  orderId?: string;
  note?: string;
  dueAt: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export function normalAddress(channel: ConsentChannel, address: string) {
  return channel === "email" ? address.trim().toLowerCase() : address.replace(/\D/g, "");
}

export async function recordConsent(input: { channel: ConsentChannel; address: string; granted: boolean; source: string; sessionId?: string }) {
  const address = normalAddress(input.channel, input.address);
  if (!address) return;
  const db = await getDb();
  const at = new Date().toISOString();
  await db.collection("ai_consent").updateOne(
    { channel: input.channel, address },
    { $set: { channel: input.channel, address, granted: input.granted, source: input.source.slice(0, 60), sessionId: input.sessionId, at } },
    { upsert: true }
  );
  if (!input.granted) await suppress(input.channel, address, input.source);
  await db.collection("ai_audit").insertOne({ at, action: input.granted ? "consent_granted" : "consent_withdrawn", channel: input.channel, source: input.source });
}

export async function suppress(channel: ConsentChannel | "all", address: string, source: string) {
  const db = await getDb();
  const key = channel === "email" ? normalAddress("email", address) : address.replace(/\D/g, "");
  await db.collection("ai_suppression").updateOne(
    channel === "email" ? { email: key } : { phone: key },
    { $set: { ...(channel === "email" ? { email: key } : { phone: key }), channel, source, at: new Date().toISOString() } },
    { upsert: true }
  );
  await db.collection("ai_followups").updateMany({ to: key, status: { $in: ["pending", "needs_approval"] } }, { $set: { status: "skipped", lastError: "Opted out", updatedAt: new Date().toISOString() } });
}

export async function isSuppressed(channel: ConsentChannel, address: string) {
  const db = await getDb();
  const key = normalAddress(channel, address);
  return Boolean(await db.collection("ai_suppression").findOne(channel === "email" ? { email: key } : { phone: key }));
}

export async function hasConsent(channel: ConsentChannel, address: string) {
  const db = await getDb();
  const key = normalAddress(channel, address);
  const row = await db.collection("ai_consent").findOne({ channel, address: key });
  return Boolean(row?.granted) && !(await isSuppressed(channel, key));
}

/** Signed one-click unsubscribe token for follow-up emails. */
export function unsubscribeToken(channel: ConsentChannel, address: string) {
  const secret = process.env.AUTH_SECRET?.trim() || "";
  const payload = Buffer.from(`${channel}:${normalAddress(channel, address)}`).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 32);
  return `${payload}.${sig}`;
}

export function readUnsubscribeToken(token: string): { channel: ConsentChannel; address: string } | null {
  const secret = process.env.AUTH_SECRET?.trim() || "";
  const [payload, sig] = token.split(".");
  if (!secret || !payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [channel, ...rest] = Buffer.from(payload, "base64url").toString("utf8").split(":");
  if (channel !== "email" && channel !== "whatsapp" && channel !== "call") return null;
  return { channel, address: rest.join(":") };
}

function newId() {
  return `fu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** One open follow-up per lead/order and reason. */
export async function queueFollowUp(input: Omit<FollowUp, "id" | "status" | "attempts" | "createdAt" | "updatedAt"> & { status?: FollowUp["status"] }) {
  const db = await getDb();
  const to = normalAddress(input.channel, input.to);
  if (!to) return null;
  const match = { reason: input.reason, ...(input.orderId ? { orderId: input.orderId } : input.leadId ? { leadId: input.leadId } : { to }) };
  const existing = await db.collection<FollowUp>("ai_followups").findOne(match);
  if (existing) return existing;
  const now = new Date().toISOString();
  const row: FollowUp = {
    ...input,
    to,
    id: newId(),
    status: input.status ?? (input.channel === "call" ? "needs_approval" : "pending"),
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<FollowUp>("ai_followups").insertOne({ ...row });
  return row;
}

async function send(row: FollowUp): Promise<{ status: FollowUp["status"]; error?: string }> {
  const db = await getDb();
  if (await isSuppressed(row.channel, row.to)) return { status: "skipped", error: "Opted out" };
  if (row.channel === "call") return { status: "needs_approval" };
  if (!(await hasConsent(row.channel, row.to))) return { status: "skipped", error: "No recorded consent" };
  const origin = getSiteOrigin();

  if (row.channel === "email") {
    const unsubscribe = `${origin}/api/ai/consent?u=${unsubscribeToken("email", row.to)}`;
    let lines: string[] = [];
    if (row.reason === "checkout_recovery" && row.orderId) {
      const order = await db.collection("orders").findOne({ id: row.orderId });
      if (!order || order.status === "paid") return { status: "skipped", error: "Order already paid or missing" };
      const items = Array.isArray(order.items) ? (order.items as { name?: string; qty?: number }[]) : [];
      lines = [
        `Hello ${String(order.name || "").split(" ")[0] || "there"},`,
        "",
        "You started a checkout at Marina Muse International but it was not completed. Your items:",
        ...items.map((item) => `  • ${item.name} × ${item.qty}`),
        "",
        `You can return to your bag at ${origin}/cart. If you had a problem paying, just reply to this email and our team will help.`,
      ];
    } else {
      lines = [
        "Hello,",
        "",
        "Thank you for your enquiry with Marina Muse International. Our team is ready to help with your requirements — just reply to this email with any details (quantity, timeline, destination) and we will get back to you.",
        "",
        `Browse the collection: ${origin}/shop`,
      ];
    }
    lines.push("", "—", "Marina Muse International", `Stop these emails: ${unsubscribe}`);
    try {
      await sendCustomerMail(row.to, row.reason === "checkout_recovery" ? "Your Marina Muse checkout" : "Your Marina Muse enquiry", lines.join("\n"));
      return { status: "sent" };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message.slice(0, 200) : "Email failed" };
    }
  }

  const template = process.env.WHATSAPP_FOLLOWUP_TEMPLATE?.trim();
  if (!template) return { status: "skipped", error: "WHATSAPP_FOLLOWUP_TEMPLATE is not set" };
  const creds = resolveCredentials(await readCoexistenceState());
  const gate = sendGate({ to: row.to, suppressed: false, template: true, windowOpen: false, consent: true, creds });
  if (!gate.allowed) return { status: "skipped", error: gate.reason };
  const res = await postMessage(creds, templatePayload(row.to, template, process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en", []));
  if (!res.ok) return { status: "failed", error: res.error };
  await db.collection("ai_wa_messages").insertOne({ wamid: res.wamid, to: row.to, kind: "template", template, status: "sent", followUpId: row.id, at: new Date().toISOString() });
  return { status: "sent" };
}

/** Finds abandoned checkouts and cooling enquiries with consent, then sends what is due. Called by the jobs cron. */
export async function runFollowUps(now = new Date()) {
  const db = await getDb();
  const iso = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  let queued = 0;

  const abandoned = await db
    .collection("orders")
    .find({ status: "pending", createdAt: { $gte: iso(72), $lte: iso(2) }, email: { $exists: true, $ne: "" } })
    .limit(100)
    .toArray();
  for (const order of abandoned) {
    const email = String(order.email);
    const paidLater = await db.collection("orders").findOne({ email, status: "paid", createdAt: { $gte: String(order.createdAt) } });
    if (paidLater || !(await hasConsent("email", email))) continue;
    if (await queueFollowUp({ channel: "email", to: email, reason: "checkout_recovery", orderId: String(order.id), sessionId: order.sessionId, dueAt: now.toISOString() })) queued += 1;
  }

  const cooling = await db
    .collection("ai_leads")
    .find({ stage: { $in: ["warm", "hot", "high-value"] }, updatedAt: { $gte: iso(24 * 7), $lte: iso(24) } })
    .limit(100)
    .toArray();
  for (const lead of cooling) {
    const ordered = lead.sessionId ? await db.collection("orders").findOne({ sessionId: lead.sessionId, status: "paid" }) : null;
    if (ordered) continue;
    const phone = String(lead.phone || "");
    const email = String(lead.email || "");
    const channel: ConsentChannel | null =
      phone && process.env.WHATSAPP_FOLLOWUP_TEMPLATE?.trim() && (await hasConsent("whatsapp", phone)) ? "whatsapp" : email && (await hasConsent("email", email)) ? "email" : null;
    if (!channel) continue;
    if (await queueFollowUp({ channel, to: channel === "email" ? email : phone, reason: "enquiry_recovery", leadId: String(lead.id), sessionId: String(lead.sessionId || ""), dueAt: now.toISOString() })) queued += 1;
  }

  const due = await db
    .collection<FollowUp>("ai_followups")
    .find({ status: "pending", dueAt: { $lte: now.toISOString() }, attempts: { $lt: 3 } })
    .limit(25)
    .toArray();
  const counts = { sent: 0, skipped: 0, failed: 0 };
  for (const row of due) {
    const result = await send(row);
    if (result.status === "sent") counts.sent += 1;
    else if (result.status === "skipped") counts.skipped += 1;
    else if (result.status === "failed") counts.failed += 1;
    const retry = result.status === "failed" && row.attempts + 1 < 3;
    await db.collection("ai_followups").updateOne(
      { id: row.id },
      {
        $set: {
          status: retry ? "pending" : result.status,
          updatedAt: new Date().toISOString(),
          ...(retry ? { dueAt: new Date(now.getTime() + 3_600_000).toISOString() } : {}),
          ...(result.error ? { lastError: result.error } : {}),
        },
        $inc: { attempts: 1 },
      }
    );
  }
  return { queued, processed: due.length, ...counts };
}

export async function recordJobRun(name: string, ok: boolean, summary: Record<string, unknown>) {
  const db = await getDb();
  await db.collection("ai_jobs").insertOne({ name, ok, summary, at: new Date().toISOString() });
}
