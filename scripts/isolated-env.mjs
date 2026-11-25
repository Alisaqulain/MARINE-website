// Isolated test environment for the approved Phase 2 testing scope.
//
//   node scripts/isolated-env.mjs --check            show what the isolated environment contains (names only)
//   node scripts/isolated-env.mjs -- <command ...>   run a command (e.g. npx next dev -p 3939) inside it
//   import { isolatedEnv } from "./scripts/isolated-env.mjs"   (test harnesses)
//
// Guarantees (no value is ever printed):
//  1. Every integration variable in the env registry is pre-set to "" in the child environment.
//     Next.js (@next/env) never overrides a variable that is already defined, so the exposed values
//     still sitting in .env.local cannot load. This script does not open .env.local.
//  2. Integration credentials come ONLY from .env.isolated-test.local (fresh, client-supplied,
//     git-ignored), and only the names listed in .env.isolated-test.example are accepted.
//  3. Secrets the app needs to run are generated fresh per run (AUTH_SECRET, CRON_SECRET, and
//     synthetic webhook secrets for signature tests); they never existed anywhere else.
//  4. Safety switches are forced: development mode, PayPal sandbox, all outbound/onboarding off,
//     no SMTP (no e-mail can leave), production Gemini key never used.
//  5. Database: inherited from .env.local by Next.js, and the app's own guard refuses any
//     non-local host outside production (lib/env-mongo-uri.ts).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ENV_REGISTRY } = await import(new URL("../lib/ai/env-registry.ts", import.meta.url).href);
const { checkFingerprints, fingerprintFile, loadFingerprintFile } = await import(new URL("../lib/whatsapp/fingerprints.ts", import.meta.url).href);

// Inherited from .env.local (development-only values created on 9 Nov during isolation, or non-secret).
const INHERIT = new Set([
  "MONGODB_URI", "MONGODB_DB_NAME", "MONGODB_PREFER_IPV4", "MONGODB_NODE_PROCESSES", // local test database (127.0.0.1:27018)
  "ADMIN_EMAILS", "ADMIN_PASSWORD", // development admin, password regenerated 9 Nov
  "AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SHOP_UTC_OFFSET",
  "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL", "VOICE_LANGUAGES", "AI_OWNER_ALERT_SCORE", "AI_OWNER_ALERT_VALUE_USD",
]);
const CRED_FILE = path.join(root, ".env.isolated-test.local");
const SESSION_FILE = path.join(root, ".env.isolated-test.session.local"); // git-ignored (.env.isolated-test*)
const ALLOWED = new Set([...fs.readFileSync(path.join(root, ".env.isolated-test.example"), "utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
const rand = (n = 32) => crypto.randomBytes(n).toString("base64url");
const fp = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 10);

// NTFS: the project drive grants Authenticated Users / Users access by inheritance, so a Unix mode
// does nothing. Secret files used by the isolated environment are restricted to the current user + SYSTEM.
import { spawnSync } from "node:child_process";
export function restrictToOwner(file) {
  if (process.platform !== "win32" || !fs.existsSync(file)) return "n/a";
  const who = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
  const r = spawnSync("icacls", [file, "/inheritance:r", "/grant:r", `${who}:(F)`, "SYSTEM:(F)"], { encoding: "utf8" });
  if (r.status !== 0) return "FAILED";
  const check = spawnSync("icacls", [file], { encoding: "utf8" }).stdout || "";
  return /Users|Authenticated Users|Everyone/i.test(check.replace(file, "")) ? "NOT owner-only" : "owner-only";
}

// ── C10: WhatsApp Direct Cloud API test credentials ──
// Known production identifiers (not secrets). Production WABA / phone-number ids are NOT known to this script
// (production env files are never read), so they cannot be listed here; exact test-id matching is the main guard.
const PRODUCTION_IDS = ["1588276335845243", "1760993601871515"];
const LIVE_NUMBER = "917457099540";
const WA_DIRECT = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_TEST_PHONE_NUMBER_ID", "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID"];

/**
 * Pure check of the WhatsApp values supplied in .env.isolated-test.local. Returns fatal problems (names only, never
 * values). No WhatsApp direct value supplied → no problem (direct mode simply stays unconfigured).
 */
export function validateWhatsAppTestCreds(creds) {
  const v = (k) => String(creds[k] ?? "").trim();
  const problems = [];
  const supplied = WA_DIRECT.filter((k) => v(k));
  if (supplied.length) {
    for (const k of WA_DIRECT) if (!v(k)) problems.push(`${k} is required when WhatsApp direct test credentials are supplied`);
    for (const k of WA_DIRECT.slice(1)) if (v(k) && !/^\d{6,20}$/.test(v(k))) problems.push(`${k} must be a numeric Meta id`);
    if (v("WHATSAPP_PHONE_NUMBER_ID") && v("WHATSAPP_PHONE_NUMBER_ID") !== v("WHATSAPP_TEST_PHONE_NUMBER_ID")) problems.push("WHATSAPP_PHONE_NUMBER_ID does not exactly match the approved WHATSAPP_TEST_PHONE_NUMBER_ID");
    if (v("WHATSAPP_BUSINESS_ACCOUNT_ID") && v("WHATSAPP_BUSINESS_ACCOUNT_ID") !== v("WHATSAPP_TEST_BUSINESS_ACCOUNT_ID")) problems.push("WHATSAPP_BUSINESS_ACCOUNT_ID does not exactly match the approved WHATSAPP_TEST_BUSINESS_ACCOUNT_ID");
  }
  for (const k of [...WA_DIRECT.slice(1), "META_APP_ID", "META_CONFIG_ID"]) {
    const id = v(k);
    if (!id) continue;
    if (PRODUCTION_IDS.includes(id)) problems.push(`${k} is a known production identifier; only the separate Meta test app may be used`);
    if (id.includes(LIVE_NUMBER)) problems.push(`${k} contains the live business number`);
  }
  const recipients = v("WHATSAPP_TEST_RECIPIENTS");
  if (recipients) {
    const list = recipients.split(",").map((n) => n.replace(/\D/g, ""));
    if (list.some((n) => !/^\d{8,15}$/.test(n))) problems.push("WHATSAPP_TEST_RECIPIENTS must be comma-separated phone numbers with country code");
    if (list.includes(LIVE_NUMBER)) problems.push("WHATSAPP_TEST_RECIPIENTS contains the live business number");
  }
  return problems;
}

function parse(text) {
  const out = {};
  for (const l of text.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/); if (!m) continue;
    let v = m[2].trim(); if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1); out[m[1]] = v;
  }
  return out;
}

export function isolatedEnv(base = process.env) {
  const env = { ...base };
  const source = {}; // name -> "blank" | "inherited" | "isolated-file" | "generated" | "forced"
  for (const v of ENV_REGISTRY) {
    if (INHERIT.has(v.name)) { source[v.name] = "inherited (.env.local, via Next.js)"; delete env[v.name]; continue; }
    env[v.name] = ""; source[v.name] = "blank";
  }
  // fresh client credentials
  const problems = [];
  const fatal = []; // C10: credential problems stop the launcher (exit 2) instead of being ignored
  let creds = {};
  if (fs.existsSync(CRED_FILE)) {
    creds = parse(fs.readFileSync(CRED_FILE, "utf8"));
    for (const [k, v] of Object.entries(creds)) {
      if (!ALLOWED.has(k)) { problems.push(`${k} is not an isolated-test variable; ignored`); fatal.push(`unexpected credential name ${k}`); continue; }
      if (!v) continue;
      if (/mongodb(\+srv)?:\/\//i.test(v)) { problems.push(`${k} contains a database URI; ignored`); fatal.push(`${k} contains a database URI`); continue; }
      env[k] = v; source[k] = "isolated-file";
    }
    for (const p of validateWhatsAppTestCreds(creds)) { problems.push(p); fatal.push(p); }
  }
  // Phase 2 F (v1.1 §5.3): fingerprint configuration, fail closed on EVERY run. A structurally valid file is always
  // required; Meta-related runs (any Meta/WhatsApp identifier, token or recipient supplied) also need the required
  // production lists populated. No bypass flag. Problems name variables only.
  {
    const supplied = Object.fromEntries(Object.entries(creds).filter(([k]) => ALLOWED.has(k)));
    const decision = checkFingerprints(supplied, loadFingerprintFile(fingerprintFile(base, root)));
    for (const p of decision.problems) { problems.push(p); fatal.push(p); }
  }
  // generated once per test session (never existed before; never printed). Kept in a git-ignored
  // session file so a test server and its test client share the same synthetic secrets; a new
  // session is generated after 24 h or when the file is deleted.
  let gen;
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    if (Date.now() - s.created < 24 * 3600e3) gen = s.values;
  } catch {}
  if (!gen) {
    gen = { AUTH_SECRET: rand(48), CRON_SECRET: rand(32), VAPI_WEBHOOK_SECRET: rand(32), META_WEBHOOK_VERIFY_TOKEN: rand(24), EXOTEL_WEBHOOK_TOKEN: rand(24), META_APP_SECRET_SYNTHETIC: rand(24) };
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ created: Date.now(), values: gen }), { mode: 0o600 });
  }
  gen = { ...gen };
  if (!env.META_APP_SECRET) gen.META_APP_SECRET = gen.META_APP_SECRET_SYNTHETIC; // synthetic: signature tests only, not a Meta app secret
  delete gen.META_APP_SECRET_SYNTHETIC;
  for (const [k, v] of Object.entries(gen)) { env[k] = v; source[k] = k === "META_APP_SECRET" ? "generated (synthetic, signature tests only)" : "generated"; }
  // Gemini: only the dedicated test key, and only after the project is confirmed
  const projectOk = env.GEMINI_TEST_PROJECT_CONFIRMED === "marina-muse-gemini-testing";
  env.GEMINI_API_KEY = projectOk && env.GEMINI_TEST_API_KEY ? env.GEMINI_TEST_API_KEY : "";
  source.GEMINI_API_KEY = env.GEMINI_API_KEY ? "= GEMINI_TEST_API_KEY (isolated file, project confirmed)" : "blank";
  // forced safety switches
  const forced = {
    NODE_ENV: "development", PAYPAL_MODE: "sandbox", VAPI_OUTBOUND_ENABLED: "false", WHATSAPP_OUTBOUND_ENABLED: "false",
    WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "false", WHATSAPP_COEXISTENCE_ENABLED: "false", KVM2_UPLOAD_SKIP: "1",
    PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION: "", SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION: "", MONGODB_DEV_ALLOWED_HOSTS: "",
    OWNER_ALERT_EMAILS: "", NEXT_PUBLIC_GA4_IN_DEVELOPMENT: "", MARINA_ISOLATED_TEST: "1",
    // C10: direct Cloud API mode, no sending and no production sending approval in the isolated environment.
    WHATSAPP_INTEGRATION_MODE: "direct", WHATSAPP_PRODUCTION_SENDING_APPROVED: "false",
  };
  for (const [k, v] of Object.entries(forced)) { env[k] = v; source[k] = `forced (${v === "" ? "empty" : v})`; }
  // Manual-reply testing (Ahmad's approval, 25 Nov 2026): sending may be switched on ONLY here, in the isolated
  // environment, never in production. Production sending approval stays forced "false", so lib/whatsapp/mode.ts still
  // requires the Meta TEST phone-number ID + test WABA ID and a recipient listed in WHATSAPP_TEST_RECIPIENTS.
  if (env.WHATSAPP_TEST_MANUAL_REPLY === "true") {
    env.WHATSAPP_OUTBOUND_ENABLED = "true";
    source.WHATSAPP_OUTBOUND_ENABLED = "forced (true: isolated manual-reply test, test number + test recipients only)";
  }
  const acl = { session: restrictToOwner(SESSION_FILE), credentials: restrictToOwner(CRED_FILE) };
  if (acl.session === "FAILED" || acl.session === "NOT owner-only") problems.push(`session file access could not be restricted (${acl.session})`);
  if (acl.credentials === "FAILED" || acl.credentials === "NOT owner-only") problems.push(`credentials file access could not be restricted (${acl.credentials})`);
  const report = {
    acl,
    credFile: fs.existsSync(CRED_FILE) ? path.basename(CRED_FILE) : "(absent)",
    suppliedNames: Object.keys(creds).filter((k) => ALLOWED.has(k) && creds[k]),
    problems, fatal, source,
    generatedFingerprints: Object.fromEntries(Object.entries(gen).map(([k, v]) => [k, fp(v)])),
  };
  return { env, report };
}

// ---- CLI ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { env, report } = isolatedEnv();
  const sep = process.argv.indexOf("--");
  if (process.argv.includes("--check") || sep < 0) {
    console.log(`Isolated test environment (${new Date().toISOString()}); values never printed`);
    console.log(`credentials file: ${report.credFile}; fresh credentials supplied: ${report.suppliedNames.length ? report.suppliedNames.join(", ") : "none"}`);
    console.log(`file access: session secrets ${report.acl.session}; credentials file ${report.acl.credentials}`);
    for (const p of report.problems) console.log(`PROBLEM: ${p}`);
    const by = {};
    for (const [k, s] of Object.entries(report.source)) (by[s] ||= []).push(k);
    for (const [s, ks] of Object.entries(by)) console.log(`\n[${s}] ${ks.length}\n  ${ks.join(", ")}`);
    process.exit(report.problems.length ? 1 : 0);
  }
  if (report.fatal.length) {
    // C10: never run anything with unexpected, mismatched or production credentials.
    for (const p of report.fatal) console.error(`[isolated-env] REFUSED: ${p}`);
    process.exit(2);
  }
  const [cmd, ...args] = process.argv.slice(sep + 1);
  // Next.js inlines every defined NEXT_PUBLIC_* variable at build time; an empty NEXT_PUBLIC_SITE_URL breaks
  // `next build` (minifier error). Unset empty public variables instead: for the app, unset and empty both mean "not configured".
  for (const k of Object.keys(env)) if (k.startsWith("NEXT_PUBLIC_") && env[k] === "") delete env[k];
  // `next build` does not support NODE_ENV=development (prerendering fails). For build commands only, let
  // Next.js set it; every other forced switch and blanked credential stays in place.
  if (/(^|\s)(next build|npm run (-s )?build)(\s|$)/.test([cmd, ...args].join(" "))) delete env.NODE_ENV;
  console.error(`[isolated-env] running "${[cmd, ...args].join(" ")}" with ${Object.values(report.source).filter((s) => s === "blank").length} integration variables blanked; fresh credentials: ${report.suppliedNames.join(", ") || "none"}`);
  const child = spawn(cmd, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => process.exit(code ?? 1));
}
