/**
 * Phase 2 E: reply-reservation recovery lifecycle (v1.1 §4). Pure: collections are injected, so the offline checks
 * run it on a simulated collection and the app passes MongoDB collections.
 *
 * Two independent clocks, never mixed:
 *  - Reply window: `inboundAt` = the customer's inbound Meta message timestamp (epoch seconds). Free-form resend is
 *    possible only while nowSeconds − inboundAt < 86 400. Missing/invalid inboundAt → never resendable.
 *  - Recovery expiry: `firstProblemAt` = first entry into stale/unknown/failed. Expired 24 h later; terminal.
 *
 * Nothing here sends automatically. A resend happens only through claimResend → (caller sends once) → completeResend,
 * started by an authorised admin with duplicate-risk acknowledgement. An abandoned claim (worker crash) stays in
 * `resend_claimed` until an admin reconciles it; it is never released or resent automatically.
 * Every state change is a conditional update naming the previous status (and, for workers, their token).
 */
import { randomBytes } from "crypto";

export const STALE_AFTER_MS = 10 * 60_000;
export const RECOVERY_EXPIRY_MS = 24 * 3_600_000;
export const REPLY_WINDOW_SECONDS = 86_400;

export const PROBLEM_STATES = ["stale", "unknown", "failed"] as const;
/** States from which a manual resend may be claimed (the resend_* ones only after a completed/reconciled attempt). */
export const CLAIMABLE_STATES = ["stale", "unknown", "failed", "resend_failed", "resend_unknown"] as const;
export const TERMINAL_STATES = ["sent", "sent_late", "withheld", "expired", "resolved", "resent"] as const;

export const DUPLICATE_RISK_WARNING =
  "The original message may already have been delivered to the customer. Resending may result in the customer receiving the same message twice.";

type Doc = Record<string, unknown>;
export type RecoveryCollection = {
  insertOne(doc: Doc): Promise<unknown>;
  findOne(filter: Doc): Promise<Doc | null>;
  findOneAndUpdate(filter: Doc, update: Doc, options?: Doc): Promise<Doc | null>;
  updateOne(filter: Doc, update: Doc, options?: Doc): Promise<{ matchedCount: number }>;
  find(filter: Doc, options?: Doc): { toArray(): Promise<Doc[]> };
};

const iso = (ms: number) => new Date(ms).toISOString();
export const newToken = () => randomBytes(12).toString("base64url");

function isDuplicateKey(err: unknown) {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 11000);
}

/** Reply-window clock (Clock 1). Only the original inbound Meta timestamp counts. */
export function replyWindowOpen(inboundAt: unknown, nowMs: number) {
  if (typeof inboundAt !== "number" || !Number.isFinite(inboundAt) || inboundAt <= 0) return false;
  return Math.floor(nowMs / 1000) - inboundAt < REPLY_WINDOW_SECONDS;
}

/** Recovery-expiry clock (Clock 2). */
export function recoveryExpired(firstProblemAt: unknown, nowMs: number) {
  if (typeof firstProblemAt !== "string") return false;
  const t = Date.parse(firstProblemAt);
  return Number.isFinite(t) && nowMs - t >= RECOVERY_EXPIRY_MS;
}

/** Append-only delivery evidence. One row per (inReplyTo, token); a repeat insert is ignored, never overwritten. */
export async function recordDeliveryEvent(
  events: Pick<RecoveryCollection, "insertOne">,
  row: { inReplyTo: string; token: string; kind: "original" | "resend"; result: string; wamid?: string; error?: string; workerId?: string; at: string }
) {
  try {
    await events.insertOne({ ...row, error: row.error?.slice(0, 200) });
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

/**
 * Original worker completion (v1.1 §4.3, §4.5). Evidence first, then the guarded transition from pending.
 * If the sweep already moved the record to stale (or it is unknown), a confirmed send becomes `sent_late`.
 * A record in any other state (expired, resolved, resent, …) is never changed: only the evidence row remains.
 */
export async function finishOriginal(
  col: RecoveryCollection,
  events: Pick<RecoveryCollection, "insertOne">,
  input: { inReplyTo: string; sendToken: string; result: "sent" | "failed" | "unknown"; wamid?: string; error?: string; workerId?: string; now?: number }
) {
  const now = input.now ?? Date.now();
  await recordDeliveryEvent(events, {
    inReplyTo: input.inReplyTo,
    token: input.sendToken,
    kind: "original",
    result: input.result,
    wamid: input.wamid,
    error: input.error,
    workerId: input.workerId,
    at: iso(now),
  });
  const fields: Doc =
    input.result === "sent"
      ? { status: "sent", wamid: input.wamid || "" }
      : { status: input.result, firstProblemAt: iso(now), reason: (input.error || "").slice(0, 300) };
  const res = await col.updateOne({ inReplyTo: input.inReplyTo, status: "pending", sendToken: input.sendToken }, { $set: fields });
  if (res.matchedCount === 1) return { outcome: input.result };
  if (input.result === "sent") {
    const late = await col.updateOne(
      { inReplyTo: input.inReplyTo, status: { $in: ["stale", "unknown"] }, sendToken: input.sendToken },
      { $set: { status: "sent_late", wamid: input.wamid || "", lateAt: iso(now) } }
    );
    if (late.matchedCount === 1) return { outcome: "sent_late" as const };
  }
  return { outcome: "evidence_only" as const };
}

/** Withheld by a gate before any send: guarded like every other transition. */
export async function withholdOriginal(col: RecoveryCollection, inReplyTo: string, sendToken: string, reason: string) {
  const res = await col.updateOne({ inReplyTo, status: "pending", sendToken }, { $set: { status: "withheld", reason: reason.slice(0, 300) } });
  return res.matchedCount === 1;
}

/** Sweep (15-minute job). Writes status labels only; never sends, never touches resend_claimed. */
export async function sweepReservations(col: RecoveryCollection, now = Date.now()) {
  let staled = 0;
  let expired = 0;
  const pending = await col.find({ status: "pending", at: { $lt: iso(now - STALE_AFTER_MS) } }, { limit: 500 }).toArray();
  for (const d of pending) {
    const r = await col.updateOne({ inReplyTo: d.inReplyTo, status: "pending" }, { $set: { status: "stale", staleAt: iso(now), firstProblemAt: iso(now) } });
    staled += r.matchedCount;
  }
  const old = await col.find({ status: { $in: [...CLAIMABLE_STATES] }, firstProblemAt: { $lt: iso(now - RECOVERY_EXPIRY_MS) } }, { limit: 500 }).toArray();
  for (const d of old) {
    const r = await col.updateOne({ inReplyTo: d.inReplyTo, status: d.status }, { $set: { status: "expired", expiredAt: iso(now) } });
    expired += r.matchedCount;
  }
  return { staled, expired };
}

export function maskRecipient(to: unknown) {
  const d = String(to ?? "").replace(/\D/g, "");
  return d ? `…${d.slice(-4)}` : "";
}

/** Admin list: masked recipient, short reservation id, no message text. */
export async function listRecoverable(col: RecoveryCollection, now = Date.now()) {
  const docs = await col
    .find({ status: { $in: [...CLAIMABLE_STATES, "resend_claimed"] } }, { limit: 100, sort: { at: -1 } })
    .toArray();
  const rows = docs.map((d) => {
    const claim = (d.resendClaim as Doc | null | undefined) || null;
    return {
      id: String(d.inReplyTo || ""),
      ref: String(d.inReplyTo || "").slice(-6),
      to: maskRecipient(d.to),
      status: String(d.status),
      at: String(d.at || ""),
      firstProblemAt: typeof d.firstProblemAt === "string" ? d.firstProblemAt : null,
      reason: typeof d.reason === "string" ? d.reason.slice(0, 160) : null,
      attempt: Number(d.resendAttempt || 0),
      claim: claim ? { at: String(claim.at || ""), workerId: String(claim.workerId || ""), actor: String(claim.actor || "") } : null,
      replyWindowOpen: replyWindowOpen(d.inboundAt, now),
      resendEligible: d.status !== "resend_claimed" && replyWindowOpen(d.inboundAt, now) && !recoveryExpired(d.firstProblemAt, now),
    };
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return { counts, rows };
}

export async function markResolved(col: RecoveryCollection, input: { inReplyTo: string; actor: string; note?: string; now?: number }) {
  const r = await col.updateOne(
    { inReplyTo: input.inReplyTo, status: { $in: [...CLAIMABLE_STATES] } },
    { $set: { status: "resolved", resolvedBy: input.actor, resolvedAt: iso(input.now ?? Date.now()), resolveNote: (input.note || "").slice(0, 300) } }
  );
  return r.matchedCount === 1;
}

/**
 * Atomic resend claim (v1.1 §4.6–4.7). One filter decides everything: claimable state, no open claim, reply window
 * open (Clock 1), recovery not expired (Clock 2). Concurrent admins and double clicks get null.
 */
export async function claimResend(col: RecoveryCollection, input: { inReplyTo: string; actor: string; workerId: string; token?: string; now?: number }) {
  const now = input.now ?? Date.now();
  const token = input.token ?? newToken();
  const claimed = await col.findOneAndUpdate(
    {
      inReplyTo: input.inReplyTo,
      status: { $in: [...CLAIMABLE_STATES] },
      resendClaim: null,
      inboundAt: { $type: "number", $gte: Math.floor(now / 1000) - REPLY_WINDOW_SECONDS + 1 },
      firstProblemAt: { $gt: iso(now - RECOVERY_EXPIRY_MS) },
    },
    { $set: { status: "resend_claimed", resendClaim: { token, actor: input.actor, workerId: input.workerId, at: iso(now) } }, $inc: { resendAttempt: 1 } },
    { returnDocument: "after" }
  );
  if (claimed) return { ok: true as const, token, doc: claimed };
  const current = await col.findOne({ inReplyTo: input.inReplyTo });
  const reason = !current
    ? "not_found"
    : current.status === "resend_claimed"
      ? "claim_open"
      : !CLAIMABLE_STATES.includes(String(current.status) as (typeof CLAIMABLE_STATES)[number])
        ? "not_claimable"
        : !replyWindowOpen(current.inboundAt, now)
          ? "reply_window_closed"
          : recoveryExpired(current.firstProblemAt, now)
            ? "expired"
            : "conflict";
  return { ok: false as const, reason };
}

const RESEND_OUTCOME = { sent: "resent", failed: "resend_failed", unknown: "resend_unknown" } as const;

/** Token-guarded completion by the claiming worker. Evidence first; a stale token changes nothing. */
export async function completeResend(
  col: RecoveryCollection,
  events: Pick<RecoveryCollection, "insertOne">,
  input: { inReplyTo: string; token: string; result: "sent" | "failed" | "unknown"; wamid?: string; error?: string; workerId?: string; to?: string; now?: number }
) {
  const now = input.now ?? Date.now();
  await recordDeliveryEvent(events, { inReplyTo: input.inReplyTo, token: input.token, kind: "resend", result: input.result, wamid: input.wamid, error: input.error, workerId: input.workerId, at: iso(now) });
  const status = RESEND_OUTCOME[input.result];
  const r = await col.updateOne(
    { inReplyTo: input.inReplyTo, status: "resend_claimed", "resendClaim.token": input.token },
    {
      $set: {
        status,
        resendClaim: null,
        lastResendAt: iso(now),
        ...(input.result === "sent" ? { resentAs: input.wamid || "" } : { lastResendError: (input.error || "").slice(0, 300) }),
      },
    }
  );
  if (r.matchedCount === 1 && input.result === "sent" && input.wamid) {
    // Own outbound record so delivery-status webhooks (matched by wamid) attach to the resend, not the original.
    await col.insertOne({ direction: "out", to: input.to, wamid: input.wamid, resendOf: input.inReplyTo, status: "sent", at: iso(now) });
  }
  return { updated: r.matchedCount === 1, status };
}

/**
 * Administrative reconciliation of a resend claim (abandoned or otherwise). The admin states the outcome after
 * inspecting the evidence rows; the claim token must match, so a stale view cannot reconcile a newer claim.
 */
export async function reconcileResend(
  col: RecoveryCollection,
  input: { inReplyTo: string; token: string; outcome: "resent" | "resend_failed" | "resend_unknown"; actor: string; reason: string; now?: number }
) {
  const r = await col.updateOne(
    { inReplyTo: input.inReplyTo, status: "resend_claimed", "resendClaim.token": input.token },
    { $set: { status: input.outcome, resendClaim: null, reconciledBy: input.actor, reconciledAt: iso(input.now ?? Date.now()), reconcileReason: input.reason.slice(0, 300) } }
  );
  return r.matchedCount === 1;
}
