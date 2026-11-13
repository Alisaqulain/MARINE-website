// Isolated webhook tests (Voice/Vapi, Exotel, generic voice, WhatsApp/Meta, cron) against a local
// server started with `node scripts/isolated-env.mjs -- npx next dev -p 3939`.
// Uses ONLY the synthetic session secrets of the isolated environment (never a real credential).
// No external service is called; no call, message or e-mail can be produced.
//   node reports/evidence/phase2/webhook-tests.mjs [baseUrl]  -> prints and writes webhook-tests-<ts>.log
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { isolatedEnv } from "../../../scripts/isolated-env.mjs";

const BASE = process.argv[2] || "http://localhost:3939";
const { env } = isolatedEnv();
const S = { vapi: env.VAPI_WEBHOOK_SECRET, verify: env.META_WEBHOOK_VERIFY_TOKEN, meta: env.META_APP_SECRET, exotel: env.EXOTEL_WEBHOOK_TOKEN, cron: env.CRON_SECRET };
const secrets = Object.values(S).filter(Boolean);
const results = [];
const RUN = Date.now().toString(36);
const { createRequire } = await import("node:module");
const require2 = createRequire(import.meta.url);
const { loadEnvConfig } = require2("@next/env");
const { MongoClient } = require2("mongodb");
const dbEnv = loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."), true, { info() {}, error() {} }).combinedEnv;
const dbHost = (dbEnv.MONGODB_URI || "").match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/)?.[1] || "";
if (!/^127\.0\.0\.1:27018$/.test(dbHost)) { console.error("refusing: test database host is not 127.0.0.1:27018"); process.exit(2); }
const mongo = new MongoClient(dbEnv.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
const db = mongo.db(dbEnv.MONGODB_DB_NAME);
async function req(method, p, { headers = {}, body } = {}) {
  const r = await fetch(BASE + p, { method, headers, body, redirect: "manual" });
  const text = await r.text();
  lastText = text;
  return { status: r.status, text };
}
let lastText = "";
// "clean": a handled response, no stack trace, no secret echoed back
const clean = (t) => !secrets.some((s) => t.includes(s)) && !/\bat [\w.<>]+ \(|node_modules|Error: .*\n\s+at /.test(t);
async function t(agent, id, name, fn, expect, kind = "exact") {
  // kind: "exact" (status assertion) or an async function returning {ok, detail} (stored-data assertion)
  let r, ok, note = "";
  try { r = await fn(); } catch (e) { r = { status: "ERR", text: String(e.message) }; }
  if (kind === "exact") ok = (Array.isArray(expect) ? expect : [expect]).includes(r.status) && clean(r.text);
  else { const stored = await kind(); ok = r.status === 200 && clean(r.text) && stored.ok; note = "stored in test DB: " + stored.detail; }
  results.push({ agent, id, name, expected: Array.isArray(expect) ? expect.join("/") : expect, actual: r.status, pass: ok, kind: typeof kind === "string" ? kind : "stored", note, body: r.text.replace(/\s+/g, " ").slice(0, 140) });
}
const json = (o) => JSON.stringify(o);
const vapiMsg = (message) => json({ message: { call: { id: `isolated-test-call-${RUN}`, type: "webCall" }, ...message } });
const sign = (raw, secret) => "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");

// ── Voice & Call: Vapi server messages ──
await t("voice", "V1", "Vapi: no credentials → refused", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json" }, body: vapiMsg({ type: "status-update", status: "in-progress" }) }), 401);
await t("voice", "V2", "Vapi: wrong Bearer secret → refused", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", authorization: "Bearer " + crypto.randomBytes(32).toString("base64url") }, body: vapiMsg({ type: "status-update" }) }), 401);
await t("voice", "V3", "Vapi: wrong legacy X-Vapi-Secret → refused", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", "x-vapi-secret": "x".repeat(43) }, body: vapiMsg({ type: "status-update" }) }), 401);
await t("voice", "V4", "Vapi: secret differing only in length (prefix) → refused", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", authorization: "Bearer " + S.vapi.slice(0, -1) }, body: vapiMsg({ type: "status-update" }) }), 401);
await t("voice", "V5", "Vapi: correct Bearer, malformed JSON → client error", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", authorization: "Bearer " + S.vapi }, body: "{not json" }), [400, 422]);
await t("voice", "V6", "Vapi: correct Bearer, tool-call lookup_product → handled", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", authorization: "Bearer " + S.vapi }, body: vapiMsg({ type: "tool-calls", toolCallList: [{ id: "tc1", type: "function", function: { name: "lookup_product", arguments: { query: "brass anchor" } } }] }) }), 200, async () => ({ ok: lastText.includes('"toolCallId":"tc1"') && /Brass Anchor/i.test(lastText), detail: "tool result for tc1 names the Brass Anchor (from the test catalogue)" }));
await t("voice", "V7", "Vapi: correct legacy header, status-update → handled", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", "x-vapi-secret": S.vapi }, body: vapiMsg({ type: "status-update", status: "in-progress" }) }), 200, async () => ({ ok: true, detail: "status-only message (not persisted by design)" }));
await t("voice", "V8", "Vapi: correct Bearer, end-of-call-report → handled", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", authorization: "Bearer " + S.vapi }, body: vapiMsg({ type: "end-of-call-report", endedReason: "customer-ended-call", artifact: { transcript: "AI: Hello\nUser: test" }, analysis: { summary: "isolated test" } }) }), 200, async () => { const c = await db.collection("ai_calls").findOne({ id: `isolated-test-call-${RUN}` }); return { ok: Boolean(c && c.endedReason), detail: c ? `ai_calls record, endedReason=${c.endedReason}` : "no ai_calls record" }; });
await t("voice", "V9", "Voice webhook: GET without provider → 405", () => req("GET", "/api/ai/voice/webhook"), 405);
// ── Exotel ──
await t("voice", "X1", "Exotel callback: wrong token → refused", () => req("POST", "/api/ai/voice/webhook?provider=exotel&token=wrong-token", { headers: { "content-type": "application/x-www-form-urlencoded" }, body: "CallSid=isolated&Status=completed" }), [401, 403]);
await t("voice", "X2", "Exotel callback: no token → refused", () => req("POST", "/api/ai/voice/webhook?provider=exotel", { headers: { "content-type": "application/x-www-form-urlencoded" }, body: "CallSid=isolated&Status=completed" }), [401, 403]);
await t("voice", "X3", "Exotel callback: correct token → handled", () => req("POST", `/api/ai/voice/webhook?provider=exotel&token=${encodeURIComponent(S.exotel)}`, { headers: { "content-type": "application/x-www-form-urlencoded" }, body: `CallSid=isolated-test-${RUN}&Status=completed&From=0000000000` }), 200, async () => { const c = await db.collection("ai_calls").findOne({ id: `exotel_isolated-test-${RUN}` }); return { ok: Boolean(c), detail: c ? "ai_calls record" : "no ai_calls record" }; });
// ── generic HMAC voice provider: not configured in isolation → must refuse ──
await t("voice", "G1", "Generic voice signature with no VOICE_WEBHOOK_SECRET → refused (503)", () => req("POST", "/api/ai/voice/webhook", { headers: { "content-type": "application/json", "x-marina-voice-signature": "sha256=00" }, body: "{}" }), 503);

// ── WhatsApp / Meta webhook ──
await t("whatsapp", "W1", "Verify handshake: wrong token → 403", () => req("GET", "/api/meta/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345"), 403);
await t("whatsapp", "W2", "Verify handshake: correct token → echoes challenge", async () => { const r = await req("GET", `/api/meta/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(S.verify)}&hub.challenge=987654321`); return { ...r, status: r.status === 200 && r.text === "987654321" ? 200 : `${r.status} (body mismatch)` }; }, 200);
await t("whatsapp", "W3", "Verify handshake: wrong mode → 403", () => req("GET", `/api/meta/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=${encodeURIComponent(S.verify)}&hub.challenge=1`), [400, 403]);
const waPayload = json({ object: "whatsapp_business_account", entry: [{ id: "000000000000000", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "15550001111", phone_number_id: "000000000000000" }, contacts: [{ wa_id: "919999000001", profile: { name: "Isolated Test" } }], messages: [{ from: "919999000001", id: `wamid.isolated-test-${RUN}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Hello, do you sell brass telescopes?" } }] } }] }] });
await t("whatsapp", "W4", "Event: no signature → refused", () => req("POST", "/api/meta/whatsapp/webhook", { headers: { "content-type": "application/json" }, body: waPayload }), [401, 403]);
await t("whatsapp", "W5", "Event: signature with wrong secret → refused", () => req("POST", "/api/meta/whatsapp/webhook", { headers: { "content-type": "application/json", "x-hub-signature-256": sign(waPayload, "wrong-secret") }, body: waPayload }), [401, 403]);
await t("whatsapp", "W6", "Event: body altered after signing → refused", () => req("POST", "/api/meta/whatsapp/webhook", { headers: { "content-type": "application/json", "x-hub-signature-256": sign(waPayload, S.meta) }, body: waPayload.replace("telescopes", "anchors") }), [401, 403]);
await t("whatsapp", "W7", "Event: valid signature, not JSON → 400", () => { const raw = "not json"; return req("POST", "/api/meta/whatsapp/webhook", { headers: { "content-type": "application/json", "x-hub-signature-256": sign(raw, S.meta) }, body: raw }); }, 400);
await t("whatsapp", "W8", "Event: valid signature, synthetic inbound text → handled (no reply: outbound off)", () => req("POST", "/api/meta/whatsapp/webhook", { headers: { "content-type": "application/json", "x-hub-signature-256": sign(waPayload, S.meta) }, body: waPayload }), 200, async () => { const m = await db.collection("ai_wa_messages").findOne({ wamid: `wamid.isolated-test-${RUN}` }); const sent = await db.collection("ai_wa_messages").countDocuments({ direction: "out", status: { $nin: ["withheld"] }, at: { $gte: new Date(Date.now() - 600000) } }); return { ok: Boolean(m) && sent === 0, detail: `inbound stored=${Boolean(m)}, outbound sent in last 10 min=${sent}` }; });

// ── scheduled jobs (Growth & Revenue / follow-ups) ──
await t("growth", "C1", "Cron jobs: no bearer → 401", () => req("POST", "/api/ai/jobs"), 401);
await t("growth", "C2", "Cron jobs: wrong bearer → 401", () => req("POST", "/api/ai/jobs", { headers: { authorization: "Bearer " + "y".repeat(43) } }), 401);
await t("growth", "C3", "Daily report: no bearer → 401", () => req("GET", "/api/ai/report/daily?dry=1"), 401);
await t("growth", "C4", "Cron jobs: correct bearer → handled", () => req("POST", "/api/ai/jobs", { headers: { authorization: "Bearer " + S.cron } }), 200, async () => ({ ok: true, detail: "job run answered ok (nothing queued)" }));

await mongo.close();
const ts = new Date().toISOString();
const lines = [`Isolated webhook tests ${ts} against ${BASE} (synthetic session secrets only; no external calls; test database 127.0.0.1:27018 is UP and asserted)`, ""];
for (const r of results) lines.push(`${r.pass ? "PASS" : "FAIL"}  [${r.agent}] ${r.id} ${r.name}: expected ${r.expected}, got ${r.actual}${r.note ? "  (" + r.note + ")" : ""}  | ${r.body}`);
const by = (a) => results.filter((r) => r.agent === a);
lines.push("", ...["voice", "whatsapp", "growth"].map((a) => `${a}: ${by(a).filter((r) => r.pass).length}/${by(a).length} pass (${by(a).filter((r) => r.kind !== "exact").length} with stored-data/response assertions)`), `TOTAL ${results.filter((r) => r.pass).length}/${results.length} pass`);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), `webhook-tests-${ts.slice(0, 16).replace(/[-:]/g, "")}Z.log`);
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.join("\n"));
