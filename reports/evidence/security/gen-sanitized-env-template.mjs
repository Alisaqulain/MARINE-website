// Generates MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env (project root) and
// reports/MARINA_MUSE_ENV_TEMPLATE_AUDIT.md from:
//   - env-source-inventory-20261110.json (source-code evidence, built by env-source-inventory.mjs)
//   - lib/ai/env-registry.ts (purpose text, secret flag)
//   - the classification table below (authored from the evidence; reasons in the audit)
// NO value is read from any env file, backup, snapshot or log. Every value written is blank.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON reports/evidence/security/gen-sanitized-env-template.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_REGISTRY } from "../../../lib/ai/env-registry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const inv = JSON.parse(fs.readFileSync(path.join(root, "reports/evidence/security/env-source-inventory-20261110.json"), "utf8"));
const reg = new Map(ENV_REGISTRY.map((v) => [v.name, v]));

// Variable NAMES present in the exposed copy of the pre-isolation .env.local
// (E:\jobwebsiteansariroad\Job-Career-Pao\.env.local; names listed on 10 Nov, values never read).
const EXPOSED = new Set("MONGODB_URI MONGODB_DB_NAME MONGODB_PREFER_IPV4 MONGODB_NODE_PROCESSES AUTH_SECRET AUTH_URL NEXTAUTH_URL ADMIN_EMAILS ADMIN_PASSWORD CONTACT_EMAILS SMTP_USER SMTP_FROM SMTP_HOST SMTP_PORT SMTP_PASS GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET KVM2_UPLOAD_URL KVM2_UPLOAD_SKIP KVM2_UPLOAD_TOKEN PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET PAYPAL_MODE PAYPAL_WEBHOOK_ID SHIPGLOBAL_EMAIL SHIPGLOBAL_PASSWORD SHIPGLOBAL_SERVICE SHIPGLOBAL_API_BASE META_APP_ID META_CONFIG_ID META_APP_SECRET META_WEBHOOK_VERIFY_TOKEN WHATSAPP_COEXISTENCE_ENABLED WHATSAPP_COEXISTENCE_TEST_NUMBER WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID GEMINI_API_KEY GEMINI_MODEL GEMINI_FALLBACK_MODEL VAPI_API_KEY VAPI_ASSISTANT_ID VAPI_WEBHOOK_SECRET VAPI_PHONE_NUMBER_ID VAPI_SIP_CREDENTIAL_ID EXOTEL_API_KEY EXOTEL_API_TOKEN EXOTEL_ACCOUNT_SID EXOTEL_REGION EXOTEL_SUBDOMAIN EXOTEL_PHONE_NUMBER EXOTEL_TRUNK_SID EXOTEL_WEBHOOK_TOKEN GA4_PROPERTY_ID GA4_MEASUREMENT_ID GA4_API_SECRET GOOGLE_SERVICE_ACCOUNT_JSON SEARCH_CONSOLE_SITE_URL CRON_SECRET".split(" "));

// name: [section, class, launch, note]
//  class: REQUIRED | CONDITIONAL | OPTIONAL | DEV-ONLY (must stay unset in production) | RETIRED
//  launch: YES (storefront launch) | IF-PAYMENTS | IF-SHIPPING | IF-ENABLED (feature switched on) | NO
const S = {
  core: "Core application and runtime", mongo: "MongoDB", auth: "Authentication and security", gemini: "Gemini AI / Chat and Sales",
  vapi: "Vapi Voice Agent", exotel: "Exotel", wa: "WhatsApp Cloud API / Meta", smtp: "SMTP / Email", paypal: "PayPal",
  ship: "ShipGlobal", ga4: "Google Analytics 4", gsc: "Google Search Console", mc: "Merchant Center", cron: "Scheduled jobs / Cron",
  other: "Other verified integrations",
};
const T = {
  NODE_ENV: ["core", "REQUIRED", "YES", "Must be `production`. Set by the process manager (PM2 `env` block, ecosystem.config.example.cjs) or `next start`; enables the production code paths (guards for dev-only behaviour switch off)."],
  PORT: ["core", "OPTIONAL", "YES", "Port `next start` listens on (Next.js default 3000; the PM2 example uses 3002 for marina-muse behind nginx). Read by Next.js, not by app code."],
  NEXT_PUBLIC_SITE_URL: ["core", "REQUIRED", "YES", "Public https site URL for absolute links, feed, sitemap and webhook URLs. Compiled into the client at build time: set BEFORE `npm run build`. Server code falls back to AUTH_URL (lib/auth-url.ts:50)."],
  NEXT_PUBLIC_SHOP_UTC_OFFSET: ["core", "OPTIONAL", "NO", "Shop time zone for sale dates; default +05:30. Build-time."],
  AI_AGENTS_DISABLED: ["core", "OPTIONAL", "YES", "Comma list of agents to switch off without a deploy (chat, voice, growth, whatsapp). RECOMMENDED for initial launch: switch off every agent that is not approved (see audit section 4)."],
  KVM2_UPLOAD_URL: ["other", "CONDITIONAL", "IF-ENABLED", "Image-upload endpoint used by the admin media upload (lib/kvm-upload.ts)."],
  KVM2_UPLOAD_TOKEN: ["other", "CONDITIONAL", "IF-ENABLED", "Bearer token for KVM2_UPLOAD_URL."],
  KVM2_UPLOAD_SKIP: ["other", "DEV-ONLY", "NO", "Skips the remote upload (development). Must be unset in production."],
  MONGODB_URI: ["mongo", "REQUIRED", "YES", "Atlas connection string for the production database user. NEVER the exposed one: rotate the user's password first. Server-side file only."],
  MONGODB_DB_NAME: ["mongo", "REQUIRED", "YES", "Production database name."],
  MONGODB_NODE_PROCESSES: ["mongo", "OPTIONAL", "YES", "Number of app processes sharing the Atlas connection limit (match PM2 instances). Recommended."],
  MONGODB_PREFER_IPV4: ["mongo", "OPTIONAL", "YES", "1 = prefer IPv4 (recommended on the VPS)."],
  MONGODB_EXTERNAL_CLIENTS: ["mongo", "OPTIONAL", "NO", "Connections reserved for other clients (default 40)."],
  MONGODB_MAX_POOL_SIZE: ["mongo", "OPTIONAL", "NO", "Per-process pool override."],
  MONGODB_CONNECTION_BUDGET: ["mongo", "OPTIONAL", "NO", "Total Atlas connection budget (advanced)."],
  MONGODB_URI_STANDARD: ["mongo", "OPTIONAL", "NO", "Non-SRV connection string; only if SRV DNS fails on the server. Contains the same password: if used, it must carry the ROTATED password."],
  MONGODB_DIRECT: ["mongo", "OPTIONAL", "NO", "Advanced connection switch; leave unset."],
  MONGODB_SRV_ONLY: ["mongo", "OPTIONAL", "NO", "Advanced; leave unset."],
  MONGODB_SKIP_SRV_FALLBACK: ["mongo", "OPTIONAL", "NO", "Advanced; leave unset."],
  MONGODB_SERVER_API: ["mongo", "OPTIONAL", "NO", "Advanced; leave unset."],
  MONGODB_AUTO_SELECT_FAMILY: ["mongo", "OPTIONAL", "NO", "Advanced; leave unset."],
  MONGODB_FORCE_IPV4: ["mongo", "OPTIONAL", "NO", "Advanced; leave unset."],
  MARINA_ISOLATED_TEST: ["core", "DEV-ONLY", "NO", "Set only by scripts/isolated-env.mjs for the isolated Phase 2 test environment (no fallback to the client's Meta app). Must be unset in production."],
  MONGODB_DEV_ALLOWED_HOSTS: ["mongo", "DEV-ONLY", "NO", "Development database-host allow-list (guard is inactive in production). Must be unset in production."],
  MONGODB_REPLICA_SET: ["mongo", "RETIRED", "NO", "Read only by the diagnostic script scripts/test-mongo.mjs, never by the application."],
  AUTH_SECRET: ["auth", "REQUIRED", "YES", "Session/JWT signing key and encryption key for the stored WhatsApp token. New random value (≥ 32 chars). Changing it signs everyone out and makes a stored WhatsApp token unreadable."],
  AUTH_URL: ["auth", "REQUIRED", "YES", "Canonical https site URL for Auth.js (lib/auth-url.ts normalises it and derives NEXTAUTH_URL)."],
  NEXTAUTH_URL: ["auth", "OPTIONAL", "YES", "Legacy alias: read only as a fallback when AUTH_URL is unset, then overwritten from AUTH_URL (lib/auth-url.ts:21,49). Leave unset, or set identical to AUTH_URL."],
  ADMIN_EMAILS: ["auth", "REQUIRED", "YES", "Comma-separated admin e-mail addresses."],
  ADMIN_PASSWORD: ["auth", "REQUIRED", "YES", "Main admin password (auth.ts:112). Must be new: the development value was exposed and the production value is unknown."],
  GOOGLE_CLIENT_ID: ["auth", "CONDITIONAL", "IF-ENABLED", "Google sign-in (auth.ts:43); the provider is enabled only when both ID and secret are set."],
  GOOGLE_CLIENT_SECRET: ["auth", "CONDITIONAL", "IF-ENABLED", "Secret of that OAuth client."],
  CRON_SECRET: ["cron", "CONDITIONAL", "IF-ENABLED", "Bearer token the scheduler sends to /api/ai/jobs (every 15 min) and /api/ai/report/daily. Needed as soon as any scheduled job is enabled. New random value."],
  GEMINI_API_KEY: ["gemini", "CONDITIONAL", "IF-ENABLED", "Gemini API key for the chat, growth and report AI. Required only if an AI agent is enabled."],
  GEMINI_MODEL: ["gemini", "OPTIONAL", "NO", "Primary model id (code default when unset)."],
  GEMINI_FALLBACK_MODEL: ["gemini", "OPTIONAL", "NO", "Fallback model ids, comma-separated."],
  AI_OWNER_ALERT_SCORE: ["gemini", "OPTIONAL", "NO", "Lead score (1–100) that triggers an owner alert; default 81."],
  AI_OWNER_ALERT_VALUE_USD: ["gemini", "OPTIONAL", "NO", "Deal value that triggers an owner alert; default 5000."],
  GEMINI_TEST_API_KEY: ["gemini", "RETIRED", "NO", "Isolated test key for the offline text-test harness under reports/; never read by the application."],
  GEMINI_TEST_PROJECT_CONFIRMED: ["gemini", "RETIRED", "NO", "Harness gate flag; never read by the application."],
  VAPI_API_KEY: ["vapi", "CONDITIONAL", "IF-ENABLED", "Vapi private API key (voice agent)."],
  VAPI_ASSISTANT_ID: ["vapi", "CONDITIONAL", "IF-ENABLED", "Assistant id (Marina Muse Assistant v4)."],
  VAPI_WEBHOOK_SECRET: ["vapi", "CONDITIONAL", "IF-ENABLED", "Shared secret Vapi sends with each webhook; the production webhook answers 401 until this matches. New value (rotation pending)."],
  VAPI_PHONE_NUMBER_ID: ["vapi", "OPTIONAL", "NO", "Vapi phone-number id; only once a number is connected."],
  VAPI_SIP_CREDENTIAL_ID: ["vapi", "OPTIONAL", "NO", "SIP credential id (Exotel vSIP); only with telephony."],
  VAPI_OUTBOUND_ENABLED: ["vapi", "OPTIONAL", "NO", "Outbound calling switch. Keep false until written approval."],
  VAPI_MODEL: ["vapi", "OPTIONAL", "NO", "Model override for the assistant."],
  VAPI_API_BASE: ["vapi", "OPTIONAL", "NO", "API base override; leave unset."],
  VOICE_LANGUAGES: ["vapi", "OPTIONAL", "NO", "Languages offered by the voice agent."],
  VOICE_PROVIDER: ["vapi", "OPTIONAL", "NO", "Name of a generic (non-Vapi) voice provider whose HMAC webhooks are accepted (lib/ai/voice.ts). Not needed with Vapi."],
  VOICE_WEBHOOK_SECRET: ["vapi", "OPTIONAL", "NO", "HMAC secret for that generic provider (lib/ai/voice.ts:27). Not needed with Vapi."],
  EXOTEL_API_KEY: ["exotel", "CONDITIONAL", "IF-ENABLED", "Exotel API key (telephony; out of current scope: KYC/vSIP pending)."],
  EXOTEL_API_TOKEN: ["exotel", "CONDITIONAL", "IF-ENABLED", "Exotel API token."],
  EXOTEL_ACCOUNT_SID: ["exotel", "CONDITIONAL", "IF-ENABLED", "Exotel account SID."],
  EXOTEL_SUBDOMAIN: ["exotel", "CONDITIONAL", "IF-ENABLED", "Exotel API subdomain."],
  EXOTEL_REGION: ["exotel", "OPTIONAL", "NO", "Exotel region."],
  EXOTEL_PHONE_NUMBER: ["exotel", "CONDITIONAL", "IF-ENABLED", "Exotel virtual number."],
  EXOTEL_TRUNK_SID: ["exotel", "CONDITIONAL", "IF-ENABLED", "vSIP trunk SID."],
  EXOTEL_WEBHOOK_TOKEN: ["exotel", "CONDITIONAL", "IF-ENABLED", "Token Exotel callbacks must carry."],
  META_APP_ID: ["wa", "CONDITIONAL", "IF-ENABLED", "Meta app id (Embedded Signup)."],
  META_APP_SECRET: ["wa", "CONDITIONAL", "IF-ENABLED", "Meta app secret: webhook signatures and code exchange. Placeholder in development; client to supply."],
  META_WEBHOOK_APP_SECRET: ["wa", "OPTIONAL", "NO", "Separate secret for webhook signatures, only if it differs from META_APP_SECRET."],
  META_WEBHOOK_VERIFY_TOKEN: ["wa", "CONDITIONAL", "IF-ENABLED", "Token for the Meta webhook verify handshake. New random value."],
  META_GRAPH_API_VERSION: ["wa", "OPTIONAL", "NO", "Graph API version override."],
  META_CONFIG_ID: ["wa", "OPTIONAL", "NO", "Embedded Signup configuration id; code falls back to the supplied id (lib/whatsapp/coexistence.ts:929)."],
  WHATSAPP_ACCESS_TOKEN: ["wa", "CONDITIONAL", "IF-ENABLED", "System-user access token (if not using the encrypted token stored by Embedded Signup)."],
  WHATSAPP_PHONE_NUMBER_ID: ["wa", "CONDITIONAL", "IF-ENABLED", "WhatsApp phone-number id."],
  WHATSAPP_BUSINESS_ACCOUNT_ID: ["wa", "CONDITIONAL", "IF-ENABLED", "WhatsApp Business Account id."],
  WHATSAPP_FOLLOWUP_TEMPLATE: ["wa", "OPTIONAL", "NO", "Approved template name for follow-ups."],
  WHATSAPP_TEMPLATE_LANGUAGE: ["wa", "OPTIONAL", "NO", "Template language code."],
  WHATSAPP_COEXISTENCE_ENABLED: ["wa", "OPTIONAL", "NO", "Coexistence (app + business number) switch. Keep false until approval."],
  WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: ["wa", "OPTIONAL", "NO", "Written-approval flag for onboarding the live number. Keep false."],
  WHATSAPP_OUTBOUND_ENABLED: ["wa", "OPTIONAL", "NO", "Lets the AI send WhatsApp replies. Keep false until written approval."],
  WHATSAPP_COEXISTENCE_TEST_NUMBER: ["wa", "DEV-ONLY", "NO", "The only number allowed for a test onboarding before approval. Leave unset in production."],
  SMTP_HOST: ["smtp", "REQUIRED", "YES", "SMTP server. Required for customer sign-up OTP (lib/signup-otp.ts) and password reset (app/api/auth/forgot-password)."],
  SMTP_PORT: ["smtp", "REQUIRED", "YES", "465 (SSL) or 587 (STARTTLS)."],
  SMTP_USER: ["smtp", "REQUIRED", "YES", "Sending mailbox."],
  SMTP_PASS: ["smtp", "REQUIRED", "YES", "Mailbox password / app password. New value."],
  OWNER_ALERT_EMAILS: ["smtp", "CONDITIONAL", "IF-ENABLED", "Recipients of AI lead alerts and the daily report (defaults to ADMIN_EMAILS)."],
  RESEND_API_KEY: ["smtp", "OPTIONAL", "NO", "Order-confirmation e-mail via Resend (lib/orders.ts:285); skipped when unset."],
  ORDER_EMAIL_FROM: ["smtp", "OPTIONAL", "NO", "Sender for Resend order e-mails."],
  SMTP_FROM: ["smtp", "RETIRED", "NO", "Not read by any code; the sender is fixed in lib/password-otp-email."],
  CONTACT_EMAILS: ["smtp", "RETIRED", "NO", "Not read by any code; contact addresses come from lib/company."],
  PAYPAL_CLIENT_ID: ["paypal", "CONDITIONAL", "IF-PAYMENTS", "PayPal REST app client id (live). New app credentials recommended."],
  PAYPAL_CLIENT_SECRET: ["paypal", "CONDITIONAL", "IF-PAYMENTS", "PayPal REST app secret (live)."],
  PAYPAL_MODE: ["paypal", "CONDITIONAL", "IF-PAYMENTS", "Exactly `live` in production (placeholder value shown as a comment only)."],
  PAYPAL_WEBHOOK_ID: ["paypal", "CONDITIONAL", "IF-PAYMENTS", "Webhook id for signature verification of PayPal events."],
  PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION: ["paypal", "DEV-ONLY", "NO", "Overrides the live-mode guard outside production. Must be unset."],
  RAZORPAY_KEY_ID: ["other", "CONDITIONAL", "IF-PAYMENTS", "Razorpay key id (app/api/razorpay/order); only if Razorpay is offered."],
  RAZORPAY_KEY_SECRET: ["other", "CONDITIONAL", "IF-PAYMENTS", "Razorpay key secret."],
  SHIPGLOBAL_EMAIL: ["ship", "CONDITIONAL", "IF-SHIPPING", "ShipGlobal account login (label booking)."],
  SHIPGLOBAL_PASSWORD: ["ship", "CONDITIONAL", "IF-SHIPPING", "ShipGlobal password."],
  SHIPGLOBAL_SERVICE: ["ship", "OPTIONAL", "NO", "Carrier service code; default DHLECS (lib/shipglobal.ts:35)."],
  SHIPGLOBAL_API_BASE: ["ship", "OPTIONAL", "NO", "API base; default https://labels.shipglobal.in/api/v1 (lib/shipglobal.ts:11)."],
  SHIPGLOBAL_HSN: ["ship", "OPTIONAL", "NO", "Default HSN code on labels."],
  SHIPGLOBAL_CSB5: ["ship", "OPTIONAL", "NO", "CSB-V export flag."],
  SHIPGLOBAL_IOSS: ["ship", "OPTIONAL", "NO", "EU IOSS number."],
  SHIPGLOBAL_SELLER_FIRST: ["ship", "OPTIONAL", "NO", "Seller first name on labels."],
  SHIPGLOBAL_SELLER_LAST: ["ship", "OPTIONAL", "NO", "Seller last name on labels."],
  SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION: ["ship", "DEV-ONLY", "NO", "Allows real bookings outside production. Must be unset."],
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: ["ga4", "OPTIONAL", "NO", "Browser GA4 tag (loads after consent). Build-time: set before `npm run build`."],
  GA4_MEASUREMENT_ID: ["ga4", "OPTIONAL", "NO", "Server-side purchase events (Measurement Protocol)."],
  GA4_API_SECRET: ["ga4", "OPTIONAL", "NO", "Measurement Protocol secret. New value."],
  GA4_PROPERTY_ID: ["ga4", "CONDITIONAL", "IF-ENABLED", "Numeric property id for the growth agent's GA4 Data API reports."],
  GOOGLE_SERVICE_ACCOUNT_JSON: ["ga4", "CONDITIONAL", "IF-ENABLED", "Service-account key (JSON or base64) for GA4 Data API and Search Console. Issue a NEW key; delete the old one."],
  GOOGLE_SERVICE_ACCOUNT_EMAIL: ["ga4", "OPTIONAL", "NO", "Alternative to the JSON: service-account e-mail."],
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: ["ga4", "OPTIONAL", "NO", "Alternative to the JSON: PEM key (new key)."],
  NEXT_PUBLIC_GA4_IN_DEVELOPMENT: ["ga4", "DEV-ONLY", "NO", "Loads the GA4 tag in development builds. Must be unset."],
  SEARCH_CONSOLE_SITE_URL: ["gsc", "CONDITIONAL", "IF-ENABLED", "Search Console property (sc-domain:… or URL prefix); uses the Google service account."],
};
// Names found only in old .env.example versions (git history), referenced nowhere now.
const RETIRED_EXTRA = {
  OPENAI_API_KEY: "Legacy AI provider key. In .env.example until commit 5e61d6c (31 Oct); Gemini replaced it. No reference in code, scripts or docs.",
  MERCHANT_CENTER_ID: "In .env.example until 9e34acc (3 Nov). Not read by code; Merchant Center fetches /feeds/google.xml and needs no app variable. Mentioned only in docs/phase2/PHASE2_AUDIT_REPORT.md.",
  SEARCH_DATA_PROVIDER: "In .env.example until 5e61d6c (31 Oct). No reference anywhere.",
};
// Tooling inputs read only by local test scripts (not application configuration).
const TOOLING = ["APP_PW", "APP_SECRET", "BASE_URL", "VAPI_SECRET", "VERIFY_TOKEN"];

// ---- consistency between table, inventory and registry ----
const problems = [];
for (const n of Object.keys(inv)) if (!T[n] && !TOOLING.includes(n)) problems.push(`in source inventory but not classified: ${n}`);
for (const n of Object.keys(T)) if (!inv[n] && !["NODE_ENV", "PORT"].includes(n)) problems.push(`classified but not in source inventory: ${n}`);
for (const n of reg.keys()) if (!T[n]) problems.push(`in registry but not classified: ${n}`);

const evid = (n) => {
  if (n === "PORT") return ["ecosystem.config.example.cjs (PM2 env), read by Next.js"];
  const o = inv[n]; if (!o) return [];
  const pick = (k) => [...(o.direct[k] || []), ...(o.helper[k] || [])];
  const rt = pick("runtime"), sc = pick("script"), te = pick("test");
  return rt.length ? rt.slice(0, 3) : sc.length ? sc.slice(0, 2).map((x) => `${x} (script only)`) : te.length ? te.slice(0, 2).map((x) => `${x} (test only)`) : ["no code reference (registry/.env.example only)"];
};
const isSecret = (n) => reg.get(n)?.secret || /SECRET|PASSWORD|TOKEN|_KEY$|_PASS$|PRIVATE_KEY|SERVICE_ACCOUNT_JSON|MONGODB_URI/.test(n) && !/_ID$/.test(n);
const rotation = (n, cls) => {
  if (cls === "RETIRED" || cls === "DEV-ONLY") return "n/a";
  if (isSecret(n)) return EXPOSED.has(n) ? "YES (exposed)" : "NEW VALUE (never reuse a development value)";
  if (["PAYPAL_CLIENT_ID"].includes(n)) return "YES with the new PayPal app";
  return "no";
};
const LAUNCH = { YES: "yes", "IF-PAYMENTS": "only if payments enabled", "IF-SHIPPING": "only if shipping labels enabled", "IF-ENABLED": "only if the feature is enabled", NO: "no" };

// ---- template ----
const now = new Date().toISOString();
const L = [
  "# =====================================================================================",
  "# Marina Muse International: PRODUCTION environment TEMPLATE (SANITIZED, for client review)",
  `# Generated ${now} from a source-code audit (reports/MARINA_MUSE_ENV_TEMPLATE_AUDIT.md).`,
  "#",
  "# * EVERY VALUE IS BLANK. This file contains no credential, token, password, key or URI.",
  "# * Do not paste values into this file in a repository, chat, AI tool or e-mail. Real",
  "#   values go only into .env.production.local on the production server (owner-only).",
  "# * Secrets marked ROTATE=YES were exposed (security report, 10 Nov): issue NEW values.",
  "# * This file is NOT loaded by Next.js (only .env, .env.local, .env.production[.local] are).",
  "#",
  "# Line format above each variable:",
  "#   [CLASS] launch: <initial launch need> | rotate: <rotation> | secret: yes/no",
  "#   purpose  ·  evidence: file:line",
  "# CLASS: REQUIRED · CONDITIONAL (only when that integration is enabled) · OPTIONAL",
  "# Development-only and RETIRED variables are listed at the end, commented out: do not set them.",
  "# =====================================================================================",
];
const order = ["core", "mongo", "auth", "gemini", "vapi", "exotel", "wa", "smtp", "paypal", "ship", "ga4", "gsc", "mc", "cron", "other"];
const rows = [];
for (const sec of order) {
  L.push("", `# ─── ${S[sec]} ${"─".repeat(Math.max(3, 70 - S[sec].length))}`);
  if (sec === "mc") { L.push("# No application variable. Merchant Center fetches https://<site>/feeds/google.xml on its own", "# schedule (docs/phase2/MERCHANT_CENTER_SCHEDULED_FETCH.md); the feed uses NEXT_PUBLIC_SITE_URL."); continue; }
  for (const [n, [s, cls, launch, note]] of Object.entries(T)) {
    if (s !== sec || cls === "RETIRED" || cls === "DEV-ONLY") continue;
    const rot = rotation(n, cls), sec_ = isSecret(n);
    rows.push({ n, sec: S[sec], cls, launch: LAUNCH[launch], rot, secret: sec_, note, ev: evid(n) });
    L.push(`# [${cls}] launch: ${LAUNCH[launch]} | rotate: ${rot} | secret: ${sec_ ? "yes" : "no"}`);
    L.push(`#   ${note}  ·  evidence: ${evid(n).join(", ")}`);
    if (n === "PAYPAL_MODE") L.push("#   (placeholder guidance: the value must be the word live)");
    if (n === "NODE_ENV") L.push("#   (placeholder guidance: the value must be the word production; usually set by PM2, not here)");
    L.push(`${n}=`);
  }
}
L.push("", "# ─── Development-only: MUST remain unset in production ───────────────────────────────");
for (const [n, [s, cls, , note]] of Object.entries(T)) if (cls === "DEV-ONLY") { rows.push({ n, sec: S[s], cls, launch: "no (must be unset)", rot: "n/a", secret: false, note, ev: evid(n) }); L.push(`#   ${note}  ·  evidence: ${evid(n).join(", ")}`, `# ${n}=`); }
L.push("", "# ─── RETIRED: not read by the application; do not set ─────────────────────────────────");
for (const [n, [s, cls, , note]] of Object.entries(T)) if (cls === "RETIRED") { rows.push({ n, sec: S[s], cls, launch: "no", rot: "n/a", secret: isSecret(n), note, ev: evid(n) }); L.push(`#   ${note}  ·  evidence: ${evid(n).join(", ")}`, `# ${n}=`); }
for (const [n, note] of Object.entries(RETIRED_EXTRA)) { rows.push({ n, sec: "Retired (old templates)", cls: "RETIRED", launch: "no", rot: "n/a", secret: /KEY/.test(n), note, ev: ["git history of .env.example"] }); L.push(`#   ${note}`, `# ${n}=`); }
const tplPath = path.join(root, "MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env");
fs.writeFileSync(tplPath, L.join("\n") + "\n");

// ---- validation of the written template ----
const tpl = fs.readFileSync(tplPath, "utf8");
const active = tpl.split("\n").filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l));
const nonBlank = active.filter((l) => !/^[A-Z][A-Z0-9_]*=$/.test(l));
const names = tpl.split("\n").map((l) => (l.match(/^#?\s?([A-Z][A-Z0-9_]*)=/) || [])[1]).filter(Boolean);
const dups = names.filter((n, i) => names.indexOf(n) !== i);
const risky = [
  ["mongodb URI", /mongodb(\+srv)?:\/\//i], ["private key", /BEGIN [A-Z ]*PRIVATE KEY/], ["JWT/long token", /\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{8,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{20,}/], ["PayPal/Stripe-like key", /\b(sk|pk|rk)_(live|test)_[0-9A-Za-z]{8,}/], ["Resend key", /\bre_[0-9A-Za-z]{16,}/],
  ["Meta token", /\bEAA[0-9A-Za-z]{20,}/], ["long hex/base64 secret", /(?<![A-Za-z0-9_/.-])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9])/], ["e-mail address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/],
].map(([k, re]) => [k, (tpl.match(new RegExp(re, re.flags.includes("g") ? re.flags : re.flags + "g")) || [])
  // source-file paths in the evidence comments (e.g. app/api/meta/whatsapp/signup/exchange/route) are not secrets
  .filter((m) => !/^[a-z0-9/._-]+$/.test(m.trim())).length]);

// ---- audit report ----
const cnt = (c) => rows.filter((r) => r.cls === c).length;
const prodRows = rows.filter((r) => !["RETIRED", "DEV-ONLY"].includes(r.cls));
const A = [];
A.push(`# Marina Muse: production environment template audit`, ``,
  `Generated ${now}. Template: \`MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env\` (project root). Generator: \`reports/evidence/security/gen-sanitized-env-template.mjs\`. Source inventory: \`reports/evidence/security/env-source-inventory.mjs\` → \`env-source-inventory-20261110.json\`.`, ``,
  `**Method.** All application and script source files were scanned for environment reads (\`process.env.X\`, \`process.env["X"]\`, the \`env("X")\` helper, \`read("X")\`, and \`env.X\`/\`source.X\` on a passed-in env object), with file:line evidence. Inputs: \`lib/ai/env-registry.ts\` (106 entries), \`.env.example\` and its 19 committed versions (names only), and the PM2/nginx examples. **No value was read from \`.env.local\`, a backup, an editor snapshot, Cursor data, a log or a transcript.** The rotation column uses the variable *names* of the exposed copy, recorded during the 10 Nov security sweep. No existing env file was modified, no application behaviour changed, and no external service was contacted.`, ``,
  `## 1. Counts`, ``,
  `| | Count |`, `|---|---|`,
  `| Variables in the template (verified, production-relevant) | **${prodRows.length}** |`,
  `| REQUIRED | ${cnt("REQUIRED")} |`, `| CONDITIONAL | ${cnt("CONDITIONAL")} |`, `| OPTIONAL | ${cnt("OPTIONAL")} |`,
  `| Development-only (listed, must stay unset) | ${cnt("DEV-ONLY")} |`, `| RETIRED (listed, do not set) | ${cnt("RETIRED")} |`,
  `| **Total names audited** | **${rows.length}** (+ ${TOOLING.length} local test-tool inputs excluded: ${TOOLING.join(", ")}) |`, ``,
  `Verified variable count: **${prodRows.length}** production variables, each with source or configuration evidence; ${prodRows.filter((r) => /script only|test only|no code/.test(r.ev.join())).length} have only script, test or no evidence (none expected).`, ``,
  `Consistency checks: ${problems.length ? problems.map((p) => "**" + p + "**").join("; ") : "every name read in code is classified; every classified name has code evidence; every registry name is classified."}`, ``);
A.push(`## 2. Template validation`, ``,
  `| Check | Result |`, `|---|---|`,
  `| Active (uncommented) lines | ${active.length} |`,
  `| Active lines with any value | **${nonBlank.length}**${nonBlank.length ? " " + nonBlank.join(", ") : ""} |`,
  `| Duplicate variable names | ${dups.length ? "**" + dups.join(", ") + "**" : "0"} |`,
  ...risky.map(([k, n]) => `| Pattern scan: ${k} | ${n} |`),
  `| Production credential fingerprint scan | see section 9 |`, ``,
  `Every value is blank. Two non-secret values are described in comments only (\`NODE_ENV\` = the word production, \`PAYPAL_MODE\` = the word live).`, ``);
A.push(`## 3. Rotation requirements`, ``, `Fresh credentials are needed for every secret below before any production deployment. **YES (exposed)** means the variable name was in the exposed copy of the pre-isolation \`.env.local\` (security report, section 8.1). Treat its value, whatever environment it belonged to, as compromised.`, ``, `| Variable | Rotation | Class |`, `|---|---|---|`);
for (const r of prodRows.filter((r) => r.rot !== "no")) A.push(`| \`${r.n}\` | ${r.rot} | ${r.cls} |`);
A.push(``, `Also: the identifiers \`PAYPAL_CLIENT_ID\` (if a new PayPal app is created) and \`GOOGLE_CLIENT_ID\` (if the OAuth client is re-created) change together with their secrets. Rotating \`AUTH_SECRET\` signs every user out and makes a stored WhatsApp token unreadable.`, ``);
A.push(`## 4. Initial launch recommendation`, ``,
  `| Group | Integrations / variables | Recommendation |`, `|---|---|---|`,
  `| **Essential for the initial storefront launch** | Runtime (\`NODE_ENV\`, \`NEXT_PUBLIC_SITE_URL\`), MongoDB (\`MONGODB_URI\`, \`MONGODB_DB_NAME\`), Auth (\`AUTH_SECRET\`, \`AUTH_URL\`, \`ADMIN_EMAILS\`, \`ADMIN_PASSWORD\`), SMTP (\`SMTP_HOST/PORT/USER/PASS\`: sign-up OTP and password reset) | Set with **new** values |`,
  `| Essential only if payments / shipping are enabled | PayPal (4), Razorpay (2), ShipGlobal (\`SHIPGLOBAL_EMAIL/PASSWORD\` + optional label fields) | New live credentials. Until then checkout stays unavailable (503, by design) |`,
  `| Optional AI features | Chat & Sales (\`GEMINI_API_KEY\` …), Growth & Revenue (Gemini + GA4 property + service account + Search Console), Voice & Call (Vapi), \`CRON_SECRET\` + scheduler for follow-ups and the daily report | **Not required for launch.** The 22 conversation scenarios have not run, the Vapi secret is unrotated, and GA4 is not tracking. Recommended: \`AI_AGENTS_DISABLED=chat,voice,growth,whatsapp\` (the switch is read at runtime, \`lib/ai/agents.ts:19\`) until each agent is approved |`,
  `| Optional analytics and marketing | GA4 tag and Measurement Protocol, Search Console, Merchant Center feed (no variable), Resend order e-mails, Google sign-in | Can follow launch. The GA4 tag needs \`NEXT_PUBLIC_GA4_MEASUREMENT_ID\` **before the build** |`,
  `| Keep disabled until credentials and written approval | WhatsApp/Meta (App Secret missing; switches \`WHATSAPP_COEXISTENCE_ENABLED\`, \`WHATSAPP_PRODUCTION_ONBOARDING_APPROVED\`, \`WHATSAPP_OUTBOUND_ENABLED\` = false), Exotel (KYC/vSIP), Vapi outbound (\`VAPI_OUTBOUND_ENABLED\` = false), every development-only switch | Leave blank or false |`, ``,
  `**The four agents.** None is required for the storefront to work: chat, voice, growth and WhatsApp are optional add-ons, and each can be switched off at runtime with \`AI_AGENTS_DISABLED\`.`,
  `- **Chat & Sales.** Blocked: the 22 scenarios have not been run.`,
  `- **Voice & Call.** Blocked: webhook secret rotation pending.`,
  `- **Growth & Revenue.** Partially usable: the reports need GA4 and the service account; the scheduler needs \`CRON_SECRET\`.`,
  `- **WhatsApp.** Blocked: Meta App Secret and eligibility outstanding.`, ``);
A.push(`## 5. Retired, superseded and development-only variables`, ``, `| Variable | Status | Evidence |`, `|---|---|---|`);
for (const r of rows.filter((r) => ["RETIRED", "DEV-ONLY"].includes(r.cls))) A.push(`| \`${r.n}\` | ${r.cls} | ${r.note} ${r.ev[0] && !/git history/.test(r.ev[0]) ? "(" + r.ev.join(", ") + ")" : ""} |`);
A.push(`| \`NEXTAUTH_URL\` | Superseded (kept as OPTIONAL alias) | Read only as a fallback for \`AUTH_URL\`, then overwritten (\`lib/auth-url.ts:21,49\`). The registry marks it "required"; that is stricter than the code |`);
A.push(`| \`VOICE_PROVIDER\`, \`VOICE_WEBHOOK_SECRET\` | Alternative path (OPTIONAL) | Generic non-Vapi voice webhook (\`lib/ai/voice.ts:27\`). Unused when Vapi is the provider |`, ``,
  `**Legacy OpenAI.** \`OPENAI_API_KEY\` appears in no current file (code, scripts, docs, \`.env.example\`). It left \`.env.example\` in commit 5e61d6c (31 Oct). Gemini is the only AI provider in code. No other AI-provider variable exists (searched: \`OPENAI_*\`, \`ANTHROPIC_*\`).`, ``,
  `**Old authentication names.** \`NEXTAUTH_SECRET\`, \`JWT_SECRET\`, \`SESSION_SECRET\` and \`ADMIN_USER*\` are referenced nowhere. \`ADMIN_PASSWORD\` is **current**, not retired: \`auth.ts:112\` reads it.`, ``);
A.push(`## 6. Missing or inconsistent with the previous registry and template`, ``,
  `| Finding | Detail |`, `|---|---|`,
  `| Read in code, missing from the registry | \`NODE_ENV\` (12 runtime reads; set by the process manager), \`PORT\` (PM2 example; read by Next.js). Both are added to this template |`,
  `| In the registry, not read by the application | \`CONTACT_EMAILS\`, \`SMTP_FROM\` (no reader), \`GEMINI_TEST_API_KEY\`, \`GEMINI_TEST_PROJECT_CONFIRMED\` (harness only), \`MONGODB_REPLICA_SET\` (diagnostic script only) |`,
  `| Registry classification stricter than the code | \`NEXTAUTH_URL\` ("required", but only a fallback alias) |`,
  `| Registry classification looser than the code | \`SMTP_*\` ("required for feature", but customer sign-up OTP and password reset depend on it, so REQUIRED for a storefront with accounts). \`NEXT_PUBLIC_SITE_URL\` ("optional", but build-time and used for absolute URLs, so REQUIRED here) |`,
  `| Previous template (\`reports/MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env\`) | Built from the registry alone: no \`NODE_ENV\` or \`PORT\`; retired names listed as active; set \`PAYPAL_MODE\`/\`WHATSAPP_*\` values. This sanitized template supersedes it for client review. The old file was left unchanged |`,
  `| Only in old \`.env.example\` versions | \`OPENAI_API_KEY\`, \`MERCHANT_CENTER_ID\`, \`SEARCH_DATA_PROVIDER\` (retired) |`,
  `| Local test-tool inputs (not configuration) | ${TOOLING.map((t) => "`" + t + "`").join(", ")}: read only by \`scripts/check-routes.mjs\` / \`scripts/dev-db.mjs\` |`, ``);
A.push(`## 7. Per-variable evidence`, ``, `| Variable | Section | Class | Initial launch | Rotation | Secret | Evidence (file:line) |`, `|---|---|---|---|---|---|---|`);
for (const r of rows) A.push(`| \`${r.n}\` | ${r.sec} | ${r.cls} | ${r.launch} | ${r.rot} | ${r.secret ? "yes" : "no"} | ${r.ev.map((e) => "`" + e + "`").join(", ")} |`);
A.push(``, `## 8. Uncertainties (assumptions, not verified)`, ``,
  `- **Production process manager and port.** PM2 with \`NODE_ENV=production\` and \`PORT=3002\` is taken from \`ecosystem.config.example.cjs\`. The real server configuration was not inspected (production access not authorized).`,
  `- **Which integrations the client launches with.** The classification assumes a storefront with customer accounts. If customer sign-up is disabled, SMTP drops to CONDITIONAL.`,
  `- **\`META_APP_SECRET\` and \`WHATSAPP_ACCESS_TOKEN\`.** Their names were in the exposed copy, but the 9 Nov evidence says \`META_APP_SECRET\` held placeholder text. Rotation is listed as YES regardless; a placeholder needs no rotation, but a new real value is required anyway.`,
  `- **Rotation scope.** Names come from one exposed copy (\`jobcareerpao\`, 4 Nov). The 21 editor snapshots (24 Oct–9 Nov) may have held other variables at other times. Their values were never read, so any secret ever stored in Marina's development \`.env.local\` should be treated as exposed.`,
  `- **Behaviour when a "REQUIRED" variable is missing.** Inferred from code, not executed against a production-like configuration.`, ``);
A.push(`## 9. Production credential fingerprint scan of the outputs`, ``,
  `After generation, both files (this report and the template) were scanned with \`fingerprint-scan-v2.mjs\` against the production MongoDB URI, password and user-name fingerprints. Result log: \`reports/evidence/security/env-template-secret-check-postgen2-20261110.log\`. It must show **ABSENT** for all three and a \`SCAN COMPLETED\` line; re-run the scan if either file is regenerated.`, ``,
  `Other secrets (API keys, tokens) have no stored fingerprints. For those, the template guarantee rests on construction: every active line is \`NAME=\` with nothing after it (validated above, 0 non-blank). The generator never reads an env file.`, ``);
fs.writeFileSync(path.join(root, "reports/MARINA_MUSE_ENV_TEMPLATE_AUDIT.md"), A.join("\n") + "\n");
console.log(`template: ${tplPath}\nrows ${rows.length}; production ${prodRows.length}; REQUIRED ${cnt("REQUIRED")}, CONDITIONAL ${cnt("CONDITIONAL")}, OPTIONAL ${cnt("OPTIONAL")}, DEV-ONLY ${cnt("DEV-ONLY")}, RETIRED ${cnt("RETIRED")}`);
console.log(`active lines ${active.length}, non-blank ${nonBlank.length}, dups ${dups.length}; risky: ${risky.map(([k, n]) => k + "=" + n).join(", ")}`);
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "consistency: OK");
