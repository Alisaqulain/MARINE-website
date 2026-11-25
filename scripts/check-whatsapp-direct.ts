// @ts-nocheck
// Offline checks for the WhatsApp Direct Cloud API changes C1–C10 (approved 11 Nov 2026).
//
//   node scripts/isolated-env.mjs -- npm run check:whatsapp-direct
//
// OFFLINE UNIT TESTS ONLY. No network: global fetch is replaced by a spy that records calls and never reaches the
// internet. No database: C5 scenarios run against a SIMULATED in-memory collection that mimics MongoDB unique /
// partial unique indexes and can be switched "down". They are NOT MongoDB integration tests.
// Every identifier, token and secret below is fake.
import { createHmac } from "node:crypto";
import fs from "node:fs";
import {
  BLOCKED_LIVE_NUMBER,
  DIRECT_MODE_ROUTE_ERROR,
  KNOWN_PRODUCTION_APP_ID,
  KNOWN_PRODUCTION_CONFIG_ID,
  MAX_WEBHOOK_BYTES,
  directModeRouteBlock,
  directOutboundDecision,
  directStatus,
  filterDirectWebhook,
  integrationMode,
  sendEnvironmentDecision,
} from "../lib/whatsapp/mode.ts";
import { encryptToken, metaAppIds, normaliseWebhook, outboundAllowed, publicStatus, shouldSendWhatsApp, verifySignature } from "../lib/whatsapp/coexistence.ts";
import { postMessage, resolveCredentials, sendGate, statusUpdatesFromWebhook } from "../lib/whatsapp/cloud.ts";
import { CLAIM_LEASE_MS, claimEvent, completeEvent, failEvent, recordInboundOnce, reserveReply } from "../lib/whatsapp/event-claims.ts";
import { WEBHOOK_FAILED_MESSAGE, processWebhookBody } from "../lib/whatsapp/webhook-process.ts";
import { isolatedEnv, validateWhatsAppTestCreds } from "./isolated-env.mjs";
import { ENV_REGISTRY } from "../lib/ai/env-registry.ts";

const results = [];
let section = "";
function check(id, name, pass, detail = "") {
  results.push({ section, id, name, pass: Boolean(pass), detail: String(detail).slice(0, 220) });
}

// ── fake identifiers (never real) ──
const WABA = "100000000000011";
const PNID = "100000000000022";
const FOREIGN_WABA = "900000000000011";
const FOREIGN_PNID = "900000000000022";
const TOKEN = "EAAfakeTokenForOfflineTestsOnly000";
const SECRET = "fake-app-secret-for-offline-tests";
const TESTER = "919999000001";

// ── process.env helpers: start from a clean WhatsApp/Meta environment ──
const WA_KEYS = Object.keys(process.env).filter((k) => /^(WHATSAPP_|META_|AUTH_SECRET$|MARINA_ISOLATED_TEST$)/.test(k));
for (const k of WA_KEYS) delete process.env[k];
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
// Phase 2 F: a valid, populated fingerprint file of FAKE production identifiers (none equal to the test IDs below), so
// the existing C-tests run with fingerprint protection active, exactly as a configured environment would.
import os from "node:os";
import path from "node:path";
import { createHash as __h } from "node:crypto";
const __fp = (kind, id) => __h("sha256").update(kind + ":" + id).digest("hex");
const FAKE_PROD = { waba: "800000000000011", phone_number_id: "800000000000022", app_id: "800000000000033", config_id: "800000000000044", recipient: "918000000000" };
const FP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wa-fp-"));
const FP_FILE = path.join(FP_DIR, "fingerprints.json");
fs.writeFileSync(FP_FILE, JSON.stringify({ version: 1, ids: { waba: [__fp("waba", FAKE_PROD.waba)], phone_number_id: [__fp("phone_number_id", FAKE_PROD.phone_number_id)], app_id: [__fp("app_id", FAKE_PROD.app_id)], config_id: [__fp("config_id", FAKE_PROD.config_id)] }, recipients: [__fp("recipient", FAKE_PROD.recipient)] }));
process.env.WHATSAPP_FINGERPRINT_FILE = FP_FILE;
function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) (v === undefined ? delete process.env[k] : (process.env[k] = v));
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) (v === undefined ? delete process.env[k] : (process.env[k] = v));
  }
}
async function withEnvAsync(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) (v === undefined ? delete process.env[k] : (process.env[k] = v));
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) (v === undefined ? delete process.env[k] : (process.env[k] = v));
  }
}
const DIRECT = { WHATSAPP_INTEGRATION_MODE: "direct", WHATSAPP_ACCESS_TOKEN: TOKEN, WHATSAPP_PHONE_NUMBER_ID: PNID, WHATSAPP_BUSINESS_ACCOUNT_ID: WABA };
const TESTCFG = { WHATSAPP_TEST_PHONE_NUMBER_ID: PNID, WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: WABA, WHATSAPP_TEST_RECIPIENTS: TESTER };

// ── fetch spy: no request can leave this process ──
const fetchCalls = [];
globalThis.fetch = async (url) => {
  fetchCalls.push(String(url));
  return new Response(JSON.stringify({ messages: [{ id: "wamid.fake-from-spy" }] }), { status: 200, headers: { "content-type": "application/json" } });
};

const gateInput = (creds, to = TESTER) => ({ to, suppressed: false, template: false, windowOpen: true, consent: false, creds });

// ════════════════════ C1: send permission independent of coexistence ════════════════════
section = "C1 send permission (direct mode)";
check("C1.1", "Mode defaults to coexistence when unset", integrationMode({}) === "coexistence");
check("C1.2", "WHATSAPP_INTEGRATION_MODE=direct selects direct mode", integrationMode({ WHATSAPP_INTEGRATION_MODE: "direct" }) === "direct");
check("C1.3", "Unknown mode value keeps coexistence (previous behaviour)", integrationMode({ WHATSAPP_INTEGRATION_MODE: "dirct" }) === "coexistence");
const table = [
  // [label, extra env, recipient, expected]
  ["all off", {}, TESTER, false],
  ["outbound only (was P14)", { WHATSAPP_OUTBOUND_ENABLED: "true" }, TESTER, false],
  ["coexistence flags only (no direct approval)", { WHATSAPP_COEXISTENCE_ENABLED: "true", WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "true", WHATSAPP_OUTBOUND_ENABLED: "true" }, TESTER, false],
  ["outbound + production sending approved", { WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_PRODUCTION_SENDING_APPROVED: "true" }, "919800000000", true],
  ["production approval without outbound flag", { WHATSAPP_PRODUCTION_SENDING_APPROVED: "true" }, "919800000000", false],
  ["test config + allow-listed recipient", { WHATSAPP_OUTBOUND_ENABLED: "true", ...TESTCFG }, TESTER, true],
  ["test config + recipient NOT allow-listed", { WHATSAPP_OUTBOUND_ENABLED: "true", ...TESTCFG }, "919800000000", false],
  ["test phone id differs from configured", { WHATSAPP_OUTBOUND_ENABLED: "true", ...TESTCFG, WHATSAPP_TEST_PHONE_NUMBER_ID: FOREIGN_PNID }, TESTER, false],
  ["test WABA differs from configured", { WHATSAPP_OUTBOUND_ENABLED: "true", ...TESTCFG, WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: FOREIGN_WABA }, TESTER, false],
  ["test WABA missing", { WHATSAPP_OUTBOUND_ENABLED: "true", ...TESTCFG, WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: undefined }, TESTER, false],
];
table.forEach(([label, extra, to, expected], i) => {
  const env = { ...DIRECT, ...extra };
  const d = directOutboundDecision(env, to);
  const gate = withEnv({ ...Object.fromEntries(Object.keys({ ...DIRECT, ...TESTCFG, WHATSAPP_OUTBOUND_ENABLED: 1, WHATSAPP_PRODUCTION_SENDING_APPROVED: 1, WHATSAPP_COEXISTENCE_ENABLED: 1, WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: 1 }).map((k) => [k, undefined])), ...env }, () =>
    sendGate(gateInput(resolveCredentials(null), to))
  );
  check(`C1.T${i + 1}`, `Truth table: ${label} → ${expected ? "allowed" : "refused"}`, d.ok === expected && gate.allowed === expected, `${d.reason} | gate: ${gate.reason}`);
});
check(
  "C1.4",
  "Live business number refused in direct mode even with production approval",
  withEnv({ ...DIRECT, WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_PRODUCTION_SENDING_APPROVED: "true" }, () => !sendGate(gateInput(resolveCredentials(null), BLOCKED_LIVE_NUMBER)).allowed)
);
check(
  "C1.5",
  "Live number can never be a test recipient",
  withEnv({ ...DIRECT, ...TESTCFG, WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_TEST_RECIPIENTS: `${TESTER},${BLOCKED_LIVE_NUMBER}` }, () => !sendGate(gateInput(resolveCredentials(null), BLOCKED_LIVE_NUMBER)).allowed)
);
check("C1.6", "Direct mode: window, consent and suppression rules still apply", withEnv({ ...DIRECT, WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_PRODUCTION_SENDING_APPROVED: "true" }, () => {
  const c = resolveCredentials(null);
  return !sendGate({ ...gateInput(c), windowOpen: false }).allowed && !sendGate({ ...gateInput(c), template: true, consent: false }).allowed && !sendGate({ ...gateInput(c), suppressed: true }).allowed;
}));
check("C1.7", "Coexistence mode unchanged: three flags allow, outbound alone does not", outboundAllowed({ WHATSAPP_COEXISTENCE_ENABLED: "true", WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "true", WHATSAPP_OUTBOUND_ENABLED: "true" }) === true && outboundAllowed({ WHATSAPP_OUTBOUND_ENABLED: "true" }) === false);
check("C1.8", "shouldSendWhatsApp in direct mode ignores coexistence flags", shouldSendWhatsApp({ ...DIRECT, WHATSAPP_COEXISTENCE_ENABLED: "true", WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "true", WHATSAPP_OUTBOUND_ENABLED: "true" }) === false && shouldSendWhatsApp({ ...DIRECT, WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_PRODUCTION_SENDING_APPROVED: "true" }) === true);

// ════════════════════ C2: callers ════════════════════
section = "C2 send context";
check("C2.1", "Test-mode send decided without any stored display number (was P15)", withEnv({ ...DIRECT, ...TESTCFG, WHATSAPP_OUTBOUND_ENABLED: "true" }, () => sendGate(gateInput(resolveCredentials(null))).allowed));
const inboundSrc = fs.readFileSync("lib/whatsapp/inbound.ts", "utf8");
const followSrc = fs.readFileSync("lib/ai/followups.ts", "utf8");
check("C2.2", "deliver() reads no Coexistence state in direct mode", /isDirectMode\(\) \? null : await readCoexistenceState\(\)/.test(inboundSrc));
check("C2.3", "follow-ups read no Coexistence state in direct mode", /resolveCredentials\(isDirectMode\(\) \? null : await readCoexistenceState\(\)\)/.test(followSrc));

// ════════════════════ C3: environment-only credentials ════════════════════
section = "C3 credentials";
const cipher = encryptToken("EAAstoredSignupTokenFake000", "fake-auth-secret-0123456789abcdef");
const stored = { mode: "stored", tokenCiphertext: cipher, phoneNumberId: FOREIGN_PNID, wabaId: FOREIGN_WABA };
withEnv({ AUTH_SECRET: "fake-auth-secret-0123456789abcdef", WHATSAPP_INTEGRATION_MODE: "direct" }, () => {
  const c = resolveCredentials(stored);
  check("C3.1", "Direct mode + stored Embedded Signup token + empty env → no credentials", c.source === "none" && c.token === "" && c.phoneNumberId === "" && c.wabaId === "", JSON.stringify({ ...c, token: c.token ? "[set]" : "" }));
});
withEnv({ AUTH_SECRET: "fake-auth-secret-0123456789abcdef", ...DIRECT }, () => {
  const c = resolveCredentials(stored);
  check("C3.2", "Direct mode uses env values only (stored IDs ignored)", c.source === "env" && c.token === TOKEN && c.phoneNumberId === PNID && c.wabaId === WABA);
});
withEnv({ ...DIRECT, WHATSAPP_BUSINESS_ACCOUNT_ID: undefined }, () => {
  const c = resolveCredentials(stored);
  check("C3.3", "Direct mode with a missing WABA ID → token withheld (fail closed)", c.source === "none" && c.token === "");
});
withEnv({ AUTH_SECRET: "fake-auth-secret-0123456789abcdef", WHATSAPP_INTEGRATION_MODE: undefined }, () => {
  const c = resolveCredentials(stored);
  check("C3.4", "Coexistence mode unchanged: stored signup token still used when env token is empty", c.source === "signup" && c.token === "EAAstoredSignupTokenFake000");
});

// ════════════════════ C4: webhook filter, raw bytes, size ════════════════════
section = "C4 webhook filtering and signature";
const cfg = { WHATSAPP_BUSINESS_ACCOUNT_ID: WABA, WHATSAPP_PHONE_NUMBER_ID: PNID };
const msgChange = (pnid, id = "wamid.c4", extra = {}) => ({ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "15550001111", phone_number_id: pnid }, contacts: [{ wa_id: TESTER, profile: { name: "Fake" } }], messages: [{ from: TESTER, id, timestamp: "1700000000", type: "text", text: { body: "hello" } }], ...extra } });
const body = (entries) => ({ object: "whatsapp_business_account", entry: entries });
const f1 = filterDirectWebhook(body([{ id: WABA, changes: [msgChange(FOREIGN_PNID)] }]), cfg);
check("C4.1", "Foreign phone-number ID ignored (was P10: drafted)", f1.ok && f1.accepted === 0 && f1.ignoredForeign === 1 && normaliseWebhook(f1.body).length === 0, JSON.stringify({ a: f1.accepted, f: f1.ignoredForeign }));
const f2 = filterDirectWebhook(body([{ id: FOREIGN_WABA, changes: [msgChange(PNID)] }]), cfg);
check("C4.2", "Foreign WABA (entry.id) ignored", f2.ok && f2.accepted === 0 && f2.ignoredForeign === 1 && normaliseWebhook(f2.body).length === 0);
const f3 = filterDirectWebhook(body([{ changes: [msgChange(PNID)] }]), cfg);
check("C4.3", "Missing WABA ID ignored", f3.ok && f3.accepted === 0 && normaliseWebhook(f3.body).length === 0);
const f4 = filterDirectWebhook(body([{ id: WABA, changes: [{ field: "messages", value: { messages: [{ id: "wamid.x", from: TESTER, type: "text", text: { body: "x" } }] } }] }]), cfg);
check("C4.4", "Missing phone-number ID ignored", f4.ok && f4.accepted === 0 && normaliseWebhook(f4.body).length === 0);
const f5 = filterDirectWebhook(body([{ id: WABA, changes: [msgChange(PNID, "wamid.ok")] }]), cfg);
const ev5 = normaliseWebhook(f5.body);
check("C4.5", "Matching WABA + phone-number ID accepted", f5.ok && f5.accepted === 1 && ev5.length === 1 && ev5[0].messageId === "wamid.ok");
const f6 = filterDirectWebhook(body([{ id: WABA, changes: [{ field: "history", value: { metadata: { phone_number_id: PNID }, history: [] } }, { field: "smb_message_echoes", value: { metadata: { phone_number_id: PNID } } }] }]), cfg);
check("C4.6", "Coexistence fields (history, echoes) dropped in direct mode", f6.ok && f6.accepted === 0 && f6.ignoredOther === 2);
const statusBody = (pnid) => body([{ id: WABA, changes: [{ field: "messages", value: { metadata: { phone_number_id: pnid }, statuses: [{ id: "wamid.s", status: "delivered", recipient_id: TESTER, timestamp: "1700000000" }] } }] }]);
check("C4.7", "Status update for a foreign phone-number ID ignored; own one kept", statusUpdatesFromWebhook(filterDirectWebhook(statusBody(FOREIGN_PNID), cfg).body).length === 0 && statusUpdatesFromWebhook(filterDirectWebhook(statusBody(PNID), cfg).body).length === 1);
const f8 = filterDirectWebhook(body([{ id: WABA, changes: [msgChange(PNID)] }]), {});
check("C4.8", "Direct mode without configured IDs → 503 (fail closed)", !f8.ok && f8.status === 503);
const f9 = filterDirectWebhook(body([{ id: WABA, changes: [msgChange(PNID, "wamid.a"), msgChange(FOREIGN_PNID, "wamid.b")] }]), cfg);
check("C4.9", "Mixed delivery: only the matching change survives", f9.ok && f9.accepted === 1 && f9.ignoredForeign === 1 && normaliseWebhook(f9.body).map((e) => e.messageId).join() === "wamid.a");
const sign = (bytes) => "sha256=" + createHmac("sha256", SECRET).update(bytes).digest("hex");
const uni = Buffer.from(JSON.stringify(body([{ id: WABA, changes: [msgChange(PNID, "wamid.u")] }])).replace("hello", "नमस्ते ⚓ café"), "utf8");
check("C4.10", "Valid signature over non-ASCII bytes accepted", verifySignature(uni, sign(uni), SECRET).ok);
const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), uni]);
const decodedLikeReqText = new TextDecoder().decode(bom); // what req.text() would give (BOM removed)
check("C4.11", "BOM body: raw-byte check accepts Meta's signature; decoded-text check would not", verifySignature(bom, sign(bom), SECRET).ok && !verifySignature(decodedLikeReqText, sign(bom), SECRET).ok);
const invalid = Buffer.concat([Buffer.from('{"object":"whatsapp_business_account","x":"'), Buffer.from([0xff, 0xfe]), Buffer.from('"}')]);
check("C4.12", "Invalid UTF-8 byte: raw-byte check is exact; decoded text differs", verifySignature(invalid, sign(invalid), SECRET).ok && !verifySignature(invalid.toString("utf8"), sign(invalid), SECRET).ok);
check("C4.13", "Altered byte rejected (401)", verifySignature(Buffer.from(uni).fill(0x41, 5, 6), sign(uni), SECRET).status === 401);
check("C4.14", "Missing signature rejected (401); secret unset → 503", verifySignature(uni, null, SECRET).status === 401 && verifySignature(uni, sign(uni), "").status === 503);
const routeSrc = fs.readFileSync("app/api/meta/whatsapp/webhook/route.ts", "utf8");
const iSize = routeSrc.indexOf("MAX_WEBHOOK_BYTES) {");
const iSig = routeSrc.indexOf("verifySignature(raw");
const iFilter = routeSrc.indexOf("filterDirectWebhook(body)");
const iProcess = routeSrc.indexOf("processWebhookBody(");
check("C4.15", "Route order: size limit → signature over raw bytes → ID filter → processing", iSize > 0 && iSize < iSig && iSig < iFilter && iFilter < iProcess && routeSrc.includes("req.arrayBuffer()") && !routeSrc.includes("req.text()"));
check("C4.16", "Size limit is 1 MB and answered with 413", MAX_WEBHOOK_BYTES === 1_000_000 && (routeSrc.match(/status: 413/g) || []).length === 2);

// ════════════════════ C6: non-production send guard ════════════════════
section = "C6 non-production send guard (fetch spy; no network)";
async function sendAttempt(vars, to = TESTER) {
  const before = fetchCalls.length;
  const res = await withEnvAsync(vars, () => postMessage(resolveCredentials(null), { to, type: "text", text: { body: "x" } }));
  return { res, fetched: fetchCalls.length - before };
}
const ALLOWED_DIRECT = { ...DIRECT, WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_PRODUCTION_SENDING_APPROVED: "true" };
for (const [id, nodeEnv] of [["C6.1", "development"], ["C6.2", "test"], ["C6.3", undefined]]) {
  const a = await sendAttempt({ ...ALLOWED_DIRECT, NODE_ENV: nodeEnv, MARINA_ISOLATED_TEST: undefined });
  check(id, `NODE_ENV=${nodeEnv ?? "(unset)"}: send refused before any network request`, !a.res.ok && a.fetched === 0, a.res.error);
}
const bypass = await sendAttempt({ ...ALLOWED_DIRECT, NODE_ENV: "development", WHATSAPP_ALLOW_OUTSIDE_PRODUCTION: "true" });
check("C6.4", "No override variable bypasses the guard (WHATSAPP_ALLOW_OUTSIDE_PRODUCTION ignored)", !bypass.res.ok && bypass.fetched === 0);
const isoMismatch = await sendAttempt({ ...ALLOWED_DIRECT, NODE_ENV: "development", MARINA_ISOLATED_TEST: "1", WHATSAPP_TEST_PHONE_NUMBER_ID: FOREIGN_PNID, WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: WABA });
check("C6.5", "Isolated launcher but configured phone ID ≠ test phone ID → refused, no request", !isoMismatch.res.ok && isoMismatch.fetched === 0);
const isoNoWaba = await sendAttempt({ ...ALLOWED_DIRECT, NODE_ENV: "development", MARINA_ISOLATED_TEST: "1", WHATSAPP_TEST_PHONE_NUMBER_ID: PNID });
check("C6.6", "Isolated launcher without matching test WABA → refused, no request", !isoNoWaba.res.ok && isoNoWaba.fetched === 0);
const coexDev = await sendAttempt({ WHATSAPP_INTEGRATION_MODE: undefined, WHATSAPP_ACCESS_TOKEN: TOKEN, WHATSAPP_PHONE_NUMBER_ID: PNID, NODE_ENV: "development", MARINA_ISOLATED_TEST: "1", ...TESTCFG });
check("C6.7", "Coexistence mode outside production → refused, no request", !coexDev.res.ok && coexDev.fetched === 0);
const live = await sendAttempt({ ...ALLOWED_DIRECT, NODE_ENV: "production" }, BLOCKED_LIVE_NUMBER);
check("C6.8", "Production: live business number refused inside postMessage, no request", !live.res.ok && live.fetched === 0);
const isoOk = await sendAttempt({ ...DIRECT, ...TESTCFG, NODE_ENV: "development", MARINA_ISOLATED_TEST: "1" });
check("C6.9", "Isolated launcher + exact test IDs: guard opens (request reached the SPY only, test phone ID in URL)", isoOk.res.ok && isoOk.fetched === 1 && fetchCalls.at(-1).includes(`/${PNID}/messages`));
const prod = await sendAttempt({ ...ALLOWED_DIRECT, NODE_ENV: "production" });
check("C6.10", "Production: guard opens (request reached the SPY only)", prod.res.ok && prod.fetched === 1);
check("C6.11", "sendEnvironmentDecision is fail-closed for an empty environment", !sendEnvironmentDecision({}, PNID).ok);
// Bypass audit: the only code that posts to Graph /messages is postMessage.
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) files.push(p);
  }
})("lib");
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) files.push(p);
  }
})("app");
const messagesUrl = files.filter((p) => /graph\.facebook\.com|graphUrl\(/.test(fs.readFileSync(p, "utf8")) && /\/messages`/.test(fs.readFileSync(p, "utf8")));
// Call sites only ("await postMessage(creds"); the definition "function postMessage(creds: …" in cloud.ts is not a caller.
const postCallers = files.filter((p) => /await postMessage\(creds/.test(fs.readFileSync(p, "utf8")));
check("C6.13a", "Bypass audit: postMessage is defined once, in lib/whatsapp/cloud.ts", files.filter((p) => /function postMessage\(/.test(fs.readFileSync(p, "utf8"))).join() === "lib/whatsapp/cloud.ts");
check("C6.12", "Bypass audit: only lib/whatsapp/cloud.ts builds a Graph /messages URL", messagesUrl.length === 1 && messagesUrl[0] === "lib/whatsapp/cloud.ts", messagesUrl.join(", "));
check("C6.13", "Bypass audit: postMessage callers are inbound.ts, followups.ts, the audited admin resend route and the audited manual admin reply only", postCallers.sort().join() === "app/api/admin/ai/actions/route.ts,lib/ai/followups.ts,lib/whatsapp/inbound.ts,lib/whatsapp/manual-reply.ts", postCallers.join(", "));
check("C6.14", "Bypass audit: coexistence-actions Graph helper refuses /messages", /\/messages\$\/\.test\(path\)/.test(fs.readFileSync("lib/whatsapp/coexistence.ts", "utf8")));

// ════════════════════ C7: routes closed in direct mode ════════════════════
section = "C7 Embedded Signup / Coexistence routes";
const blocked = directModeRouteBlock({ WHATSAPP_INTEGRATION_MODE: "direct" });
check("C7.1", "Direct mode → 410 with calledMeta=false", blocked?.status === 410 && blocked.body.calledMeta === false && blocked.body.error === DIRECT_MODE_ROUTE_ERROR);
check("C7.2", "Coexistence mode → routes stay open (unchanged)", directModeRouteBlock({}) === null);
for (const [id, p] of [["C7.3", "app/api/meta/whatsapp/signup/exchange/route.ts"], ["C7.4", "app/api/meta/whatsapp/signup/approve/route.ts"], ["C7.5", "app/api/meta/whatsapp/coexistence/route.ts"]]) {
  const src = fs.readFileSync(p, "utf8");
  const post = src.slice(src.indexOf("export async function POST"));
  const firstLines = post.split("\n").slice(1, 5).join("\n");
  check(id, `${p.split("/").slice(-3, -1).join("/")}: directModeRouteBlock() runs first in POST (before auth, parsing, Meta)`, /directModeRouteBlock\(\)/.test(firstLines) && post.indexOf("directModeRouteBlock()") < post.indexOf("requireAdminSession"));
}

// ════════════════════ C8: status, panel, health ════════════════════
section = "C8 status, admin panel, health";
const st = directStatus({ ...DIRECT, META_APP_SECRET: SECRET, META_WEBHOOK_VERIFY_TOKEN: "fake-verify-token-123456", META_APP_ID: "123456789012345", WHATSAPP_OUTBOUND_ENABLED: "true", ...TESTCFG }, "2026-11-11T00:00:00.000Z");
const stJson = JSON.stringify(st);
check("C8.1", "Direct status exposes no token, secret, verify token or full ID", !stJson.includes(TOKEN) && !stJson.includes(SECRET) && !stJson.includes("fake-verify-token") && !stJson.includes(PNID) && !stJson.includes(WABA) && !stJson.includes(TESTER), stJson.slice(0, 200));
check("C8.2", "Direct status shows masked IDs and flags", st.wabaIdMasked === "1000…0011" && st.phoneNumberIdMasked === "1000…0022" && st.tokenConfigured && st.outbound.testConfigMatches && st.embeddedSignup === "disabled");
const panel = fs.readFileSync("components/AdminWhatsAppPanel.tsx", "utf8");
check("C8.3", "Panel: direct branch returns before the Facebook SDK <Script> and signup controls", panel.indexOf("if (direct) {") > 0 && panel.indexOf("if (direct) {") < panel.indexOf("<Script src=\"https://connect.facebook.net") && !panel.slice(panel.indexOf("function DirectPanel"), panel.indexOf("export function AdminWhatsAppPanel")).includes("FB."));
const panelHooksEnd = panel.lastIndexOf("useState(");
check("C8.4", "Panel: all hooks are declared before the direct-mode early return (React hook order)", panelHooksEnd < panel.indexOf("if (direct) {"));
const integ = fs.readFileSync("lib/ai/integrations.ts", "utf8");
const coexFn = integ.slice(integ.indexOf("export async function checkCoexistence"));
check("C8.5", "Integrations: coexistence check returns not_applicable before any Meta lookup in direct mode", coexFn.indexOf("isDirectMode()") > 0 && coexFn.indexOf("isDirectMode()") < coexFn.indexOf("appWebhookFields"));
const health = fs.readFileSync("lib/ai/health.ts", "utf8");
check("C8.6", "Health: coexistence not required for Agent 4 in direct mode", /isDirectMode\(\)\s*\?\s*c\("Business app coexistence", true, "info"/.test(health));
const statusRoute = fs.readFileSync("app/api/meta/whatsapp/status/route.ts", "utf8");
check("C8.7", "Status route returns directStatus in direct mode", /if \(isDirectMode\(\)\) return NextResponse\.json\(directStatus\(/.test(statusRoute));

// ════════════════════ C9: no hard-coded production IDs ════════════════════
section = "C9 production ID fallbacks removed";
const ids = metaAppIds({});
check("C9.1", "metaAppIds({}) → empty app and config id (no fallback)", ids.appId === "" && ids.configId === "");
const ps = publicStatus({}, null);
check("C9.2", "publicStatus without env exposes no production id", ps.appId === "" && ps.configId === "" && !JSON.stringify(ps).includes(KNOWN_PRODUCTION_CONFIG_ID) && !JSON.stringify(ps).includes(KNOWN_PRODUCTION_APP_ID));
const example = fs.readFileSync(".env.example", "utf8");
check("C9.3", ".env.example: META_APP_ID and META_CONFIG_ID blank, no production ids", /^META_APP_ID=$/m.test(example) && /^META_CONFIG_ID=$/m.test(example) && !example.includes(KNOWN_PRODUCTION_APP_ID) && !example.includes(KNOWN_PRODUCTION_CONFIG_ID));
const gen = fs.readFileSync("scripts/gen-env-docs.ts", "utf8");
check("C9.4", "Env doc generator has no production id defaults", !gen.includes(KNOWN_PRODUCTION_APP_ID) && !gen.includes(KNOWN_PRODUCTION_CONFIG_ID));
const registry = fs.readFileSync("lib/ai/env-registry.ts", "utf8");
check("C9.5", "Env registry text has no production ids", !registry.includes(KNOWN_PRODUCTION_APP_ID) && !registry.includes(KNOWN_PRODUCTION_CONFIG_ID));
const idHits = files.filter((p) => { const s = fs.readFileSync(p, "utf8"); return s.includes(KNOWN_PRODUCTION_APP_ID) || s.includes(KNOWN_PRODUCTION_CONFIG_ID); });
check("C9.6", "Production ids appear in app/lib code only as the deny-list constants in lib/whatsapp/mode.ts", idHits.join() === "lib/whatsapp/mode.ts", idHits.join(", "));

// ════════════════════ C10: isolated launcher ════════════════════
section = "C10 isolated launcher (fake identifiers only)";
const good = { WHATSAPP_ACCESS_TOKEN: TOKEN, WHATSAPP_PHONE_NUMBER_ID: PNID, WHATSAPP_BUSINESS_ACCOUNT_ID: WABA, WHATSAPP_TEST_PHONE_NUMBER_ID: PNID, WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: WABA, WHATSAPP_TEST_RECIPIENTS: TESTER };
const v = (over) => validateWhatsAppTestCreds({ ...good, ...over });
check("C10.1", "No WhatsApp direct values supplied → accepted (direct mode stays unconfigured)", validateWhatsAppTestCreds({}).length === 0);
check("C10.2", "Exactly matching fake test IDs → accepted", v({}).length === 0);
check("C10.3", "Phone-number ID ≠ test phone-number ID → refused", v({ WHATSAPP_PHONE_NUMBER_ID: FOREIGN_PNID }).some((p) => /WHATSAPP_PHONE_NUMBER_ID does not exactly match/.test(p)));
check("C10.4", "WABA ID ≠ test WABA ID → refused", v({ WHATSAPP_BUSINESS_ACCOUNT_ID: FOREIGN_WABA }).some((p) => /WHATSAPP_BUSINESS_ACCOUNT_ID does not exactly match/.test(p)));
check("C10.5", "Test WABA ID missing → refused", v({ WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: "" }).some((p) => /WHATSAPP_TEST_BUSINESS_ACCOUNT_ID is required/.test(p)));
check("C10.6", "Near-match (extra digit / whitespace inside) → refused", v({ WHATSAPP_PHONE_NUMBER_ID: `${PNID}0`, WHATSAPP_TEST_PHONE_NUMBER_ID: PNID }).length > 0);
check("C10.7", "Known production app id as META_APP_ID → refused", v({ META_APP_ID: KNOWN_PRODUCTION_APP_ID }).some((p) => /known production identifier/.test(p)));
check("C10.8", "Known production config id → refused", v({ META_CONFIG_ID: KNOWN_PRODUCTION_CONFIG_ID }).some((p) => /known production identifier/.test(p)));
check("C10.9", "Live business number as a recipient → refused", v({ WHATSAPP_TEST_RECIPIENTS: `${TESTER},+${BLOCKED_LIVE_NUMBER}` }).some((p) => /live business number/.test(p)));
check("C10.10", "Non-numeric ids → refused", v({ WHATSAPP_PHONE_NUMBER_ID: "abc", WHATSAPP_TEST_PHONE_NUMBER_ID: "abc" }).some((p) => /numeric/.test(p)));
check("C10.11", "Problems never contain the supplied values", !JSON.stringify(v({ WHATSAPP_PHONE_NUMBER_ID: FOREIGN_PNID, META_APP_ID: KNOWN_PRODUCTION_APP_ID })).includes(FOREIGN_PNID) && !JSON.stringify(v({ WHATSAPP_ACCESS_TOKEN: "" })).includes(TOKEN));
const ambient = { WHATSAPP_ACCESS_TOKEN: "EAAambientShouldBeBlanked0000", WHATSAPP_PHONE_NUMBER_ID: FOREIGN_PNID, WHATSAPP_BUSINESS_ACCOUNT_ID: FOREIGN_WABA, WHATSAPP_TEST_PHONE_NUMBER_ID: FOREIGN_PNID, WHATSAPP_TEST_BUSINESS_ACCOUNT_ID: FOREIGN_WABA, WHATSAPP_TEST_RECIPIENTS: TESTER, WHATSAPP_PRODUCTION_SENDING_APPROVED: "true", WHATSAPP_INTEGRATION_MODE: "coexistence", WHATSAPP_OUTBOUND_ENABLED: "true", META_APP_ID: KNOWN_PRODUCTION_APP_ID };
const iso = isolatedEnv(ambient);
check("C10.12", "Ambient (e.g. .env.local-style) WhatsApp values are blanked, not inherited", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_PHONE_NUMBER_ID", "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_RECIPIENTS", "META_APP_ID"].every((k) => iso.env[k] === ""));
check("C10.13", "Launcher forces direct mode, outbound off, no production sending approval", iso.env.WHATSAPP_INTEGRATION_MODE === "direct" && iso.env.WHATSAPP_OUTBOUND_ENABLED === "false" && iso.env.WHATSAPP_PRODUCTION_SENDING_APPROVED === "false" && iso.env.MARINA_ISOLATED_TEST === "1");
const regNames = new Set(ENV_REGISTRY.map((r) => r.name));
check("C10.14", "All new variables are registered (so the launcher blanks them)", ["WHATSAPP_INTEGRATION_MODE", "WHATSAPP_PRODUCTION_SENDING_APPROVED", "WHATSAPP_TEST_PHONE_NUMBER_ID", "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_RECIPIENTS"].every((n) => regNames.has(n)));
const isoExample = fs.readFileSync(".env.isolated-test.example", "utf8");
check("C10.15", "Isolated template lists the direct test names, all blank", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_PHONE_NUMBER_ID", "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_RECIPIENTS"].every((n) => new RegExp(`^${n}=$`, "m").test(isoExample)));
const isoSrc = fs.readFileSync("scripts/isolated-env.mjs", "utf8");
check("C10.16", "Launcher run mode exits (2) on fatal credential problems before spawning", isoSrc.indexOf("report.fatal.length") > 0 && isoSrc.indexOf("report.fatal.length") < isoSrc.indexOf("spawn(cmd"));
check("C10.17", "Launcher never opens .env.local", !/readFileSync\([^)]*\.env\.local/.test(isoSrc) && !/"\.env\.local"/.test(isoSrc));

// ════════════════════ C5: SIMULATED database (not MongoDB) ════════════════════
section = "C5 retry/duplicate/failure — SIMULATED collection, not MongoDB";
const tick = () => new Promise((r) => setImmediate(r));
class SimCollection {
  constructor(name, uniques = []) {
    this.name = name;
    this.docs = [];
    this.uniques = uniques; // [{ fields: [...], partial?: (doc) => bool }]
    this.down = false;
    this.failOn = null; // (op, filter) => bool  → throws a simulated network error once
  }
  guard(op, filter) {
    if (this.down || (this.failOn && this.failOn(op, filter))) {
      this.failOn = null;
      const e = new Error("simulated: connection refused");
      e.name = "MongoNetworkError";
      throw e;
    }
  }
  static get(o, k) {
    return o[k];
  }
  matches(doc, filter) {
    return Object.entries(filter).every(([k, cond]) => {
      if (k === "$or") return cond.some((f) => this.matches(doc, f));
      const v = k.split(".").reduce((o, part) => (o == null ? undefined : o[part]), doc);
      if (cond === null) return v == null; // MongoDB: { field: null } matches missing or null
      if (cond && typeof cond === "object" && !Array.isArray(cond)) {
        const ops = Object.entries(cond);
        if (ops.length && ops.every(([op]) => op.startsWith("$"))) {
          return ops.every(([op, x]) => {
            if (op === "$lt") return v !== undefined && v !== null && v < x;
            if (op === "$lte") return v !== undefined && v !== null && v <= x;
            if (op === "$gt") return v !== undefined && v !== null && v > x;
            if (op === "$gte") return v !== undefined && v !== null && v >= x;
            if (op === "$eq") return v === x;
            if (op === "$ne") return v !== x;
            if (op === "$type") return typeof v === x;
            if (op === "$in") return x.includes(v);
            throw new Error("SimCollection: unsupported operator " + op);
          });
        }
      }
      return v === cond;
    });
  }
  find(filter, options = {}) {
    const self = this;
    return {
      async toArray() {
        await tick();
        self.guard("find", filter);
        const out = self.docs.filter((d) => self.matches(d, filter)).map((d) => ({ ...d }));
        return options.limit ? out.slice(0, options.limit) : out;
      },
    };
  }
  violates(doc, except) {
    return this.uniques.some((u) => {
      if (u.partial && !u.partial(doc)) return false;
      return this.docs.some((d) => d !== except && (!u.partial || u.partial(d)) && u.fields.every((f) => d[f] === doc[f]));
    });
  }
  dup() {
    const e = new Error("E11000 duplicate key (simulated)");
    e.code = 11000;
    return e;
  }
  async insertOne(doc) {
    await tick();
    this.guard("insertOne", doc);
    const d = { ...doc };
    if (this.violates(d)) throw this.dup();
    this.docs.push(d);
    return { insertedId: this.docs.length };
  }
  async findOne(filter) {
    await tick();
    this.guard("findOne", filter);
    const d = this.docs.find((x) => this.matches(x, filter));
    return d ? { ...d } : null;
  }
  apply(d, update) {
    for (const [k, v] of Object.entries(update.$set || {})) d[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...v } : v;
    for (const [k, n] of Object.entries(update.$inc || {})) d[k] = (d[k] || 0) + n;
  }
  async findOneAndUpdate(filter, update) {
    await tick();
    this.guard("findOneAndUpdate", filter);
    const d = this.docs.find((x) => this.matches(x, filter)); // single-step: atomic like the server
    if (!d) return null;
    this.apply(d, update);
    return { ...d };
  }
  async updateOne(filter, update, options = {}) {
    await tick();
    this.guard("updateOne", filter);
    const d = this.docs.find((x) => this.matches(x, filter));
    if (d) {
      this.apply(d, update);
      return { matchedCount: 1, upsertedCount: 0 };
    }
    if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
    await tick(); // find-then-insert gap: a concurrent upsert can interleave here (as on a real server without an index)
    const eq = Object.fromEntries(Object.entries(filter).filter(([k, v]) => !k.startsWith("$") && (typeof v !== "object" || v === null)));
    const nd = { ...eq, ...(update.$setOnInsert || {}), ...(update.$set || {}) };
    if (this.violates(nd)) throw this.dup();
    this.docs.push(nd);
    return { matchedCount: 0, upsertedCount: 1 };
  }
}
const eventsUnique = [{ fields: ["key"] }];
const messageUniques = [
  { fields: ["wamid", "direction"], partial: (d) => d.direction === "in" && typeof d.wamid === "string" },
  { fields: ["inReplyTo"], partial: (d) => typeof d.inReplyTo === "string" },
];
function world({ withMessageIndexes = true } = {}) {
  const w = {
    events: new SimCollection("wa_webhook_events", eventsUnique),
    messages: new SimCollection("ai_wa_messages", withMessageIndexes ? messageUniques : []),
    clock: Date.UTC(2026, 10, 11, 8, 0, 0),
    sends: [],
    failAfterInbound: false,
    failStatuses: false,
  };
  w.deps = (cache = new Set()) => ({
    claim: (k, m) => claimEvent(w.events, k, m, w.clock),
    complete: (k, t) => completeEvent(w.events, k, t, w.clock),
    fail: (k, t, l) => failEvent(w.events, k, t, l, w.clock),
    // Mirrors lib/whatsapp/inbound.ts draftInbound/deliver (record once → skip if reply reserved → reserve → "send").
    draft: async (plan) => {
      await recordInboundOnce(w.messages, { from: plan.from, sessionId: `wa_${plan.from}`, wamid: plan.messageId, text: plan.text, at: "t" });
      if (w.failAfterInbound) {
        w.failAfterInbound = false;
        const e = new Error("simulated failure after inbound record");
        e.name = "MongoNetworkError";
        throw e;
      }
      if (await w.messages.findOne({ inReplyTo: plan.messageId })) return { sent: false, drafted: false };
      const r = await reserveReply(w.messages, plan.messageId, { direction: "out", to: plan.from, text: "reply", at: "t" });
      if (!r.reserved) return { sent: false, drafted: false };
      w.sends.push(plan.messageId); // simulated send (no network)
      await w.messages.updateOne({ inReplyTo: plan.messageId }, { $set: { status: "sent" } });
      return { sent: true, drafted: false };
    },
    applyStatuses: async (u) => {
      if (w.failStatuses) {
        w.failStatuses = false;
        throw Object.assign(new Error("simulated status write failure"), { name: "MongoNetworkError" });
      }
      return u.length;
    },
    doneCache: { has: (k) => cache.has(k), add: (k) => void cache.add(k) },
  });
  w.inbound = (wamid) => w.messages.docs.filter((d) => d.direction === "in" && d.wamid === wamid).length;
  w.replies = (wamid) => w.messages.docs.filter((d) => d.inReplyTo === wamid).length;
  w.event = (wamid) => w.events.docs.find((d) => d.key === `msg:${wamid}`);
  return w;
}
const delivery = (wamid) => body([{ id: WABA, changes: [msgChange(PNID, wamid)] }]);
const run = (w, wamid, cache) => processWebhookBody(delivery(wamid), w.deps(cache), { direct: true });
const leak = (json) => /Mongo|E11000|stack|at \w+ \(|wamid\.|simulated|connection/i.test(JSON.stringify(json));

{
  const w = world();
  const cache = new Set();
  const r1 = await run(w, "wamid.s1", cache);
  check("C5.1", "First delivery: 200, event done, 1 inbound record, 1 reply", r1.status === 200 && w.event("wamid.s1").status === "done" && w.inbound("wamid.s1") === 1 && w.replies("wamid.s1") === 1 && w.sends.length === 1);
  const r2 = await run(w, "wamid.s1", cache);
  check("C5.2", "Duplicate retry (same process): 200 duplicate, nothing new written or sent", r2.status === 200 && r2.json.duplicates === 1 && w.inbound("wamid.s1") === 1 && w.replies("wamid.s1") === 1 && w.sends.length === 1);
  const r3 = await run(w, "wamid.s1", new Set());
  check("C5.3", "Retry after simulated application restart (empty memory cache): the DATABASE claim answers duplicate", r3.status === 200 && r3.json.duplicates === 1 && w.sends.length === 1 && w.inbound("wamid.s1") === 1);
}
{
  const w = world();
  w.events.down = true;
  w.messages.down = true;
  const r = await run(w, "wamid.s4", new Set());
  check("C5.4", "Database down: HTTP 500, nothing recorded, nothing sent", r.status === 500 && w.events.docs.length === 0 && w.messages.docs.length === 0 && w.sends.length === 0);
  check("C5.5", "500 body is the fixed message only (no error text, stack, driver name or ids)", r.json.error === WEBHOOK_FAILED_MESSAGE && Object.keys(r.json).join() === "ok,error" && !leak(r.json), JSON.stringify(r.json));
  w.events.down = false;
  w.messages.down = false;
  const r2 = await run(w, "wamid.s4", new Set());
  check("C5.6", "Database recovered: Meta's redelivery is processed exactly once", r2.status === 200 && w.event("wamid.s4").status === "done" && w.inbound("wamid.s4") === 1 && w.sends.length === 1);
}
{
  const w = world();
  w.failAfterInbound = true;
  const r = await run(w, "wamid.s7", new Set());
  const ev = w.event("wamid.s7");
  check("C5.7", "Partial failure after the inbound record: 500 and event marked FAILED (not done)", r.status === 500 && ev.status === "failed" && ev.lastError === "processing_failed" && w.inbound("wamid.s7") === 1 && w.replies("wamid.s7") === 0);
  const r2 = await run(w, "wamid.s7", new Set());
  check("C5.8", "Retry of the failed event: re-claimed at once, inbound NOT duplicated, reply sent once", r2.status === 200 && w.event("wamid.s7").status === "done" && w.event("wamid.s7").attempts === 2 && w.inbound("wamid.s7") === 1 && w.replies("wamid.s7") === 1 && w.sends.length === 1);
}
{
  const w = world();
  // Reply sent, then the database goes down before "done" (completion and the failure write both fail).
  w.events.failOn = (op, f) => op === "updateOne" && f.status === "processing";
  const failEv = w.events;
  const origUpdate = failEv.updateOne.bind(failEv);
  let downForFail = true;
  failEv.updateOne = async (f, u, o) => {
    if (downForFail && f.claimToken && !("status" in f)) {
      downForFail = false;
      throw Object.assign(new Error("simulated"), { name: "MongoNetworkError" });
    }
    return origUpdate(f, u, o);
  };
  const r = await run(w, "wamid.s9", new Set());
  check("C5.9", "Failure after the reply was sent: 500, event left 'processing' (not done)", r.status === 500 && w.event("wamid.s9").status === "processing" && w.sends.length === 1);
  const r2 = await run(w, "wamid.s9", new Set());
  check("C5.10", "Immediate redelivery while the claim is fresh: 500 'in progress', nothing re-sent", r2.status === 500 && r2.json.inProgress === 1 && w.sends.length === 1);
  w.clock += CLAIM_LEASE_MS + 1000;
  const r3 = await run(w, "wamid.s9", new Set());
  check("C5.11", "After the lease expires (crash/restart): re-claimed, completed, reply NOT sent again", r3.status === 200 && w.event("wamid.s9").status === "done" && w.sends.length === 1 && w.replies("wamid.s9") === 1 && w.inbound("wamid.s9") === 1);
}
{
  const w = world();
  const [a, b, c] = await Promise.all([run(w, "wamid.c1", new Set()), run(w, "wamid.c1", new Set()), run(w, "wamid.c1", new Set())]);
  const statuses = [a.status, b.status, c.status].sort().join();
  check("C5.12", "Three simultaneous deliveries: one processes (200), others get 500 in-progress or duplicate", statuses.startsWith("200") && [a, b, c].filter((x) => x.claimed.length === 1).length === 1, statuses);
  check("C5.13", "Simultaneous deliveries: exactly 1 inbound record and 1 send", w.inbound("wamid.c1") === 1 && w.sends.length === 1 && w.replies("wamid.c1") === 1);
  const after = await run(w, "wamid.c1", new Set());
  check("C5.14", "Meta's later redelivery of the 500'd copies: duplicate, nothing new", after.status === 200 && after.json.duplicates === 1 && w.sends.length === 1);
}
{
  const w = world();
  const results2 = await Promise.all([recordInboundOnce(w.messages, { wamid: "wamid.r", from: TESTER }), recordInboundOnce(w.messages, { wamid: "wamid.r", from: TESTER })]);
  check("C5.15", "Concurrent inbound upserts WITH the partial unique index: 1 record ('inserted' + 'existing')", w.inbound("wamid.r") === 1 && results2.sort().join() === "existing,inserted", results2.join());
  const w2 = world({ withMessageIndexes: false });
  await Promise.all([recordInboundOnce(w2.messages, { wamid: "wamid.r", from: TESTER }), recordInboundOnce(w2.messages, { wamid: "wamid.r", from: TESTER })]);
  check("C5.16", "Same race WITHOUT the index: 2 records — shows the index (not the upsert alone) is what guarantees it", w2.inbound("wamid.r") === 2, `records=${w2.inbound("wamid.r")}`);
  const res3 = await Promise.all([reserveReply(w.messages, "wamid.r", { to: TESTER }), reserveReply(w.messages, "wamid.r", { to: TESTER })]);
  check("C5.17", "Concurrent reply reservations WITH the index: exactly one wins", res3.filter((x) => x.reserved).length === 1 && w.replies("wamid.r") === 1);
}
{
  const w = world();
  w.events.docs.push({ key: "msg:wamid.legacy", field: "messages", action: "draft", reason: "x", at: "2026-11-01T00:00:00.000Z" });
  const r = await run(w, "wamid.legacy", new Set());
  check("C5.18", "Pre-C5 event document (no status) counts as done: duplicate, not reprocessed", r.status === 200 && r.json.duplicates === 1 && w.sends.length === 0);
}
{
  const w = world();
  w.failStatuses = true;
  const r = await run(w, "wamid.st", new Set());
  check("C5.19", "Status-update write failure also answers 500 and leaves the event failed", r.status === 500 && w.event("wamid.st").status === "failed");
}
{
  const w = world();
  const c1 = await claimEvent(w.events, "k1", { field: "messages", action: "draft", reason: "r" }, w.clock, "tokenA");
  w.clock += CLAIM_LEASE_MS + 1;
  const c2 = await claimEvent(w.events, "k1", { field: "messages", action: "draft", reason: "r" }, w.clock, "tokenB");
  const stale = await completeEvent(w.events, "k1", "tokenA", w.clock);
  const fresh = await completeEvent(w.events, "k1", "tokenB", w.clock);
  check("C5.20", "Completion is fenced by the claim token (stale holder cannot mark done)", c1.state === "claimed" && c2.state === "claimed" && c2.retry && !stale.completed && fresh.completed);
}
{
  const w = world();
  const dbl = body([{ id: WABA, changes: [msgChange(PNID, "wamid.b1"), msgChange(PNID, "wamid.b1")] }]);
  const r = await processWebhookBody(dbl, w.deps(new Set()), { direct: true });
  check("C5.21", "Same message twice inside one delivery: processed once", r.status === 200 && r.json.duplicates === 1 && w.inbound("wamid.b1") === 1 && w.sends.length === 1);
}
{
  const routeTxt = fs.readFileSync("app/api/meta/whatsapp/webhook/route.ts", "utf8");
  check("C5.22", "Route: memory cache only learns keys after the database marks them done (no seen-before-processing Set)", !routeTxt.includes("__marinaWaSeen") && routeTxt.includes("__marinaWaDone") && !routeTxt.includes("recordWebhookKey"));
  const inboundTxt = fs.readFileSync("lib/whatsapp/inbound.ts", "utf8");
  const draftFn = inboundTxt.slice(inboundTxt.indexOf("export async function draftInbound"), inboundTxt.indexOf("export async function applyCoexistenceUpdates"));
  check("C5.23", "draftInbound re-throws (no swallowed database errors) and logs a fixed label only", /throw err;/.test(draftFn) && /console\.error\("\[whatsapp\] inbound failed"\);/.test(draftFn));
}


// ════════════════════ Phase 2 D: zero automatic retries, delivery classification ════════════════════
section = "Phase 2 D — delivery reliability";
{
  const { deliveryStateFromHttp } = await import("../lib/ai/http.ts");
  const D = deliveryStateFromHttp;
  check("D0.1", "Classifier: 2xx with id → sent; 2xx without id → unknown", D({ ok: true, status: 200, reached: true }, true) === "sent" && D({ ok: true, status: 200, reached: true }, false) === "unknown");
  check("D0.2", "Classifier: 4xx → failed; 5xx and 408 → unknown", D({ ok: false, status: 400, reached: true }, false) === "failed" && D({ ok: false, status: 429, reached: true }, false) === "failed" && D({ ok: false, status: 503, reached: true }, false) === "unknown" && D({ ok: false, status: 408, reached: true }, false) === "unknown");
  check("D0.3", "Classifier: reached:false alone is unknown; only pre-transmission codes are failed", D({ ok: false, status: 0, reached: false }, false) === "unknown" && D({ ok: false, status: 0, reached: false, errorCode: "ECONNRESET" }, false) === "unknown" && D({ ok: false, status: 0, reached: false, errorCode: "ECONNREFUSED" }, false) === "failed" && D({ ok: false, status: 0, reached: false, timedOut: true, errorCode: "ECONNREFUSED" }, false) === "unknown");
}
async function sendWith(reply) {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    fetchCalls.push(String(url));
    if (reply === "timeout") throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (reply === "refused") throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    if (reply === "reset") throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    return new Response(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body ?? {}), { status: reply.status, headers: { "content-type": "application/json" } });
  };
  try {
    const res = await withEnvAsync({ ...DIRECT, ...TESTCFG, NODE_ENV: "production" }, () => postMessage(resolveCredentials(null), { to: TESTER, type: "text", text: { body: "x" } }));
    return { res, calls };
  } finally {
    globalThis.fetch = saved;
  }
}
{
  const cases = [
    ["D1", "Timeout → exactly one call, unknown", "timeout", "unknown"],
    ["D2", "HTTP 503 → exactly one call, unknown", { status: 503, body: { error: { message: "down" } } }, "unknown"],
    ["D3", "ECONNREFUSED (before transmission) → one call, failed", "refused", "failed"],
    ["D4", "ECONNRESET (after possible transmission) → one call, unknown", "reset", "unknown"],
    ["D5", "HTTP 400 → one call, failed", { status: 400, body: { error: { message: "bad" } } }, "failed"],
    ["D6", "HTTP 429 → one call, failed (no retry)", { status: 429, body: { error: { message: "rate" } } }, "failed"],
    ["D7", "2xx without a message id → one call, unknown", { status: 200, body: {} }, "unknown"],
    ["D7b", "2xx with a message id → sent", { status: 200, body: { messages: [{ id: "wamid.ok" }] } }, "sent"],
  ];
  for (const [id, name, reply, expected] of cases) {
    const { res, calls } = await sendWith(reply);
    check(id, name, calls === 1 && res.delivery === expected, `calls ${calls}, delivery ${res.delivery}`);
  }
}
{
  const src = fs.readFileSync("lib/whatsapp/cloud.ts", "utf8");
  const post = src.slice(src.indexOf("export async function postMessage"), src.indexOf("export function textPayload"));
  check("D8", "postMessage sends with retries: 0 and retryTimeouts: false", /retries: 0,/.test(post) && /retryTimeouts: false,/.test(post) && !/retries: [1-9]/.test(post));
  const fu = fs.readFileSync("lib/ai/followups.ts", "utf8");
  check("D9", "Follow-up retry is email-only (WhatsApp terminal after one attempt)", /export function shouldRetryFollowUp[\s\S]*?row\.channel === "email" && status === "failed"/.test(fu) && /const retry = shouldRetryFollowUp\(row, result\.status\)/.test(fu));
  check("D10", "Cron selects only pending follow-ups (unknown/failed never re-selected)", /\.find\(\{ status: "pending", dueAt:/.test(fu));
  const inbound = fs.readFileSync("lib/whatsapp/inbound.ts", "utf8");
  const apply = inbound.slice(inbound.indexOf("export async function applyStatusUpdates"));
  check("D11", "Status webhooks match by wamid only (no recipient/time heuristic)", !/recipient/.test(apply.replace(/\/\/.*$/gm, "")) && /\{ wamid: update\.wamid \}/.test(apply));
  check("D12", "deliver() persists via finishOriginal (evidence first, guarded transition)", /await finishOriginal\(messages, events,/.test(inbound) && !/messages\.updateOne\(\{ inReplyTo \}, \{ \$set: fields \}\)/.test(inbound));
}

// ════════════════════ Phase 2 E: recovery lifecycle ════════════════════
section = "Phase 2 E — recovery lifecycle";
{
  const R = await import("../lib/whatsapp/recovery.ts");
  const T0 = Date.UTC(2026, 10, 15, 8, 0, 0);
  const sec = (ms) => Math.floor(ms / 1000);
  const mk = () => {
    const col = new SimCollection("ai_wa_messages", messageUniques);
    const ev = new SimCollection("ai_wa_delivery_events", [{ fields: ["inReplyTo", "token"] }]);
    return { col, ev };
  };
  const seed = async (col, over = {}) => {
    const doc = { inReplyTo: "wamid.in1", direction: "out", to: TESTER, text: "hello", at: new Date(T0).toISOString(), status: "pending", sendToken: "tokOrig", inboundAt: sec(T0) - 60, ...over };
    await col.insertOne(doc);
    return doc;
  };
  const get = async (col, id = "wamid.in1") => col.findOne({ inReplyTo: id });

  {
    const { col } = mk();
    await seed(col);
    const r9 = await R.sweepReservations(col, T0 + 9 * 60_000);
    const r10 = await R.sweepReservations(col, T0 + 10 * 60_000 + 1);
    const d = await get(col);
    check("E1", "pending → stale after 10 min, not at 9", r9.staled === 0 && r10.staled === 1 && d.status === "stale" && typeof d.firstProblemAt === "string");
  }
  {
    const { col } = mk();
    await seed(col, { status: "unknown", firstProblemAt: new Date(T0).toISOString() });
    const early = await R.sweepReservations(col, T0 + 23 * 3_600_000);
    const late = await R.sweepReservations(col, T0 + 24 * 3_600_000 + 1);
    check("E2", "unknown → expired 24 h after firstProblemAt (not before)", early.expired === 0 && late.expired === 1 && (await get(col)).status === "expired");
  }
  {
    const { col } = mk();
    await seed(col, { status: "resend_claimed", firstProblemAt: new Date(T0).toISOString(), resendClaim: { token: "c1", at: "x" } });
    await R.sweepReservations(col, T0 + 48 * 3_600_000);
    check("E3", "Sweep never touches resend_claimed (no automatic release)", (await get(col)).status === "resend_claimed");
  }
  check("E4", "Reply window uses inboundAt only; missing/invalid → closed", R.replyWindowOpen(sec(T0) - 100, T0) && !R.replyWindowOpen(sec(T0) - 86_400, T0) && !R.replyWindowOpen(undefined, T0) && !R.replyWindowOpen("123", T0) && !R.replyWindowOpen(0, T0));
  {
    const { col, ev } = mk();
    await seed(col);
    await R.sweepReservations(col, T0 + 11 * 60_000);
    const out = await R.finishOriginal(col, ev, { inReplyTo: "wamid.in1", sendToken: "tokOrig", result: "sent", wamid: "wamid.late", now: T0 + 12 * 60_000 });
    const d = await get(col);
    check("E5", "Late success after stale → sent_late, evidence recorded", out.outcome === "sent_late" && d.status === "sent_late" && d.wamid === "wamid.late" && ev.docs.length === 1);
  }
  {
    const { col, ev } = mk();
    await seed(col, { status: "expired", firstProblemAt: "2026-11-14T00:00:00.000Z" });
    const out = await R.finishOriginal(col, ev, { inReplyTo: "wamid.in1", sendToken: "tokOrig", result: "sent", wamid: "wamid.late2", now: T0 });
    check("E6", "Late success after expired → evidence only; status stays expired", out.outcome === "evidence_only" && (await get(col)).status === "expired" && ev.docs.length === 1);
  }
  {
    const { col, ev } = mk();
    await seed(col);
    const out = await R.finishOriginal(col, ev, { inReplyTo: "wamid.in1", sendToken: "WRONG", result: "failed", now: T0 });
    check("E7", "A foreign/old send token cannot change status", out.outcome === "evidence_only" && (await get(col)).status === "pending");
  }
  const claimable = async () => {
    const { col, ev } = mk();
    await seed(col, { status: "unknown", firstProblemAt: new Date(T0).toISOString() });
    return { col, ev };
  };
  {
    const { col } = await claimable();
    const [a, b] = await Promise.all([
      R.claimResend(col, { inReplyTo: "wamid.in1", actor: "admin1", workerId: "w1", token: "A", now: T0 + 60_000 }),
      R.claimResend(col, { inReplyTo: "wamid.in1", actor: "admin2", workerId: "w2", token: "B", now: T0 + 60_000 }),
    ]);
    check("E8", "Two concurrent claims: exactly one wins", [a.ok, b.ok].filter(Boolean).length === 1);
    const again = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "admin1", workerId: "w1", now: T0 + 61_000 });
    check("E9", "Double click / second claim while unresolved is refused (claim_open)", !again.ok && again.reason === "claim_open");
  }
  {
    const { col } = mk();
    await seed(col, { status: "expired", firstProblemAt: new Date(T0).toISOString() });
    const r = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", now: T0 + 60_000 });
    check("E10", "Expired record cannot be claimed", !r.ok && r.reason === "not_claimable");
  }
  {
    const { col } = mk();
    await seed(col, { status: "unknown", firstProblemAt: new Date(T0).toISOString(), inboundAt: undefined });
    const r = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", now: T0 + 60_000 });
    check("E11", "Legacy record without inboundAt cannot be claimed", !r.ok && r.reason === "reply_window_closed");
  }
  {
    const { col } = mk();
    await seed(col, { status: "failed", firstProblemAt: new Date(T0).toISOString(), inboundAt: sec(T0) - 86_000 });
    const r = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", now: T0 + 3_600_000 });
    check("E12", "Closed reply window (from inboundAt, not reservation time) refuses the claim", !r.ok && r.reason === "reply_window_closed");
  }
  {
    const { col, ev } = await claimable();
    const c = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", token: "T1", now: T0 + 60_000 });
    const done = await R.completeResend(col, ev, { inReplyTo: "wamid.in1", token: "T1", result: "sent", wamid: "wamid.re", to: TESTER, now: T0 + 61_000 });
    const d = await get(col);
    const resendRecord = col.docs.find((x) => x.resendOf === "wamid.in1");
    check("E13", "Completion by the claiming token → resent (terminal), own outbound record, evidence row", c.ok && done.updated && d.status === "resent" && d.resentAs === "wamid.re" && d.resendClaim == null && Boolean(resendRecord) && ev.docs.some((x) => x.kind === "resend"));
    const again = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", now: T0 + 62_000 });
    check("E14", "A resent record can never be claimed again", !again.ok);
  }
  {
    const { col, ev } = await claimable();
    await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", token: "T1", now: T0 + 60_000 });
    const stale = await R.completeResend(col, ev, { inReplyTo: "wamid.in1", token: "OTHER", result: "sent", wamid: "x", now: T0 + 61_000 });
    check("E15", "Completion with a stale token changes nothing (claim stays open)", !stale.updated && (await get(col)).status === "resend_claimed");
    // abandoned claim → admin reconciliation
    const wrong = await R.reconcileResend(col, { inReplyTo: "wamid.in1", token: "OTHER", outcome: "resend_unknown", actor: "owner", reason: "checked evidence" });
    const ok = await R.reconcileResend(col, { inReplyTo: "wamid.in1", token: "T1", outcome: "resend_unknown", actor: "owner", reason: "no evidence row" });
    const d = await get(col);
    check("E16", "Abandoned claim: only explicit reconciliation with the claim token clears it (audited fields)", !wrong && ok && d.status === "resend_unknown" && d.resendClaim == null && d.reconciledBy === "owner");
    const next = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "owner", workerId: "w2", token: "T2", now: T0 + 120_000 });
    const d2 = await get(col);
    check("E17", "After reconciliation to resend_unknown a new claim is allowed, attempt incremented", next.ok && d2.resendAttempt === 2);
  }
  {
    const { col, ev } = await claimable();
    await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", token: "T1", now: T0 + 60_000 });
    await R.reconcileResend(col, { inReplyTo: "wamid.in1", token: "T1", outcome: "resent", actor: "owner", reason: "delivered per webhook" });
    const r = await R.claimResend(col, { inReplyTo: "wamid.in1", actor: "a", workerId: "w", now: T0 + 70_000 });
    check("E18", "Reconciled to resent is terminal", !r.ok && (await get(col)).status === "resent");
  }
  {
    const { col } = await claimable();
    const list = await R.listRecoverable(col, T0 + 60_000);
    const row = list.rows[0];
    check("E19", "Admin list is masked and contains no message text", row && row.to === "…0001" && !("text" in row) && !JSON.stringify(list).includes("hello") && list.counts.unknown === 1);
  }
  {
    const { ev } = mk();
    await R.recordDeliveryEvent(ev, { inReplyTo: "a", token: "t", kind: "original", result: "sent", at: "x" });
    const second = await R.recordDeliveryEvent(ev, { inReplyTo: "a", token: "t", kind: "original", result: "failed", at: "y" });
    check("E20", "Delivery evidence is append-only (repeat insert ignored, original kept)", second === false && ev.docs.length === 1 && ev.docs[0].result === "sent");
  }
  const routeSrc = fs.readFileSync("app/api/admin/ai/actions/route.ts", "utf8");
  check("E21", "Admin resend: main admin only, same-origin, confirmation + duplicate-risk acknowledgement, audited", /action === "wa_resend" \|\| action === "wa_reconcile_resend"/.test(routeSrc) && /originMatches\(req\.headers\.get\("origin"\), req\.headers\.get\("host"\)\)/.test(routeSrc) && /body\?\.confirm !== true \|\| body\?\.acknowledgeDuplicateRisk !== true/.test(routeSrc) && /warning: DUPLICATE_RISK_WARNING, acknowledged: true/.test(routeSrc));
  check("E22", "Duplicate-risk warning text is exact", R.DUPLICATE_RISK_WARNING === "The original message may already have been delivered to the customer. Resending may result in the customer receiving the same message twice.");
}

// ════════════════════ Phase 2 F: fingerprint protection ════════════════════
section = "Phase 2 F — production identifier fingerprints";
{
  const F = await import("../lib/whatsapp/fingerprints.ts");
  const vectors = [
    ["waba", "100000000000011", "4dd7b00c9733e5501e58908b3e83ef66a29e436cb7898da61217ccd8af8ac78d"],
    ["phone_number_id", "100000000000022", "56f200dd846fc8681e14cf5f3b1a848e5829f9749af7bb6aa5580c0d97ed249f"],
    ["phone_number_id", "000123", "7272291d82e16746a3b51502f8238d99140bf26d98c0f54171349d1102a3c473"],
    ["app_id", "1", "398bc2c72573a75b0d877f368339cda105f1368c69fde5b9ca0ee6fa6444c999"],
    ["config_id", "1760000000000000", "f6f1e38ec30a1a0e1a8f52752e88a82641fd098d57ec6fb85cc8a4956d906805"],
    ["recipient", "919800000000", "18758268f67b0c5564fb196bf94dab2650fa34bdc5a66d004faa00fb4f562de7"],
  ];
  check("F1", "Synthetic vectors from v1.1 §5.6 match", vectors.every(([k, id, h]) => F.fingerprint(k, id) === h));
  check("F2", "Whitespace trimmed; leading zeros preserved", F.fingerprint("phone_number_id", " 000123 ") === vectors[2][2] && F.fingerprint("phone_number_id", "123") !== vectors[2][2]);
  check("F3", "Non-string, empty and non-digit values rejected", F.fingerprint("waba", 123) === null && F.fingerprint("waba", "") === null && F.fingerprint("waba", "12a") === null);
  check("F4", "Domain separation: same digits, different kinds, different hashes", F.fingerprint("waba", "000123") !== F.fingerprint("phone_number_id", "000123"));
  const good = { version: 1, ids: { waba: [vectors[0][2]], phone_number_id: [vectors[1][2]], app_id: [vectors[3][2]], config_id: [] }, recipients: [vectors[5][2]] };
  const bad = [
    ["F5a", "wrong version", { ...good, version: 2 }],
    ["F5b", "bad hash", { ...good, ids: { ...good.ids, waba: ["XYZ"] } }],
    ["F5c", "unknown key", { ...good, extra: 1 }],
    ["F5d", "unknown kind", { ...good, ids: { ...good.ids, other: [] } }],
    ["F5e", "missing list", { ...good, ids: { waba: [], phone_number_id: [], app_id: [] } }],
  ];
  for (const [id, label, cfg] of bad) check(id, `Invalid configuration refused: ${label}`, !F.parseFingerprintConfig(cfg).ok);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wa-fp-f-"));
  check("F6", "Missing file and invalid JSON fail closed", !F.loadFingerprintFile(path.join(tmp, "nope.json")).ok && (fs.writeFileSync(path.join(tmp, "bad.json"), "{not json"), !F.loadFingerprintFile(path.join(tmp, "bad.json")).ok));
  const emptyCfg = F.parseFingerprintConfig({ version: 1, ids: { waba: [], phone_number_id: [], app_id: [], config_id: [] }, recipients: [] });
  const metaEnv = { META_APP_ID: "300000000000011", WHATSAPP_PHONE_NUMBER_ID: FOREIGN_PNID, WHATSAPP_BUSINESS_ACCOUNT_ID: FOREIGN_WABA }; // non-production ids (the "production" list below holds the v1.1 vectors)
  check("F7", "Empty required lists refuse a Meta-related run", !F.checkFingerprints(metaEnv, emptyCfg).ok);
  check("F8", "§5.3 Gemini-only run (no Meta values) passes with a valid file even if lists are empty", F.checkFingerprints({ GEMINI_TEST_API_KEY: "x" }, emptyCfg).ok && !F.checkFingerprints({ GEMINI_TEST_API_KEY: "x" }, { ok: false, reason: "missing" }).ok);
  const goodCfg = F.parseFingerprintConfig(good);
  check("F9", "config_id list required only when META_CONFIG_ID is supplied", F.checkFingerprints(metaEnv, goodCfg).ok && !F.checkFingerprints({ ...metaEnv, META_CONFIG_ID: "1760000000000001" }, goodCfg).ok);
  const hits = ["WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID"].every((n) => !F.checkFingerprints({ ...metaEnv, [n]: "100000000000011" }, goodCfg).ok)
    && ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TEST_PHONE_NUMBER_ID"].every((n) => !F.checkFingerprints({ ...metaEnv, [n]: "100000000000022" }, goodCfg).ok)
    && !F.checkFingerprints({ ...metaEnv, META_APP_ID: "1" }, goodCfg).ok;
  check("F10", "A production identifier is refused for every identifier variable", hits);
  check("F11", "Protected recipient refused; recipients list separate; empty recipients with testers set refused", !F.checkFingerprints({ ...metaEnv, WHATSAPP_TEST_RECIPIENTS: "919800000000" }, goodCfg).ok && F.checkFingerprints({ ...metaEnv, WHATSAPP_TEST_RECIPIENTS: TESTER }, goodCfg).ok && !F.checkFingerprints({ ...metaEnv, WHATSAPP_TEST_RECIPIENTS: TESTER }, F.parseFingerprintConfig({ ...good, recipients: [] })).ok);
  const problems = F.checkFingerprints({ ...metaEnv, META_APP_ID: "1" }, goodCfg).problems.join(" ");
  check("F12", "Problems name variables only (no values or hashes)", !problems.includes("398bc2") && !problems.includes("META_APP_ID=") && problems.includes("META_APP_ID"));
  // runtime: non-production refuses a matching configured id before any fetch; production unaffected
  const before = fetchCalls.length;
  const devCfg = withEnv({ ...DIRECT, WHATSAPP_BUSINESS_ACCOUNT_ID: FAKE_PROD.waba, NODE_ENV: "development" }, () => resolveCredentials(null));
  const prodCfg = withEnv({ ...DIRECT, WHATSAPP_BUSINESS_ACCOUNT_ID: FAKE_PROD.waba, NODE_ENV: "production" }, () => resolveCredentials(null));
  check("F13", "Runtime: outside production a fingerprinted WABA yields no credentials (0 fetch); production unaffected", devCfg.source === "none" && !devCfg.token && prodCfg.source === "env" && fetchCalls.length === before);
  const missingFile = withEnv({ ...DIRECT, NODE_ENV: "development", WHATSAPP_FINGERPRINT_FILE: path.join(tmp, "nope.json") }, () => resolveCredentials(null));
  check("F14", "Runtime: missing fingerprint file outside production → refused (fail closed, no bypass)", missingFile.source === "none");
  const iso = fs.readFileSync("scripts/isolated-env.mjs", "utf8");
  check("F15", "Launcher runs the fingerprint check on every run, fatal on problems, no bypass flag", /checkFingerprints\(supplied, loadFingerprintFile\(fingerprintFile\(base, root\)\)\)/.test(iso) && /fatal\.push\(p\)/.test(iso) && !/SKIP_FINGERPRINT|NO_FINGERPRINT|FINGERPRINT_BYPASS/i.test(iso + fs.readFileSync("lib/whatsapp/fingerprints.ts", "utf8")));
  const committed = F.loadFingerprintFile("config/whatsapp-production-fingerprints.json");
  check("F16", "Committed fingerprint file is structurally valid", committed.ok);
}

// ════════════════════ Phase 2 commerce (static checks; behaviour verified against MongoDB in G4) ════════════════════
section = "Phase 2 commerce — static checks";
{
  const cap = fs.readFileSync("app/api/paypal/capture/route.ts", "utf8");
  const wh = fs.readFileSync("app/api/paypal/webhook/route.ts", "utf8");
  const orders = fs.readFileSync("lib/orders.ts", "utf8");
  check("K1", "Capture and webhook fulfil and email only when markPaidOnce wins", [cap, wh].every((s) => /const won = await markPaidOnce\(order,/.test(s) && /if \(won\) \{\s*await fulfillPaidOrder\(order\);/.test(s) && !/order\.status = "paid";/.test(s)));
  check("K2", "markPaidOnce is one conditional update on status != paid", /updateOne\(\{ id: order\.id, status: \{ \$ne: "paid" \} \}, \{ \$set: \{ status: "paid", \.\.\.fields \} \}\)/.test(orders) && /res\.modifiedCount === 1/.test(orders));
  const listRoute = fs.readFileSync("app/api/orders/route.ts", "utf8");
  check("K3", "Order list requires a session and the session's own email; database-backed", /await auth\(\)/.test(listRoute) && /status: 401/.test(listRoute) && /email !== sessionEmail/.test(listRoute) && /\.collection<OrderRecord>\("orders"\)\s*\.find\(/.test(orders));
  check("K4", "Tracking needs order id + email and reads the database", /export async function trackOrderByEmail[\s\S]*?await getOrderDurable/.test(orders));
  const conf = orders.slice(orders.indexOf("export async function sendOrderConfirmation"));
  check("K5", "Confirmation via SMTP; no body logging; emailSent only after success; no Resend", /sendCustomerMail\(order\.email/.test(conf) && !/console\.info\([^)]*text/.test(conf) && !/api\.resend\.com/.test(conf) && conf.indexOf("order.emailSent = true") > conf.indexOf("await sendCustomerMail"));
  check("K6", "Razorpay routes untouched (excluded from Phase 2)", fs.existsSync("app/api/razorpay/order/route.ts") && fs.existsSync("app/api/razorpay/verify/route.ts"));
}


// ════════════════════ G4 preparation (mocked providers; no network) ════════════════════
section = "G4 preparation — mocked provider operations";
{
  const { pingWhatsAppCloud } = await import("../lib/whatsapp/cloud.ts");
  const saved = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), method: (init?.method || "GET").toUpperCase() });
    fetchCalls.push(String(url));
    const u = String(url);
    const body = u.includes("/message_templates")
      ? { data: [{ name: "followup", status: "APPROVED" }] }
      : u.includes("/subscribed_apps")
        ? { data: [{ id: "app" }] }
        : u.includes(`/${WABA}?`)
          ? { name: "Test WABA", account_review_status: "APPROVED" }
          : { display_phone_number: "15550001111", verified_name: "Test", quality_rating: "GREEN" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const res = await withEnvAsync({ ...DIRECT, ...TESTCFG, META_APP_ID: "300000000000011", META_WEBHOOK_VERIFY_TOKEN: "vt", META_APP_SECRET: SECRET, NODE_ENV: "development", MARINA_ISOLATED_TEST: "1" }, async () => {
      const creds = resolveCredentials(null);
      return { creds, ping: await pingWhatsAppCloud(creds, {}) };
    });
    const paths = seen.map((s) => new URL(s.url).pathname.replace(/^\/v\d+\.\d+/, ""));
    const expected = [`/${PNID}`, `/${WABA}`, `/${WABA}/subscribed_apps`, `/${WABA}/message_templates`];
    check("G4M1", "Meta checks use only the four approved read operations", res.creds.source === "env" && expected.every((p) => paths.includes(p)) && paths.length === 4, paths.join(" "));
    check("G4M2", "Meta checks are all GET; no POST and no /messages", seen.every((s) => s.method === "GET") && !seen.some((s) => s.url.includes("/messages")), seen.map((s) => s.method).join(","));
    check("G4M3", "Mocked responses are reported as checks without sending", res.ping.configured === true && res.ping.checks.some((c) => c.label.startsWith("Access token")), res.ping.checks.map((c) => c.label).join(" | "));
  } finally {
    globalThis.fetch = saved;
  }
  const g4 = fs.readFileSync("reports/evidence/phase2/g4-provider-checks.mjs", "utf8");
  check("G4M4", "Provider check script refuses to run without the isolated launcher and never posts to Meta", /MARINA_ISOLATED_TEST !== "1"/.test(g4) && !/method:\s*"POST"[^\n]*graph\.facebook/.test(g4) && !/\/messages/.test(g4.replace(/\/\/.*$/gm, "")));
}

// ── output ──
let current = "";
const lines = [];
for (const r of results) {
  if (r.section !== current) {
    current = r.section;
    lines.push("", current);
  }
  lines.push(`  ${r.pass ? "PASS" : "FAIL"} ${r.id} ${r.name}${r.pass ? "" : ` — ${r.detail}`}`);
}
const failed = results.filter((r) => !r.pass).length;
lines.push("", `TOTAL ${results.length - failed} passed, ${failed} failed (offline; C5 = simulated collection, not MongoDB; fetch spy calls: ${fetchCalls.length}, all intercepted)`);
console.log(`WhatsApp Direct Cloud API checks ${new Date().toISOString()} — offline, fake identifiers, no network, no database`);
console.log(lines.join("\n"));
process.env.NODE_ENV = ORIGINAL_NODE_ENV;
process.exit(failed ? 1 : 0);
