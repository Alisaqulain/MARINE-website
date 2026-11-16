// Phase 2 G4: read-only provider checks with DEDICATED TEST credentials only (v1.1 §8, §10 G4).
//   node scripts/isolated-env.mjs -- node reports/evidence/phase2/g4-provider-checks.mjs
// Runs only inside the isolated launcher, which loads credentials solely from .env.isolated-test.local, blanks every
// production value, forces outbound off, and refuses Meta-related runs unless the production fingerprint lists are
// populated. Each provider is checked only when its test credentials are present; otherwise it is reported BLOCKED.
// Operations (all read-only): Gemini models.list/models.get/one-word generateContent on the TEST project;
// GA4 runReport; Search Console searchAnalytics query; Meta GET phone number / WABA / subscribed_apps / message_templates.
// Never: sending a WhatsApp message, placing a call, writing to any provider, or touching a production account.
if (process.env.MARINA_ISOLATED_TEST !== "1") {
  console.error("Run inside scripts/isolated-env.mjs");
  process.exit(2);
}
const has = (...names) => names.every((n) => (process.env[n] || "").trim());
const rows = [];
const add = (provider, status, detail) => rows.push({ provider, status, detail: String(detail).slice(0, 240) });

// Gemini (test project only: the launcher sets GEMINI_API_KEY from GEMINI_TEST_API_KEY after project confirmation)
if (has("GEMINI_API_KEY")) {
  const { pingGemini } = await import("../../../lib/ai/gemini.ts");
  const p = await pingGemini({ force: true });
  add("Gemini (test project)", p.configured && p.auth?.ok ? "PASS" : "FAIL", p.configured ? `${p.auth?.detail} | ${p.models?.map((m) => `${m.model}: ${m.ok ? "ok" : m.detail}`).join("; ")}` : "not configured");
} else add("Gemini (test project)", "BLOCKED — CREDENTIALS", "GEMINI_TEST_API_KEY + GEMINI_TEST_PROJECT_CONFIRMED not supplied");

// Google Analytics 4 and Search Console (dedicated read-only service account)
if (has("GOOGLE_SERVICE_ACCOUNT_JSON", "GA4_PROPERTY_ID")) {
  const { pingGa4 } = await import("../../../lib/google/analytics.ts");
  const p = await pingGa4();
  add("GA4 runReport", p.data ? "PASS" : "FAIL", p.detail);
} else add("GA4 runReport", "BLOCKED — CREDENTIALS", "GOOGLE_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID not supplied");
if (has("GOOGLE_SERVICE_ACCOUNT_JSON", "SEARCH_CONSOLE_SITE_URL")) {
  const { pingSearchConsole } = await import("../../../lib/google/search-console.ts");
  const p = await pingSearchConsole();
  add("Search Console query", p.data ? "PASS" : "FAIL", p.detail);
} else add("Search Console query", "BLOCKED — CREDENTIALS", "GOOGLE_SERVICE_ACCOUNT_JSON + SEARCH_CONSOLE_SITE_URL not supplied");

// Meta test app (GET only; fingerprint protection already enforced by the launcher and by directConfig())
if (has("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "META_APP_ID")) {
  const { pingWhatsAppCloud, resolveCredentials } = await import("../../../lib/whatsapp/cloud.ts");
  const creds = resolveCredentials(null);
  if (creds.source !== "env") add("Meta test app (GET only)", "BLOCKED — FINGERPRINTS", "identifiers refused by fingerprint protection or incomplete");
  else {
    const p = await pingWhatsAppCloud(creds, {});
    const live = p.checks.filter((c) => c.live);
    add("Meta test app (GET only)", live.length && live.every((c) => c.ok) ? "PASS" : "FAIL", live.map((c) => `${c.label}: ${c.ok ? "ok" : c.detail}`).join(" | "));
  }
} else add("Meta test app (GET only)", "BLOCKED — CREDENTIALS", "test WABA, test phone-number id, test token and META_APP_ID not supplied");

// Vapi: offline comparison of a dashboard export (no API key is used)
add("Vapi assistant", "BLOCKED — CREDENTIALS", "dashboard export (keys and customer data removed) not supplied; compared offline when available");

console.log(`G4 provider checks ${new Date().toISOString()} (isolated test credentials only; read-only)\n`);
for (const r of rows) console.log(`${r.status.padEnd(24)} ${r.provider}: ${r.detail}`);
const failed = rows.filter((r) => r.status === "FAIL").length;
console.log(`\nPASS ${rows.filter((r) => r.status === "PASS").length}, FAIL ${failed}, BLOCKED ${rows.filter((r) => r.status.startsWith("BLOCKED")).length}`);
process.exit(failed ? 1 : 0);
