/**
 * Cron authentication + job execution against a LOCAL development server on the isolated test database.
 * Sends no email (owner mail is refused outside production without OWNER_ALERT_EMAILS) and contacts no customer
 * (the test database holds no leads or orders). Prints no secrets.
 *
 *   node reports/evidence/growth/dev-cron-check.mjs [baseUrl]
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");

const base = (process.argv[2] || "http://localhost:3919").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Refusing: this check only runs against a local server.");
  process.exit(2);
}
const env = loadEnvConfig(process.cwd(), true, { info() {}, error() {} }).combinedEnv;
if (!/^mongodb:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(env.MONGODB_URI || "")) {
  console.error("Refusing: MONGODB_URI is not the local test database.");
  process.exit(2);
}
if ((env.OWNER_ALERT_EMAILS || "").trim()) {
  console.error("Refusing: OWNER_ALERT_EMAILS is set, so the send test could deliver mail. Unset it to run this check.");
  process.exit(2);
}
const bearer = (s) => ({ authorization: `Bearer ${s}` });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await client.connect();
const db = client.db(env.MONGODB_DB_NAME);
try {
  const leads = await db.collection("ai_leads").countDocuments({});
  const orders = await db.collection("orders").countDocuments({});
  check("Test database has no leads or orders to contact", leads === 0 && orders === 0, `${leads} leads, ${orders} orders`);

  let r = await fetch(`${base}/api/ai/jobs`, { method: "POST" });
  check("Follow-up job: no token refused", r.status === 401, `HTTP ${r.status}`);
  r = await fetch(`${base}/api/ai/jobs`, { method: "POST", headers: bearer("wrong-" + "x".repeat(40)) });
  check("Follow-up job: wrong token refused", r.status === 401, `HTTP ${r.status}`);
  const before = await db.collection("ai_jobs").countDocuments({ name: "followups" });
  r = await fetch(`${base}/api/ai/jobs`, { method: "POST", headers: bearer(env.CRON_SECRET) });
  const body = await r.json().catch(() => ({}));
  const after = await db.collection("ai_jobs").countDocuments({ name: "followups" });
  check("Follow-up job: correct token runs and records the run", r.status === 200 && body.ok === true && after === before + 1, `HTTP ${r.status}; summary ${JSON.stringify({ ...body, ok: undefined })}; ai_jobs followups ${before}→${after}`);

  r = await fetch(`${base}/api/ai/report/daily?dry=1`);
  check("Daily report: no token and no admin session refused", r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  r = await fetch(`${base}/api/ai/report/daily?dry=1`, { headers: bearer("wrong-" + "x".repeat(40)) });
  check("Daily report: wrong token refused", r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  // The dry run builds the AI insights section, which spends Gemini quota on the configured key: opt-in only.
  if (process.argv.includes("--with-ai-preview")) {
    r = await fetch(`${base}/api/ai/report/daily?dry=1`, { headers: bearer(env.CRON_SECRET) });
    const text = await r.text();
    check("Daily report: generated from the test database (dry run, nothing sent)", r.status === 200 && text.length > 100, `HTTP ${r.status}; subject: ${text.split("\n")[0]}`);
    if (r.status === 200) console.log("\n----- report preview -----\n" + text.slice(0, 1500) + "\n----- end preview -----\n");
  } else {
    console.log("SKIP  Daily report dry-run preview (uses Gemini quota; pass --with-ai-preview to include)");
  }

  const auditBefore = await db.collection("ai_audit").countDocuments({ action: "daily_report", delivered: true });
  const usageBefore = await db.collection("ai_usage").countDocuments({});
  r = await fetch(`${base}/api/ai/report/daily`, { headers: bearer(env.CRON_SECRET) });
  const sendBody = await r.json().catch(() => ({}));
  const auditAfter = await db.collection("ai_audit").countDocuments({ action: "daily_report", delivered: true });
  const usageAfter = await db.collection("ai_usage").countDocuments({});
  check(
    "Daily report send refused in development without a test recipient (no email sent)",
    r.status === 503 && /disabled outside production/i.test(sendBody.error || "") && auditAfter === auditBefore,
    `HTTP ${r.status}; ${sendBody.error || ""}`
  );
  check("Refused send made no AI request", usageAfter === usageBefore, `ai_usage ${usageBefore}→${usageAfter}`);
  const lastRun = await db.collection("ai_jobs").find({ name: "daily_report" }).sort({ _id: -1 }).limit(1).next();
  check("Refused send is recorded as a failed scheduler run", lastRun?.ok === false, lastRun ? `ok=${lastRun.ok}` : "no record");
} finally {
  await client.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\nRESULT: ${failed} check(s) FAILED` : `\nRESULT: CRON VERIFIED (${results.length}/${results.length})`);
process.exit(failed ? 1 : 0);
