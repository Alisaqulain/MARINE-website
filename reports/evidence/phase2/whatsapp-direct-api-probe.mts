// Read-only, in-process probe of the WhatsApp webhook/credential logic for the Direct Cloud API audit.
// Synthetic values only. No network (no function that calls fetch is invoked), no DB, no repo writes.
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();
const co = await import(pathToFileURL(path.join(root, "lib/whatsapp/coexistence.ts")).href);
const cl = await import(pathToFileURL(path.join(root, "lib/whatsapp/cloud.ts")).href);

const results: { id: string; name: string; observed: string; verdict: string }[] = [];
const rec = (id: string, name: string, observed: unknown, verdict: string) => results.push({ id, name, observed: String(observed), verdict });

// Clean env: strip every WhatsApp/Meta variable from this process so nothing real is read.
for (const k of Object.keys(process.env)) if (/^(WHATSAPP_|META_|AUTH_SECRET|MARINA_ISOLATED)/.test(k)) delete process.env[k];

const SECRET = "synthetic-app-secret-0001";
const sign = (raw: string, s = SECRET) => "sha256=" + createHmac("sha256", s).update(raw).digest("hex");
const CONFIGURED_PNID = "100000000000001";
const FOREIGN_PNID = "200000000000002";
const msg = (pnid: string, id: string, from = "919999000001", text = "Hi, price of brass compass?") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "300000000000003", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "15550001111", phone_number_id: pnid }, contacts: [{ wa_id: from, profile: { name: "Synthetic" } }], messages: [{ from, id, timestamp: "1700000000", type: "text", text: { body: text } }] } }] }],
});

// P1 GET handshake
rec("P1", "Handshake: correct token echoes challenge", JSON.stringify(co.verifyHandshake({ mode: "subscribe", token: "vt-synthetic-123456", challenge: "42", expected: "vt-synthetic-123456" })), "PASS if ok:true,challenge:42");
rec("P2", "Handshake: wrong token", co.verifyHandshake({ mode: "subscribe", token: "nope", challenge: "42", expected: "vt-synthetic-123456" }).status, "PASS if 403");
rec("P3", "Handshake: token not configured", co.verifyHandshake({ mode: "subscribe", token: "x", challenge: "42", expected: "" }).status, "PASS if 503");

// P4–P7 signature
const raw = JSON.stringify(msg(CONFIGURED_PNID, "wamid.p4"));
rec("P4", "Signature: valid", co.verifySignature(raw, sign(raw), SECRET).ok, "PASS if true");
rec("P5", "Signature: wrong secret", co.verifySignature(raw, sign(raw, "other"), SECRET).status, "PASS if 401");
rec("P6", "Signature: missing header", co.verifySignature(raw, null, SECRET).status, "PASS if 401");
rec("P7", "Signature: secret unset", co.verifySignature(raw, sign(raw), "").status, "PASS if 503");
const uni = JSON.stringify(msg(CONFIGURED_PNID, "wamid.p8", "919999000001", "नमस्ते ⚓ café"));
rec("P8", "Signature: non-ASCII body signed over UTF-8 string", co.verifySignature(uni, sign(uni), SECRET).ok, "PASS if true (route uses req.text(); see audit note on raw bytes)");

// P9 duplicates (in-memory layer)
const seen = new Set<string>();
const store = { has: (k: string) => seen.has(k), add: (k: string) => void seen.add(k) };
const first = co.planEvents(co.normaliseWebhook(msg(CONFIGURED_PNID, "wamid.dup")), store);
const second = co.planEvents(co.normaliseWebhook(msg(CONFIGURED_PNID, "wamid.dup")), store);
rec("P9", "Duplicate delivery of same wamid", `${first[0].action}/${second[0].reason}`, "PASS if draft/duplicate");

// P10 foreign phone_number_id (GAP check)
const foreign = co.planEvents(co.normaliseWebhook(msg(FOREIGN_PNID, "wamid.foreign")), { has: () => false, add: () => {} });
rec("P10", "Event for a phone_number_id other than the configured one", `action=${foreign[0].action} phoneNumberId=${foreign[0].phoneNumberId}`, "GAP if action=draft: webhook does not filter by configured WABA/phone number ID");

// P11 status updates
const st = cl.statusUpdatesFromWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "wamid.s1", status: "delivered", recipient_id: "919999000001", timestamp: "1700000000" }] } }] }] });
rec("P11", "Status update parsed", JSON.stringify(st[0]), "PASS if wamid.s1 delivered");

// P12 non-WhatsApp object ignored
rec("P12", "Non-WhatsApp object ignored", co.normaliseWebhook({ object: "page", entry: [] }).length, "PASS if 0");

// P13–P16 credentials and send gate with DIRECT env credentials (synthetic)
process.env.WHATSAPP_ACCESS_TOKEN = "EAAsyntheticNotARealToken";
process.env.WHATSAPP_PHONE_NUMBER_ID = CONFIGURED_PNID;
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "300000000000003";
const creds = cl.resolveCredentials(null);
rec("P13", "resolveCredentials with env only (no Embedded Signup state)", `source=${creds.source} pnid=${creds.phoneNumberId === CONFIGURED_PNID} waba=${Boolean(creds.wabaId)}`, "PASS if source=env: direct credentials already supported for reads/sends");
const gateArgs = { to: "919999000001", suppressed: false, template: false, windowOpen: true, consent: false, creds };
process.env.WHATSAPP_OUTBOUND_ENABLED = "true";
rec("P14", "Send gate: direct creds + OUTBOUND only (no coexistence flag)", cl.sendGate(gateArgs).allowed, "COUPLING if false: direct sending still requires WHATSAPP_COEXISTENCE_ENABLED");
process.env.WHATSAPP_COEXISTENCE_ENABLED = "true";
process.env.WHATSAPP_COEXISTENCE_TEST_NUMBER = "919999000099";
rec("P15", "Send gate: test mode, direct creds, businessNumber unknown (no stored displayNumber)", cl.sendGate({ ...gateArgs }).allowed, "COUPLING if false: test-mode sending needs displayNumber that only the coexistence verify step stores");
rec("P16", "Send gate: test mode with businessNumber = test number", cl.sendGate({ ...gateArgs, businessNumber: "919999000099" }).allowed, "Informational (no message sent; gate only)");
rec("P17", "Send gate: recipient is blocked live number", cl.sendGate({ ...gateArgs, businessNumber: "919999000099", to: co.BLOCKED_LIVE_NUMBER }).allowed, "PASS if false");

// P18 isolation fallback
rec("P18", "metaAppIds outside isolated mode falls back to hard-coded client app", JSON.stringify(co.metaAppIds({} as NodeJS.ProcessEnv)), "NOTE: hard-coded production app/config IDs used when META_APP_ID unset");
rec("P19", "metaAppIds in isolated mode", JSON.stringify(co.metaAppIds({ MARINA_ISOLATED_TEST: "1" } as unknown as NodeJS.ProcessEnv)), "PASS if empty ids");

// mask ids in output
const out = results.map((r) => `${r.id}\t${r.name}\n\tobserved: ${r.observed.replace(/EAA[A-Za-z0-9]+/g, "[redacted]")}\n\tcriterion: ${r.verdict}`).join("\n");
console.log(`Direct Cloud API in-process probe ${new Date().toISOString()} — synthetic values, no network, no DB\n\n${out}`);
