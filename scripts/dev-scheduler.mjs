/**
 * Development scheduler: calls the cron endpoints of a LOCAL server on the production cadence
 * (follow-ups every 15 minutes, daily report at 08:00 local time) with the CRON_SECRET bearer.
 * Refuses non-local servers and any database that is not the local test database. Prints no secrets.
 *
 *   node scripts/dev-scheduler.mjs [baseUrl]          run until stopped (Ctrl+C)
 *   node scripts/dev-scheduler.mjs [baseUrl] --once   fire both jobs once and exit
 *
 * Outside production the daily report is only emailed to an explicit OWNER_ALERT_EMAILS test recipient;
 * without one the send is refused (and recorded as a failed run) before any AI request.
 * Production scheduling is separate and needs deployment approval (see the production-readiness checklist).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) || "http://localhost:3919").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Refusing: the development scheduler only calls a local server.");
  process.exit(2);
}
const env = loadEnvConfig(process.cwd(), true, { info() {}, error() {} }).combinedEnv;
if (!/^mongodb:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(env.MONGODB_URI || "")) {
  console.error("Refusing: MONGODB_URI is not the local test database.");
  process.exit(2);
}
if (!env.CRON_SECRET) {
  console.error("CRON_SECRET is not set.");
  process.exit(2);
}

async function fire(name, path) {
  const started = new Date();
  try {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    const body = await res.json().catch(() => ({}));
    console.log(`${started.toISOString()} ${name}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return res.status;
  } catch (err) {
    console.log(`${started.toISOString()} ${name}: request failed (${err instanceof Error ? err.message : err})`);
    return 0;
  }
}

const followups = () => fire("followups", "/api/ai/jobs");
const dailyReport = () => fire("daily_report", "/api/ai/report/daily");

if (args.includes("--once")) {
  await followups();
  await dailyReport();
  process.exit(0);
}

console.log(`Development scheduler → ${base}: follow-ups every 15 min, daily report at 08:00 local. Ctrl+C to stop.`);
await followups();
setInterval(followups, 15 * 60 * 1000);
let lastReportDay = "";
setInterval(() => {
  const now = new Date();
  const day = now.toDateString();
  if (now.getHours() === 8 && now.getMinutes() < 5 && lastReportDay !== day) {
    lastReportDay = day;
    void dailyReport();
  }
}, 60 * 1000);
