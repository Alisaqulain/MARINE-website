// Browser review of Admin → Marina AI → WhatsApp → Reply recovery, against the ISOLATED server and LOCAL test DB.
//   node scripts/isolated-env.mjs -- node reports/evidence/phase2/ui-review-recovery.mjs http://localhost:3939 9333 <outDir>
// Drives a local headless Chrome over the DevTools protocol (no extension, no external site). Seeds two synthetic
// recovery records (marker uiReview), checks the rendered screen, takes desktop and phone screenshots, cleans up.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dotenv = loadEnvConfig(root, true, { info() {}, error() {} }).combinedEnv;
const [base = "http://localhost:3939", port = "9333", outDir = "reports/evidence/phase2/final"] = process.argv.slice(2);
if (process.env.MARINA_ISOLATED_TEST !== "1") { console.error("Run inside scripts/isolated-env.mjs"); process.exit(2); }
if (!/^http:\/\/(localhost|127\.0\.0\.1):3939$/.test(base)) { console.error("Local isolated server only"); process.exit(2); }
if (!/^mongodb:\/\/[^@]+@(127\.0\.0\.1|localhost):27018\//.test(dotenv.MONGODB_URI || "")) { console.error("Local test DB only"); process.exit(2); }

const results = [];
const check = (id, name, pass, detail = "") => results.push({ id, name, pass: Boolean(pass), detail: String(detail).slice(0, 240) });
const RUN = Date.now().toString(36);
const mongo = new MongoClient(dotenv.MONGODB_URI);
await mongo.connect();
const msgs = mongo.db(dotenv.MONGODB_DB_NAME).collection("ai_wa_messages");
const now = Date.now();
await msgs.insertMany([
  { inReplyTo: `wamid.ui-${RUN}-a`, direction: "out", to: "919999000001", text: `UI synthetic A ${RUN}`, at: new Date(now - 30 * 60_000).toISOString(), status: "unknown", firstProblemAt: new Date(now - 20 * 60_000).toISOString(), reason: "Timed out after 12s", sendToken: "t", inboundAt: Math.floor(now / 1000) - 1800, uiReview: RUN },
  { inReplyTo: `wamid.ui-${RUN}-b`, direction: "out", to: "919999000002", text: `UI synthetic B ${RUN}`, at: new Date(now - 40 * 60_000).toISOString(), status: "resend_claimed", firstProblemAt: new Date(now - 35 * 60_000).toISOString(), resendClaim: { token: "x", actor: "owner@example.com", workerId: "crashed-worker", at: new Date(now - 30 * 60_000).toISOString() }, resendAttempt: 1, sendToken: "t", inboundAt: Math.floor(now / 1000) - 2400, uiReview: RUN },
]);

// admin session via the app's own sign-in
const email = (dotenv.ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
const csrfRes = await fetch(`${base}/api/auth/csrf`);
let jar = (csrfRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]);
const { csrfToken } = await csrfRes.json();
const login = await fetch(`${base}/api/auth/callback/admin-portal`, {
  method: "POST", redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.join("; "), "x-auth-return-redirect": "1" },
  body: new URLSearchParams({ email, password: dotenv.ADMIN_PASSWORD || "", csrfToken, callbackUrl: `${base}/admin` }),
});
jar = [...jar, ...(login.headers.getSetCookie?.() || []).map((c) => c.split(";")[0])];

// DevTools protocol
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((p) => p.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const consoleErrors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push(m.params.exceptionDetails?.text || "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(m.params.args?.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
});
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); fs.writeFileSync(path.join(outDir, file), Buffer.from(r.result.data, "base64")); return file; };
const waitFor = async (expr, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await evaluate(expr)) return true; await sleep(500); } return false; };

try {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  for (const c of jar) { const [name, ...v] = c.split("="); await send("Network.setCookie", { name, value: v.join("="), domain: "localhost", path: "/" }); }
  await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}/admin?tab=ai` });
  const panel = await waitFor(`!!Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "WhatsApp" && b.className.includes("rounded-full"))`, 90000);
  check("U1", "Admin → Marina AI panel loads for the admin session", panel);
  await evaluate(`Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "WhatsApp" && b.className.includes("rounded-full")).click()`);
  const section = await waitFor(`document.body.innerText.includes("Reply recovery")`);
  const text = (await evaluate("document.body.innerText")) || "";
  check("U2", "Reply recovery section renders with both synthetic rows", section && text.includes("…0001") && text.includes("…0002"));
  check("U3", "Recipients masked; message text hidden by default", !text.includes("919999000001") && !text.includes(`UI synthetic A ${RUN}`));
  check("U4", "Duplicate-risk warning and acknowledgement checkbox shown for the eligible row", text.includes("The original message may already have been delivered to the customer.") && (await evaluate(`!!Array.from(document.querySelectorAll("label")).find(l => l.textContent.includes("accept the duplicate risk"))`)));
  check("U5", "Resend button disabled until acknowledged", await evaluate(`(() => { const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === "Resend once"); return !!b && b.disabled; })()`));
  check("U6", "Abandoned claim shown with reconciliation controls and no automatic release", text.includes("Open resend claim") && text.includes("never released automatically") && text.includes("Record outcome"));
  await shot(`ui-recovery-desktop-${RUN}.png`);
  // expand one message (main admin)
  await evaluate(`Array.from(document.querySelectorAll("button")).filter(b => b.textContent.trim() === "Show message")[0].click()`);
  const expanded = await waitFor(`document.body.innerText.includes("UI synthetic A ${RUN}") || document.body.innerText.includes("UI synthetic B ${RUN}")`, 15000);
  check("U7", "Show message reveals text for one row only after an explicit click", expanded);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1500);
  const overflow = await evaluate("document.documentElement.scrollWidth - window.innerWidth");
  check("U8", "Phone width (390 px): no horizontal page overflow", typeof overflow === "number" && overflow <= 1, `overflow ${overflow}px`);
  await shot(`ui-recovery-phone-${RUN}.png`);
  check("U9", "No browser console errors on the screen", consoleErrors.length === 0, consoleErrors.join(" | "));
} finally {
  ws.close();
  const del = await msgs.deleteMany({ uiReview: RUN });
  check("CLEAN", "Synthetic UI records removed", (await msgs.countDocuments({ uiReview: RUN })) === 0, `removed ${del.deletedCount}`);
  await mongo.close();
}
const lines = [`Recovery UI browser review ${new Date().toISOString()} (local headless Chrome, isolated server, local test DB)`, ""];
for (const r of results) lines.push(`${r.pass ? "PASS" : "FAIL"}  ${r.id} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.pass).length;
lines.push("", `TOTAL ${results.length - failed}/${results.length} pass; screenshots: ui-recovery-desktop-${RUN}.png, ui-recovery-phone-${RUN}.png`);
console.log(lines.join("\n"));
process.exit(failed ? 1 : 0);
