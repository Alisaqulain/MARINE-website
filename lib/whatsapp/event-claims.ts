/**
 * C5: persistent, database-backed idempotency for WhatsApp webhook events and their side effects.
 *
 * Event identity: the key from `normaliseWebhook` (inbound message: `msg:<wamid>`; Coexistence fields have their own keys).
 * Persistence: collection `wa_webhook_events`, unique index on `key` (pre-existing). Each document carries
 *   status "processing" | "done" | "failed", claimToken, claimedAt, attempts, doneAt/failedAt.
 *   Documents written before C5 have no status; they were fully handled by the old code and count as "done".
 * Concurrency: the unique index makes `insertOne` the atomic first claim. Re-claiming a failed event, or a
 *   "processing" claim older than CLAIM_LEASE_MS (crash / restart), is a single atomic `findOneAndUpdate`
 *   conditioned on that state, so only one caller can win it. Completion is fenced by claimToken.
 * Side effects: the inbound record is written at most once per wamid, and the AI reply at most once per inbound
 *   wamid (reservation before sending). Both rely on partial unique indexes on `ai_wa_messages` (see INDEXES)
 *   plus upserts; a duplicate-key error (11000) means "already recorded".
 *
 * Pure: the collection is passed in. The app passes MongoDB collections (lib/whatsapp/store.ts); the offline checks
 * pass a simulated collection. No transactions are used (the local test database is a standalone server).
 */

/** A claim older than this is treated as abandoned (process crashed or restarted mid-way) and may be re-claimed. */
export const CLAIM_LEASE_MS = 120_000;

/** Minimal collection surface used here (MongoDB driver v7 `Collection` satisfies it). */
export type ClaimCollection = {
  insertOne(doc: Record<string, unknown>): Promise<unknown>;
  findOne(filter: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>, options?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ matchedCount: number; upsertedCount?: number | null }>;
};

/** Index definitions (names fixed so their presence can be checked). */
export const INDEXES = {
  events: { collection: "wa_webhook_events", spec: { key: 1 }, options: { unique: true } },
  inboundOnce: {
    collection: "ai_wa_messages",
    spec: { wamid: 1, direction: 1 },
    options: { name: "wa_inbound_wamid_once", unique: true, partialFilterExpression: { direction: { $eq: "in" }, wamid: { $type: "string" } } },
  },
  replyOnce: {
    collection: "ai_wa_messages",
    spec: { inReplyTo: 1 },
    options: { name: "wa_reply_once", unique: true, partialFilterExpression: { inReplyTo: { $type: "string" } } },
  },
  /** Phase 2 E: non-unique scan index for the recovery sweep and admin list. */
  recoveryScan: { collection: "ai_wa_messages", spec: { status: 1, at: 1 }, options: { name: "wa_status_at" } },
  /** Phase 2 E: append-only delivery evidence, one row per (reservation, send token). */
  deliveryEvents: { collection: "ai_wa_delivery_events", spec: { inReplyTo: 1, token: 1 }, options: { name: "wa_delivery_event_once", unique: true } },
} as const;

export function isDuplicateKeyError(err: unknown) {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 11000);
}

export type Claim =
  | { state: "claimed"; token: string; retry: boolean }
  | { state: "duplicate" }
  | { state: "in_progress" };

function newToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Claims an event for processing. Throws on any database error other than a duplicate key, so the webhook answers
 * 500 and Meta redelivers. Never returns "claimed" to two callers for the same key at the same time (except after
 * the lease of an abandoned claim expires; see the report's limitations).
 */
export async function claimEvent(
  col: ClaimCollection,
  key: string,
  meta: { field: string; action: string; reason: string },
  now = Date.now(),
  token = newToken()
): Promise<Claim> {
  const at = new Date(now).toISOString();
  try {
    await col.insertOne({ key, field: meta.field, action: meta.action, reason: meta.reason.slice(0, 200), status: "processing", claimToken: token, claimedAt: at, attempts: 1, at });
    return { state: "claimed", token, retry: false };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
  const staleBefore = new Date(now - CLAIM_LEASE_MS).toISOString();
  const reclaimed = await col.findOneAndUpdate(
    { key, $or: [{ status: "failed" }, { status: "processing", claimedAt: { $lt: staleBefore } }] },
    { $set: { status: "processing", claimToken: token, claimedAt: at }, $inc: { attempts: 1 } },
    { returnDocument: "after" }
  );
  if (reclaimed) return { state: "claimed", token, retry: true };
  const doc = await col.findOne({ key });
  if (!doc) throw new Error("event claim not found");
  if (doc.status === "processing") return { state: "in_progress" };
  return { state: "duplicate" }; // "done", or a pre-C5 document without a status (fully handled by the old code)
}

/** Marks the event done, only if this caller still holds the claim. Throws on database errors. */
export async function completeEvent(col: ClaimCollection, key: string, token: string, now = Date.now()) {
  const res = await col.updateOne({ key, claimToken: token, status: "processing" }, { $set: { status: "done", doneAt: new Date(now).toISOString() } });
  return { completed: res.matchedCount === 1 };
}

/** Marks the event failed so a redelivery re-claims it at once. Best-effort: if this write fails, the lease expiry still frees it. */
export async function failEvent(col: ClaimCollection, key: string, token: string, label: string, now = Date.now()) {
  try {
    await col.updateOne({ key, claimToken: token }, { $set: { status: "failed", failedAt: new Date(now).toISOString(), lastError: label.slice(0, 120) } });
    return true;
  } catch {
    return false;
  }
}

/** Inbound message record, at most once per wamid. Returns "inserted" or "existing". Throws on other database errors. */
export async function recordInboundOnce(col: ClaimCollection, doc: Record<string, unknown> & { wamid: string }) {
  try {
    const res = await col.updateOne({ wamid: doc.wamid, direction: "in" }, { $setOnInsert: { ...doc, direction: "in" } }, { upsert: true });
    return res.upsertedCount ? ("inserted" as const) : ("existing" as const);
  } catch (err) {
    if (isDuplicateKeyError(err)) return "existing" as const;
    throw err;
  }
}

/**
 * Reserves the single reply to an inbound wamid BEFORE anything is sent. Only the caller that creates the
 * reservation may send; a retry finds it and sends nothing (at-most-once sending).
 */
export async function reserveReply(col: ClaimCollection, inReplyTo: string, doc: Record<string, unknown>) {
  try {
    const res = await col.updateOne({ inReplyTo }, { $setOnInsert: { ...doc, inReplyTo, status: "pending" } }, { upsert: true });
    return { reserved: Boolean(res.upsertedCount) };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { reserved: false };
    throw err;
  }
}
