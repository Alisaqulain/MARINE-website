// WhatsApp isolation tests WITH an admin session, against the isolated server (port 3939).
// Proves that in the isolated test environment the app never falls back to the client's Meta app:
// status exposes no app id, the signup code exchange never calls Meta, and the integrations check
// does not query Meta's app subscriptions. Admin = the development admin (password regenerated 9 Nov,
// read by Next's env loader inside the isolated launcher; never printed).
//   node scripts/isolated-env.mjs -- node reports/evidence/phase2/whatsapp-isolation-tests.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const here = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnvConfig(path.resolve(here, "../../.."), true, { info() {}, error() {} }).combinedEnv;
const base = process.argv[2] || "http://localhost:3939";
if (process.env.MARINA_ISOLATED_TEST !== "1") { console.error("Run inside scripts/isolated-env.mjs"); process.exit(2); }

const results = [];
const check = (id, name, pass, detail) => results.push({ id, name, pass, detail });
const email = (env.ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
const csrfRes = await fetch(`${base}/api/auth/csrf`);
let cookies = (csrfRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
const { csrfToken } = await csrfRes.json();
const login = await fetch(`${base}/api/auth/callback/admin-portal`, {
  method: "POST", redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookies, "x-auth-return-redirect": "1" },
  body: new URLSearchParams({ email, password: env.ADMIN_PASSWORD || "", csrfToken, callbackUrl: `${base}/admin` }),
});
cookies = [cookies, ...(login.headers.getSetCookie?.() || []).map((c) => c.split(";")[0])].filter(Boolean).join("; ");
const session = /authjs\.session-token|next-auth\.session-token/.test(cookies);
check("A0", "Admin session for the isolated server", session, session ? "session cookie issued" : `login HTTP ${login.status}`);

const st = await fetch(`${base}/api/meta/whatsapp/status`, { headers: { cookie: cookies } });
const status = await st.json().catch(() => ({}));
check("WA1", "Status: no Meta app id exposed in isolated mode", st.status === 200 && status.appId === "", `HTTP ${st.status}, appId=${JSON.stringify(status.appId)}, configId=${JSON.stringify(status.configId)}`);
check("WA2", "Status: production signup not allowed, live number untouched", status.signupAllowed === false && status.liveNumberTouched === false, `signupAllowed=${status.signupAllowed}, liveNumberTouched=${status.liveNumberTouched}`);

const ex = await fetch(`${base}/api/meta/whatsapp/signup/exchange`, {
  method: "POST",
  headers: { cookie: cookies, "content-type": "application/json", origin: base, host: new URL(base).host },
  body: JSON.stringify({ code: "isolated-test-fake-code", event: "FINISH", data: { phone_number_id: "000", waba_id: "000" } }),
});
const exBody = await ex.json().catch(() => ({}));
check("WA3", "Signup exchange: Meta is never called in isolated mode", exBody.calledMeta === false && ex.status !== 200, `HTTP ${ex.status}, calledMeta=${exBody.calledMeta}, error=${String(exBody.error || exBody.detail || "").slice(0, 120)}`);

const ai = await fetch(`${base}/api/admin/ai`, { headers: { cookie: cookies } });
const aiText = await ai.text();
const subsCalled = /Could not read the app's webhook subscriptions|has no WhatsApp Business Account webhook subscription/.test(aiText);
check("WA4", "Integrations check: Meta app subscriptions not queried", ai.status === 200 && !subsCalled, `HTTP ${ai.status}; subscription lookup ${subsCalled ? "ATTEMPTED" : "not attempted"}`);

const ts = new Date().toISOString();
const lines = [`WhatsApp isolation tests (admin session) ${ts} against ${base}`, "", ...results.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id} ${r.name}: ${r.detail}`), "", `TOTAL ${results.filter((r) => r.pass).length}/${results.length} pass`];
fs.writeFileSync(path.join(here, `whatsapp-isolation-tests-${ts.slice(0, 16).replace(/[-:]/g, "")}Z.log`), lines.join("\n") + "\n");
console.log(lines.join("\n"));
