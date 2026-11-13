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
check("C6.13", "Bypass audit: postMessage callers are inbound.ts and followups.ts only", postCallers.sort().join() === "lib/ai/followups.ts,lib/whatsapp/inbound.ts", postCallers.join(", "));
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
      const v = doc[k];
      if (cond && typeof cond === "object" && !Array.isArray(cond)) {
        if ("$lt" in cond) return v !== undefined && v < cond.$lt;
        if ("$eq" in cond) return v === cond.$eq;
        if ("$type" in cond) return typeof v === cond.$type;
        if ("$in" in cond) return cond.$in.includes(v);
      }
      return v === cond;
    });
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
    Object.assign(d, update.$set || {});
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
