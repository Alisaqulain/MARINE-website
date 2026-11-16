import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";

/**
 * Phase 2 (v1.1 §4.4): per-job lease so two scheduler invocations never run the same job at once.
 * A crashed run's lease expires after LEASE_MS; the job itself never sends WhatsApp automatically, so an expired
 * lease can at worst re-run the email follow-ups that were not yet marked (they are marked per row as they go).
 */
export const LEASE_MS = 10 * 60_000;

export async function acquireJobLease(name: string, now = Date.now()) {
  const db = await getDb();
  const leases = db.collection("ai_job_leases");
  await leases.createIndex({ name: 1 }, { unique: true, name: "job_lease_name" }).catch(() => undefined);
  try {
    await leases.updateOne({ name }, { $setOnInsert: { name, running: false } }, { upsert: true });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 11000)) throw err;
  }
  const token = randomBytes(12).toString("base64url");
  const got = await leases.findOneAndUpdate(
    { name, $or: [{ running: false }, { leaseUntil: { $lt: new Date(now).toISOString() } }] },
    { $set: { running: true, token, leaseUntil: new Date(now + LEASE_MS).toISOString(), startedAt: new Date(now).toISOString() } },
    { returnDocument: "after" }
  );
  return got ? { ok: true as const, token } : { ok: false as const };
}

export async function releaseJobLease(name: string, token: string) {
  const db = await getDb();
  await db.collection("ai_job_leases").updateOne({ name, token }, { $set: { running: false, finishedAt: new Date().toISOString() } });
}
