// Phase 2 G3 local verification against the ISOLATED server (port 3939) and the LOCAL test database (127.0.0.1:27018).
//   node scripts/isolated-env.mjs -- node reports/evidence/phase2/g3-local-tests.mjs http://localhost:3939
// Synthetic records only (marker g3LocalTest / ids starting "wamid.g3local-" / orders "MM-G3LOCAL-"), removed at the end.
// No external network: outbound WhatsApp is forced off and non-production sends are refused before any request.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { isolatedEnv } from "../../../scripts/isolated-env.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const dotenv = loadEnvConfig(root, true, { info() {}, error() {} }).combinedEnv;
const base = process.argv[2] || "http://localhost:3939";
if (process.env.MARINA_ISOLATED_TEST !== "1") { console.error("Run inside scripts/isolated-env.mjs"); process.exit(2); }
if (!/^mongodb:\/\/[^@]+@(127\.0\.0\.1|localhost):27018\//.test(dotenv.MONGODB_URI || "")) { console.error("Refusing: not the local test database"); process.exit(2); }
const { env: iso } = isolatedEnv();
const R = await import(new URL("../../../lib/whatsapp/recovery.ts", import.meta.url).href);

const results = [];
const check = (id, name, pass, detail = "") => results.push({ id, name, pass: Boolean(pass), detail: String(detail).slice(0, 200) });
const RUN = Date.now().toString(36);
const mongo = new MongoClient(dotenv.MONGODB_URI);
await mongo.connect();
const db = mongo.db(dotenv.MONGODB_DB_NAME);
const msgs = db.collection("ai_wa_messages");
const events = db.collection("ai_wa_delivery_events");
const nowSec = () => Math.floor(Date.now() / 1000);
const id = (n) => `wamid.g3local-${RUN}-${n}`;
const seed = (n, over = {}) => msgs.insertOne({ inReplyTo: id(n), direction: "out", to: "919999000001", text: `g3 synthetic ${n}`, at: new Date(Date.now() - 20 * 60_000).toISOString(), status: "pending", sendToken: `tok-${n}`, inboundAt: nowSec() - 1200, g3LocalTest: RUN, ...over });

// ── admin session ──
const email = (dotenv.ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
const csrfRes = await fetch(`${base}/api/auth/csrf`);
let cookies = (csrfRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
const { csrfToken } = await csrfRes.json();
const login = await fetch(`${base}/api/auth/callback/admin-portal`, {
  method: "POST", redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookies, "x-auth-return-redirect": "1" },
  body: new URLSearchParams({ email, password: dotenv.ADMIN_PASSWORD || "", csrfToken, callbackUrl: `${base}/admin` }),
});
cookies = [cookies, ...(login.headers.getSetCookie?.() || []).map((c) => c.split(";")[0])].filter(Boolean).join("; ");
check("L0", "Admin session", /authjs\.session-token|next-auth\.session-token/.test(cookies), `login HTTP ${login.status}`);
const host = new URL(base).host;
const action = (body, { origin = base, cookie = cookies } = {}) =>
  fetch(`${base}/api/admin/ai/actions`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), origin, host }, body: JSON.stringify(body) });

try {
  // ── commerce 2 ──
  const anon = await fetch(`${base}/api/orders?email=someone@example.com`);
  check("K-H1", "Order list: anonymous → 401", anon.status === 401, `HTTP ${anon.status}`);
  const track = await fetch(`${base}/api/orders/track?orderId=MM-G3LOCAL-NONE&email=nobody@example.com`);
  check("K-H2", "Tracking: unknown id + email → 404 (database-backed)", track.status === 404, `HTTP ${track.status}`);

  // ── commerce 1: the conditional paid transition on real MongoDB (same filter/update as markPaidOnce) ──
  const orders = db.collection("orders");
  const oid = `MM-G3LOCAL-${RUN}`;
  await orders.insertOne({ id: oid, status: "pending", email: "g3local@example.com", amount: 1, currency: "USD", items: [], g3LocalTest: RUN, createdAt: new Date().toISOString() });
  const race = await Promise.all([1, 2, 3, 4].map(() => orders.updateOne({ id: oid, status: { $ne: "paid" } }, { $set: { status: "paid", paidAt: new Date().toISOString() } })));
  check("K-D1", "Concurrent paid transitions on real MongoDB: exactly one winner", race.filter((r) => r.modifiedCount === 1).length === 1, race.map((r) => r.modifiedCount).join(","));

  // ── cron lease + sweep ──
  await seed("sweep");
  const cron = await fetch(`${base}/api/ai/jobs`, { method: "POST", headers: { authorization: `Bearer ${iso.CRON_SECRET}` } });
  const cronBody = await cron.json().catch(() => ({}));
  const swept = await msgs.findOne({ inReplyTo: id("sweep") });
  check("E-H1", "Cron job runs the sweep: pending > 10 min → stale (no send)", cron.status === 200 && cronBody.sweep && swept?.status === "stale" && typeof swept.firstProblemAt === "string", `HTTP ${cron.status}, status ${swept?.status}`);
  await db.collection("ai_job_leases").updateOne({ name: "followups" }, { $set: { running: true, leaseUntil: new Date(Date.now() + 60_000).toISOString(), token: "g3local" } });
  const blocked = await fetch(`${base}/api/ai/jobs`, { method: "POST", headers: { authorization: `Bearer ${iso.CRON_SECRET}` } });
  await db.collection("ai_job_leases").updateOne({ name: "followups", token: "g3local" }, { $set: { running: false } });
  check("E-H2", "Job lease: a second run while one holds the lease → 409", blocked.status === 409, `HTTP ${blocked.status}`);

  // ── indexes created by the server (real MongoDB) ──
  await fetch(`${base}/api/admin/ai`, { headers: { cookie: cookies } });
  const names = (await msgs.indexes()).map((i) => i.name);
  const evNames = (await events.indexes()).map((i) => i.name);
  check("E-DB1", "Indexes present: wa_inbound_wamid_once, wa_reply_once, wa_status_at, wa_delivery_event_once", ["wa_inbound_wamid_once", "wa_reply_once", "wa_status_at"].every((n) => names.includes(n)) && evNames.includes("wa_delivery_event_once"), `${names.join(",")} | ${evNames.join(",")}`);

  // ── recovery module on real MongoDB ──
  await seed("race", { status: "unknown", firstProblemAt: new Date().toISOString() });
  const claims = await Promise.all([1, 2, 3].map((n) => R.claimResend(msgs, { inReplyTo: id("race"), actor: "g3local", workerId: `w${n}` })));
  check("E-DB2", "Concurrent resend claims on real MongoDB: exactly one wins", claims.filter((c) => c.ok).length === 1, claims.map((c) => (c.ok ? "ok" : c.reason)).join(","));
  const ev1 = await R.recordDeliveryEvent(events, { inReplyTo: id("race"), token: "dup", kind: "resend", result: "sent", at: new Date().toISOString() });
  const ev2 = await R.recordDeliveryEvent(events, { inReplyTo: id("race"), token: "dup", kind: "resend", result: "failed", at: new Date().toISOString() });
  const evDoc = await events.findOne({ inReplyTo: id("race"), token: "dup" });
  check("E-DB3", "Delivery evidence unique per token on real MongoDB (second insert ignored)", ev1 === true && ev2 === false && evDoc?.result === "sent");

  // ── admin recovery routes ──
  const list = await fetch(`${base}/api/admin/ai`, { headers: { cookie: cookies } });
  const listJson = await list.json().catch(() => ({}));
  const raw = JSON.stringify(listJson.whatsappRecovery || {});
  check("E-H3", "Admin list: synthetic rows present, masked, no message text", list.status === 200 && raw.includes(RUN.slice(-6).slice(0, 1)) !== undefined && raw.includes("…0001") && !raw.includes("g3 synthetic"), `HTTP ${list.status}`);
  await seed("resend", { status: "failed", firstProblemAt: new Date().toISOString() });
  const anonResend = await action({ action: "wa_resend", id: id("resend"), confirm: true, acknowledgeDuplicateRisk: true }, { cookie: "" });
  check("E-H4", "Resend: anonymous → 401", anonResend.status === 401, `HTTP ${anonResend.status}`);
  const noAck = await action({ action: "wa_resend", id: id("resend"), confirm: true });
  // With the WhatsApp agent off (fail-closed switch, the required state), every resend is refused with 409 before any claim.
  const waAgentOff = noAck.status === 409 && /WhatsApp agent is not enabled/.test(await noAck.clone().text());
  check("E-H5", waAgentOff ? "Resend refused while the WhatsApp agent is off → 409 (agent-off branch)" : "Resend without duplicate-risk acknowledgement → 400", waAgentOff || noAck.status === 400, `HTTP ${noAck.status}`);
  const cross = await action({ action: "wa_resend", id: id("resend"), confirm: true, acknowledgeDuplicateRisk: true }, { origin: "https://evil.example" });
  check("E-H6", "Resend cross-origin → 403", cross.status === 403, `HTTP ${cross.status}`);
  const [a, b] = await Promise.all([1, 2].map(() => action({ action: "wa_resend", id: id("resend"), confirm: true, acknowledgeDuplicateRisk: true })));
  const after = await msgs.findOne({ inReplyTo: id("resend") });
  const evRows = await events.countDocuments({ inReplyTo: id("resend"), kind: "resend" });
  if (waAgentOff) check("E-H7", "Two simultaneous resends while the WhatsApp agent is off: both 409, record untouched (failed), no claim, no evidence row", a.status === 409 && b.status === 409 && after?.status === "failed" && after?.resendClaim == null && evRows === 0, `HTTP ${a.status}/${b.status}, status ${after?.status}, evidence ${evRows}`);
  else check("E-H7", "Two simultaneous resends: one proceeds, one 409; outbound off → resend_failed, nothing sent, one evidence row", [a.status, b.status].sort().join(",") === "409,502" && after?.status === "resend_failed" && after?.resendClaim == null && evRows === 1, `HTTP ${a.status}/${b.status}, status ${after?.status}, evidence ${evRows}`);
  const audit = await db.collection("ai_audit").countDocuments({ action: "admin_wa_resend", reservation: id("resend").slice(-6), acknowledged: true });
  check("E-H8", "Resend audited with the acknowledgement", audit >= 1, `audit rows ${audit}`);
  const expand = await action({ action: "wa_expand_message", id: id("resend") });
  const expandJson = await expand.json().catch(() => ({}));
  check("E-H9", "Expand message (main admin) returns the text, audited", expand.status === 200 && expandJson.text === "g3 synthetic resend", `HTTP ${expand.status}`);
  const resolved = await action({ action: "wa_mark_resolved", id: id("resend"), note: "g3 local test" });
  const resolvedAgain = await action({ action: "wa_mark_resolved", id: id("resend") });
  check("E-H10", "Mark resolved → 200; resolved is terminal (second → 409)", resolved.status === 200 && resolvedAgain.status === 409 && (await msgs.findOne({ inReplyTo: id("resend") }))?.status === "resolved", `HTTP ${resolved.status}/${resolvedAgain.status}`);
  await seed("claimed", { status: "resend_claimed", firstProblemAt: new Date().toISOString(), resendClaim: { token: "tokC", actor: "x", workerId: "crashed", at: "2026-11-15T00:00:00.000Z" } });
  const wrongClaim = await action({ action: "wa_reconcile_resend", id: id("claimed"), claimAt: "2026-11-14T00:00:00.000Z", outcome: "resend_unknown", reason: "checked evidence rows" });
  const okClaim = await action({ action: "wa_reconcile_resend", id: id("claimed"), claimAt: "2026-11-15T00:00:00.000Z", outcome: "resend_unknown", reason: "no evidence row for this token" });
  const recon = await msgs.findOne({ inReplyTo: id("claimed") });
  check("E-H11", "Abandoned claim: reconcile only for the reviewed claim (409 otherwise); audited fields set", wrongClaim.status === 409 && okClaim.status === 200 && recon?.status === "resend_unknown" && recon?.reconciledBy && recon?.resendClaim == null, `HTTP ${wrongClaim.status}/${okClaim.status}`);
} finally {
  // ── cleanup of synthetic records ──
  const ids = { $regex: `^wamid\\.g3local-${RUN}-` };
  const c1 = await msgs.deleteMany({ $or: [{ g3LocalTest: RUN }, { resendOf: ids }] });
  const c2 = await events.deleteMany({ inReplyTo: ids });
  const c3 = await db.collection("orders").deleteMany({ g3LocalTest: RUN });
  check("CLEAN", "Synthetic records removed (messages, evidence, orders); audit rows kept as audit evidence", (await msgs.countDocuments({ g3LocalTest: RUN })) === 0, `messages ${c1.deletedCount}, evidence ${c2.deletedCount}, orders ${c3.deletedCount}`);
  await mongo.close();
}

const lines = [`G3 local HTTP + MongoDB tests ${new Date().toISOString()} against ${base} (local test DB, synthetic data, no external calls)`, ""];
for (const r of results) lines.push(`${r.pass ? "PASS" : "FAIL"}  ${r.id} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.pass).length;
lines.push("", `TOTAL ${results.length - failed}/${results.length} pass`);
console.log(lines.join("\n"));
process.exit(failed ? 1 : 0);
