import { getDb, pingDatabase } from "@/lib/mongodb";
import { verifyOwnerMail } from "@/lib/mail";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { APPROVED_POLICIES } from "@/lib/ai/answer";
import { AGENTS, agentEnabled, type AgentId } from "@/lib/ai/agents";
import { SCHEDULED_JOBS } from "@/lib/ai/cron";
import { envReport } from "@/lib/ai/env-registry";
import { buildMerchantFeed } from "@/lib/ai/growth";
import { checkCoexistence, runIntegrationChecks, type CoexistenceReport, type IntegrationReport } from "@/lib/ai/integrations";
import {
  agentScore,
  agentStatus,
  isFailing,
  isUp,
  summarise,
  type AgentCheck,
  type AgentStatus,
  type CheckStep,
  type IntegrationStatus,
} from "@/lib/ai/integration-status";
import { runPhase2SelfTest } from "@/lib/ai/selftest";
import { usageSummary, type UsageSummary } from "@/lib/ai/usage";
import { redactSecrets } from "@/lib/ai/http";
import { POST as chatRoute } from "@/app/api/ai/chat/route";
import { POST as voiceRoute } from "@/app/api/ai/voice/webhook/route";
import { GET as whatsappVerifyRoute } from "@/app/api/meta/whatsapp/webhook/route";
import { POST as jobsRoute } from "@/app/api/ai/jobs/route";
import { POST as eventRoute } from "@/app/api/ai/event/route";

/**
 * The /test health dashboard: every integration as a card, the four agents, an overview, and a history of runs
 * (ai_health_runs) for "last success" and "last error". Read-only towards providers; the only writes are the run
 * record and a scratch database document that is deleted immediately. No message is sent and no call is placed.
 */

export type HealthCard = {
  id: string;
  name: string;
  purpose: string;
  status: IntegrationStatus;
  env: { name: string; set: boolean; valid: boolean; required: boolean; problem: string | null }[];
  missing: string[];
  invalid: string[];
  /** true = provider accepted the credentials · false = rejected · null = not checked (missing) */
  authVerified: boolean | null;
  /** true = a safe real API operation succeeded · false = it failed · null = not attempted */
  operationOk: boolean | null;
  error: string | null;
  nextAction: string;
  steps: CheckStep[];
  liveActivity: string;
  troubleshooting: string[];
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
};

export type AgentHealth = {
  id: AgentId;
  name: string;
  purpose: string;
  enabled: boolean;
  status: AgentStatus;
  score: number;
  checks: AgentCheck[];
  missing: string[];
  tests: { passed: number; failed: number; failures: string[] };
  usage: UsageSummary | null;
};

const s = (label: string, result: CheckStep["result"], detail: string, kind: CheckStep["kind"]): CheckStep => ({ label, result, detail, kind });

function stepVerdict(steps: CheckStep[], kind: "credential" | "live") {
  const rows = steps.filter((x) => x.kind === kind && x.result !== "skip");
  if (!rows.length) return null;
  return rows.every((x) => x.result === "pass" || x.result === "warn") ? true : rows.some((x) => x.result === "fail") ? false : null;
}

function nextActionFor(card: Pick<HealthCard, "status" | "missing" | "invalid" | "steps" | "troubleshooting" | "liveActivity">) {
  if (card.invalid.length) return `Fix: ${card.invalid[0]}.`;
  switch (card.status) {
    case "not_configured":
      return card.missing.length ? `Add ${card.missing.join(", ")} (see docs/phase2/ENVIRONMENT_SETUP.md).` : "Configure this integration.";
    case "auth_failed":
      return card.steps.find((x) => x.result === "fail")?.detail || card.troubleshooting[0] || "Check the credentials.";
    case "api_error":
      return card.steps.find((x) => x.result === "fail")?.detail || "Check the provider status and configuration.";
    case "partial":
      return card.missing.length
        ? `Add ${card.missing.join(", ")}.`
        : card.steps.find((x) => x.result === "fail" || x.result === "warn")?.detail || "Finish the remaining setup steps.";
    case "connected":
      return `Connected. ${card.liveActivity || "Waiting for real production activity to mark it Operational."}`;
    default:
      return "None — operational.";
  }
}

function toCard(r: IntegrationReport, envChecks: ReturnType<typeof envReport>): HealthCard {
  const byName = new Map(envChecks.map((e) => [e.name, e]));
  const env = r.env.map((e) => {
    const check = byName.get(e.name);
    return { name: e.name, set: e.set, required: e.required, valid: check ? check.valid || !e.set : e.set, problem: check?.problem ?? null };
  });
  const missing = env.filter((e) => e.required && !e.set).map((e) => e.name);
  const invalid = env.filter((e) => e.set && e.problem).map((e) => e.problem!);
  const firstFail = r.steps.find((x) => x.result === "fail");
  const card: HealthCard = {
    id: r.id,
    name: r.name,
    purpose: r.purpose,
    status: invalid.length && r.status === "not_configured" ? "partial" : r.status,
    env,
    missing,
    invalid,
    authVerified: stepVerdict(r.steps, "credential"),
    operationOk: stepVerdict(r.steps, "live"),
    error: firstFail ? redactSecrets(firstFail.detail).slice(0, 300) : null,
    nextAction: "",
    steps: r.steps,
    liveActivity: r.liveActivity,
    troubleshooting: r.troubleshooting,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
  };
  card.nextAction = nextActionFor(card);
  return card;
}

function platformCard(input: Omit<HealthCard, "nextAction" | "lastSuccessAt" | "lastErrorAt" | "lastError" | "troubleshooting"> & { troubleshooting?: string[] }): HealthCard {
  const card: HealthCard = { ...input, troubleshooting: input.troubleshooting ?? [], nextAction: "", lastSuccessAt: null, lastErrorAt: null, lastError: null };
  card.nextAction = nextActionFor(card);
  return card;
}

function envFor(names: { name: string; required: boolean }[], envChecks: ReturnType<typeof envReport>) {
  const byName = new Map(envChecks.map((e) => [e.name, e]));
  return names.map(({ name, required }) => {
    const c = byName.get(name);
    return { name, required, set: Boolean(c?.set), valid: c ? c.valid || !c.set : false, problem: c?.problem ?? null };
  });
}

async function databaseCard(envChecks: ReturnType<typeof envReport>): Promise<HealthCard> {
  const env = envFor([{ name: "MONGODB_URI", required: true }, { name: "MONGODB_DB_NAME", required: true }], envChecks);
  const steps: CheckStep[] = [];
  const ping = await pingDatabase();
  steps.push(s("Connect and ping", ping.ok ? "pass" : "fail", ping.ok ? "MongoDB accepted the connection." : redactSecrets(ping.message), "credential"));
  let roundTrip = false;
  if (ping.ok) {
    try {
      const db = await getDb();
      const id = `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await db.collection("ai_healthcheck").insertOne({ id, at: new Date().toISOString() });
      roundTrip = Boolean(await db.collection("ai_healthcheck").findOne({ id }));
      await db.collection("ai_healthcheck").deleteOne({ id });
      steps.push(s("Write, read and delete a scratch record", roundTrip ? "pass" : "fail", roundTrip ? "Round trip on an isolated scratch document; deleted immediately." : "The scratch document could not be read back.", "live"));
    } catch (err) {
      steps.push(s("Write, read and delete a scratch record", "fail", err instanceof Error ? redactSecrets(err.message) : "failed", "live"));
    }
  }
  const missing = env.filter((e) => e.required && !e.set).map((e) => e.name);
  const status: IntegrationStatus = !env[0].set ? "not_configured" : !ping.ok ? "api_error" : roundTrip ? "operational" : "api_error";
  return platformCard({
    id: "database",
    name: "Database (MongoDB)",
    purpose: "Shared CRM, conversations, leads, calls, follow-ups, audit — all agents",
    status,
    env,
    missing,
    invalid: env.filter((e) => e.set && e.problem).map((e) => e.problem!),
    authVerified: ping.ok,
    operationOk: ping.ok ? roundTrip : null,
    error: steps.find((x) => x.result === "fail")?.detail ?? null,
    steps,
    liveActivity: "Scratch write/read/delete only; no business data touched.",
  });
}

async function cronCard(envChecks: ReturnType<typeof envReport>, dbOk: boolean): Promise<HealthCard> {
  const env = envFor([{ name: "CRON_SECRET", required: true }], envChecks);
  const steps: CheckStep[] = [s("CRON_SECRET set", env[0].set ? "pass" : "fail", env[0].set ? "Set (not shown). Scheduler requests without it get HTTP 401." : "Missing — the scheduler cannot authenticate.", "config")];
  let ran = 0;
  let failing: string | null = null;
  if (dbOk) {
    const db = await getDb();
    for (const job of SCHEDULED_JOBS) {
      const last = await db.collection("ai_jobs").findOne({ name: job.name }, { sort: { at: -1 } });
      const age = last ? (Date.now() - Date.parse(String(last.at))) / 3_600_000 : null;
      if (last?.ok && age! <= job.maxAgeHours) ran += 1;
      if (last && !last.ok) failing = `${job.name} failed: ${redactSecrets(JSON.stringify(last.summary)).slice(0, 160)}`;
      steps.push(
        s(
          `${job.name} (${job.schedule}) → ${job.path}`,
          last == null ? "warn" : !last.ok ? "fail" : age! > job.maxAgeHours ? "warn" : "pass",
          last == null ? "Never run." : `Last run ${String(last.at).slice(0, 16)} — ${last.ok ? "ok" : "failed"}${age! > job.maxAgeHours ? " (overdue)" : ""}.`,
          "live"
        )
      );
    }
  }
  const status: IntegrationStatus = !env[0].set ? "not_configured" : failing ? "api_error" : ran === SCHEDULED_JOBS.length ? "operational" : "partial";
  return platformCard({
    id: "cron",
    name: "Scheduled jobs (cron)",
    purpose: "Follow-ups every 15 min and the daily owner report",
    status,
    env,
    missing: env[0].set ? [] : ["CRON_SECRET"],
    invalid: env.filter((e) => e.set && e.problem).map((e) => e.problem!),
    authVerified: env[0].set ? true : null,
    operationOk: ran ? true : failing ? false : null,
    error: failing,
    steps,
    liveActivity: ran ? `${ran}/${SCHEDULED_JOBS.length} jobs ran on schedule.` : "No scheduled run recorded yet.",
    troubleshooting: SCHEDULED_JOBS.map((j) => `${j.schedule}: POST ${j.path} with "Authorization: Bearer $CRON_SECRET"`),
  });
}

async function emailCard(envChecks: ReturnType<typeof envReport>, dbOk: boolean): Promise<HealthCard> {
  const env = envFor(
    [
      { name: "SMTP_HOST", required: true },
      { name: "SMTP_PORT", required: true },
      { name: "SMTP_USER", required: true },
      { name: "SMTP_PASS", required: true },
      { name: "OWNER_ALERT_EMAILS", required: false },
    ],
    envChecks
  );
  const mail = await verifyOwnerMail();
  const steps: CheckStep[] = [s("SMTP login (nothing sent)", mail.ok ? "pass" : "fail", redactSecrets(mail.message), "credential")];
  let delivered: { at: string; action: string } | null = null;
  if (dbOk) {
    const db = await getDb();
    const row = await db.collection("ai_audit").findOne({ action: { $in: ["notify_owner", "daily_report", "missed_call_alert"] }, delivered: true }, { sort: { at: -1 } });
    if (row) delivered = { at: String(row.at), action: String(row.action) };
  }
  const missing = env.filter((e) => e.required && !e.set).map((e) => e.name);
  const status: IntegrationStatus = !env.find((e) => e.name === "SMTP_PASS")?.set ? "not_configured" : !mail.ok ? (/login|rejected|auth/i.test(mail.message) ? "auth_failed" : "api_error") : delivered ? "operational" : "connected";
  return platformCard({
    id: "email",
    name: "Email & owner alerts (SMTP)",
    purpose: "Lead alerts, missed-call alerts, daily report, consented follow-ups",
    status,
    env,
    missing,
    invalid: env.filter((e) => e.set && e.problem).map((e) => e.problem!),
    authVerified: env.find((e) => e.name === "SMTP_PASS")?.set ? mail.ok : null,
    operationOk: null,
    error: mail.ok ? null : redactSecrets(mail.message),
    steps,
    liveActivity: delivered ? `Last real owner email: ${delivered.action} at ${delivered.at.slice(0, 16)}.` : "No owner email has been delivered yet.",
  });
}

function coexistenceCard(report: CoexistenceReport, envChecks: ReturnType<typeof envReport>): HealthCard {
  const env = envFor(
    [
      { name: "META_APP_ID", required: true },
      { name: "META_CONFIG_ID", required: true },
      { name: "META_APP_SECRET", required: true },
      { name: "META_WEBHOOK_VERIFY_TOKEN", required: true },
      { name: "WHATSAPP_COEXISTENCE_ENABLED", required: true },
      { name: "WHATSAPP_COEXISTENCE_TEST_NUMBER", required: false },
    ],
    envChecks
  );
  const steps: CheckStep[] = report.rows.map((row) => s(row.label, row.result, row.detail, row.label.startsWith("Coexistence verified") || row.label === "Coexistence events" ? "live" : "config"));
  const anySet = env.some((e) => e.set && e.name !== "META_APP_ID" && e.name !== "META_CONFIG_ID");
  const status: IntegrationStatus = !anySet || report.mode === "not_configured" ? (anySet ? "partial" : "not_configured") : report.connected ? (report.mode === "live" ? "operational" : "connected") : "partial";
  return platformCard({
    id: "coexistence",
    name: "WhatsApp Business app coexistence",
    purpose: "Same number on the WhatsApp Business app and Cloud API (Agent 4)",
    status,
    env,
    missing: env.filter((e) => e.required && !e.set).map((e) => e.name),
    invalid: env.filter((e) => e.set && e.problem).map((e) => e.problem!),
    authVerified: null,
    operationOk: report.connected ? true : null,
    error: steps.find((x) => x.result === "fail")?.detail ?? null,
    steps,
    liveActivity: `Mode: ${report.mode.replace(/_/g, " ")}. ${report.connected ? "Meta confirmed the onboarded number and subscriptions." : "Not active — Meta has not confirmed a coexistence onboarding."}`,
  });
}

async function feedCard(): Promise<HealthCard> {
  const feed = await buildMerchantFeed().catch(() => null);
  const items = feed ? (feed.xml.match(/<item>/g) || []).length : 0;
  const steps: CheckStep[] = [
    s("Feed builds from the live catalogue", feed ? (feed.errors.length ? "warn" : "pass") : "fail", feed ? `${items} items at /feeds/google.xml · ${feed.errors.length} with errors.` : "The feed could not be built.", "live"),
    s("Merchant Center fetch", "warn", "Not verifiable from this site: add https://<site>/feeds/google.xml as a scheduled fetch in Merchant Center. No Merchant API is integrated.", "config"),
  ];
  return platformCard({
    id: "merchant-feed",
    name: "Google Shopping feed",
    purpose: "Product feed for Google Merchant Center (Agent 3)",
    status: feed ? "partial" : "api_error",
    env: [],
    missing: [],
    invalid: [],
    authVerified: null,
    operationOk: Boolean(feed),
    error: feed ? null : "Feed build failed.",
    steps,
    liveActivity: "Generated on request; Merchant Center upload is not part of this build.",
  });
}

async function probe(label: string, run: () => Promise<Response>, expected: number[]) {
  try {
    const res = await run();
    return { ok: expected.includes(res.status), detail: `${label} answered HTTP ${res.status} (expected ${expected.join("/")}).` };
  } catch (err) {
    return { ok: false, detail: `${label} crashed: ${err instanceof Error ? redactSecrets(err.message).slice(0, 120) : "error"}` };
  }
}

const AGENT_TEST_SECTIONS: Record<AgentId, RegExp> = {
  chat: /Agent 1|§4|§6|§1, §7|§7, §20|§21|Shared Gemini/,
  voice: /Agent 2|§10|§12/,
  growth: /Agent 3|§15|§17|§22/,
  whatsapp: /Agent 4/,
};

async function agentHealth(cards: HealthCard[], usage: UsageSummary[]): Promise<AgentHealth[]> {
  const card = (id: string) => cards.find((c) => c.id === id)!;
  const up = (id: string) => isUp(card(id).status);
  const state = (id: string) => `${card(id).name}: ${card(id).status.replace(/_/g, " ")}`;
  const dbOk = up("database");
  const products = await getStorefrontProducts().catch(() => []);
  const kb = { ok: products.length > 0 && Boolean(APPROVED_POLICIES.shipping && APPROVED_POLICIES.returns), detail: `${products.length} products · shipping, returns, discount and manufacturing policies${APPROVED_POLICIES.warranty ? " · warranty" : " (no warranty statement — the AI says it doesn't know)"}.` };
  let crm = { ok: false, detail: "Database unavailable." };
  if (dbOk) {
    try {
      const db = await getDb();
      const [leads, sessions] = await Promise.all([db.collection("ai_leads").countDocuments(), db.collection("ai_sessions").countDocuments()]);
      crm = { ok: true, detail: `${leads} leads · ${sessions} conversations readable.` };
    } catch (err) {
      crm = { ok: false, detail: err instanceof Error ? redactSecrets(err.message) : "CRM read failed" };
    }
  }
  // Route probes: requests the routes must refuse. They exercise the real handlers without writing data.
  const [chatProbe, voiceProbe, waProbe, jobsProbe, eventProbe] = await Promise.all([
    probe("POST /api/ai/chat (invalid session)", () => chatRoute(new Request("http://health.local/api/ai/chat", { method: "POST", body: JSON.stringify({ sessionId: "x", message: "" }), headers: { "x-forwarded-for": "health-check" } })), [400, 503]),
    probe("POST /api/ai/voice/webhook (unsigned)", () => voiceRoute(new Request("http://health.local/api/ai/voice/webhook", { method: "POST", body: "{}", headers: { "x-forwarded-for": "health-check" } })), [401]),
    probe("GET /api/meta/whatsapp/webhook (wrong verify token)", () => whatsappVerifyRoute(new Request("http://health.local/api/meta/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=health-check-wrong&hub.challenge=1")), [403, 503]),
    probe("POST /api/ai/jobs (no bearer)", () => jobsRoute(new Request("http://health.local/api/ai/jobs", { method: "POST" })), [401]),
    probe("POST /api/ai/event (invalid)", () => eventRoute(new Request("http://health.local/api/ai/event", { method: "POST", body: "{}", headers: { "x-forwarded-for": "health-check" } })), [400]),
  ]);
  const tests = runPhase2SelfTest();
  const testsFor = (id: AgentId) => {
    const rows = tests.filter((t) => AGENT_TEST_SECTIONS[id].test(t.section));
    return { passed: rows.filter((t) => t.pass).length, failed: rows.filter((t) => !t.pass).length, failures: rows.filter((t) => !t.pass).map((t) => t.name) };
  };
  const c = (label: string, ok: boolean, level: AgentCheck["level"], detail: string): AgentCheck => ({ label, ok, level, detail });
  const geminiCheck = (level: AgentCheck["level"]) => c("Gemini", up("gemini"), level, state("gemini"));
  const build = (id: AgentId, checks: AgentCheck[]): AgentHealth => {
    const t = testsFor(id);
    checks.push(c("Automated logic tests", t.failed === 0 && t.passed > 0, "critical", `${t.passed} passed · ${t.failed} failed${t.failures.length ? ` (${t.failures.slice(0, 3).join("; ")})` : ""}`));
    const enabled = agentEnabled(id);
    checks.unshift(c("Agent enabled", enabled, "info", enabled ? "On." : "Switched off with AI_AGENTS_DISABLED."));
    return {
      id,
      name: AGENTS[id].name,
      purpose: AGENTS[id].purpose,
      enabled,
      status: agentStatus(enabled, checks),
      score: agentScore(checks),
      checks,
      missing: [...new Set(checks.filter((x) => !x.ok && x.level !== "info").map((x) => x.label))],
      tests: t,
      usage: usage.find((u) => u.agent === id) ?? null,
    };
  };
  return [
    build("chat", [
      c("Database", dbOk, "critical", state("database")),
      c("Knowledge base (catalogue + policies)", kb.ok, "critical", kb.detail),
      c("CRM", crm.ok, "critical", crm.detail),
      c("Chat API route", chatProbe.ok, "critical", chatProbe.detail),
      geminiCheck("required"),
      c("Owner alert email", up("email"), "required", state("email")),
      c("Follow-up job (cron)", up("cron"), "required", state("cron")),
    ]),
    build("voice", [
      c("Database", dbOk, "critical", state("database")),
      c("Voice webhook route", voiceProbe.ok, "critical", voiceProbe.detail),
      c("Vapi", up("vapi"), "critical", state("vapi")),
      c("Exotel telephony", up("exotel"), "critical", state("exotel")),
      c("Knowledge base (lookup_product tool)", kb.ok, "critical", kb.detail),
      c("CRM", crm.ok, "critical", crm.detail),
      geminiCheck("required"),
      c("Owner alert email", up("email"), "required", state("email")),
    ]),
    build("growth", [
      c("Database", dbOk, "critical", state("database")),
      c("Journey event route", eventProbe.ok, "critical", eventProbe.detail),
      geminiCheck("required"),
      c("Google Analytics 4", up("ga4"), "required", state("ga4")),
      c("Search Console", up("search-console"), "required", state("search-console")),
      c("Daily report job (cron)", up("cron") && jobsProbe.ok, "required", `${state("cron")} · ${jobsProbe.detail}`),
      c("Owner report email", up("email"), "required", state("email")),
      c("Shopping feed", card("merchant-feed").operationOk === true, "info", card("merchant-feed").steps[0].detail),
    ]),
    build("whatsapp", [
      c("Database", dbOk, "critical", state("database")),
      c("WhatsApp webhook route", waProbe.ok, "critical", waProbe.detail),
      c("WhatsApp Cloud API", up("whatsapp"), "critical", state("whatsapp")),
      c("Knowledge base", kb.ok, "critical", kb.detail),
      c("CRM", crm.ok, "critical", crm.detail),
      geminiCheck("required"),
      c("Business app coexistence", up("coexistence"), "required", state("coexistence")),
      c("Follow-up job (cron)", up("cron"), "required", state("cron")),
    ]),
  ];
}

type RunRecord = { at: string; cards: { id: string; status: IntegrationStatus; error: string | null }[]; failed: number };

async function recordRun(cards: HealthCard[], dbOk: boolean) {
  if (!dbOk) return { history: [] as RunRecord[] };
  try {
    const db = await getDb();
    const at = new Date().toISOString();
    const record: RunRecord = { at, cards: cards.map((c) => ({ id: c.id, status: c.status, error: c.error })), failed: cards.filter((c) => isFailing(c.status)).length };
    await db.collection("ai_health_runs").insertOne({ ...record });
    const history = (await db.collection("ai_health_runs").find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(100).toArray()) as unknown as RunRecord[];
    const oldest = history[history.length - 1];
    if (history.length === 100 && oldest) await db.collection("ai_health_runs").deleteMany({ at: { $lt: oldest.at } });
    return { history };
  } catch {
    return { history: [] as RunRecord[] };
  }
}

export async function runHealthCheck() {
  const started = Date.now();
  const envChecks = envReport();
  const [providers, coexistence, database] = await Promise.all([
    runIntegrationChecks(),
    checkCoexistence().catch(
      (err): CoexistenceReport => ({ mode: "not_configured", connected: false, rows: [{ label: "Coexistence check", result: "fail", detail: err instanceof Error ? redactSecrets(err.message) : "failed" }], steps: [], approvals: [] })
    ),
    databaseCard(envChecks),
  ]);
  const dbOk = isUp(database.status);
  const [cron, email, feed] = await Promise.all([cronCard(envChecks, dbOk), emailCard(envChecks, dbOk), feedCard()]);
  const cards: HealthCard[] = [database, ...providers.map((r) => toCard(r, envChecks)), coexistenceCard(coexistence, envChecks), cron, email, feed];

  const { history } = await recordRun(cards, dbOk);
  for (const card of cards) {
    const success = history.find((run) => run.cards.some((c) => c.id === card.id && isUp(c.status)));
    const failure = history.find((run) => run.cards.some((c) => c.id === card.id && c.error));
    card.lastSuccessAt = success?.at ?? null;
    card.lastErrorAt = failure?.at ?? null;
    card.lastError = failure?.cards.find((c) => c.id === card.id)?.error ?? null;
  }
  const usage = dbOk ? await usageSummary(24).catch(() => []) : [];
  const agents = await agentHealth(cards, usage);
  const summary = summarise(cards.map((c) => c.status));
  const lastHealthy = history.find((run) => run.failed === 0) ?? null;
  const lastError = history.flatMap((run) => run.cards.filter((c) => c.error).map((c) => ({ at: run.at, id: c.id, error: c.error! })))[0] ?? null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "";
  return {
    checkedAt: new Date().toISOString(),
    ms: Date.now() - started,
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      production: process.env.NODE_ENV === "production" && !/localhost|127\.0\.0\.1/.test(siteUrl),
      paypalMode: process.env.PAYPAL_MODE || "not set",
    },
    summary,
    readiness: {
      /** Share of integrations that are Connected/Operational. */
      integrations: Math.round(((summary.operational + summary.connected) / summary.total) * 100),
      /** Mean of the four agents' dependency scores. */
      agents: Math.round(agents.reduce((n, a) => n + a.score, 0) / agents.length),
    },
    agentsOperational: agents.filter((a) => a.status === "operational").length,
    lastHealthyAt: lastHealthy?.at ?? null,
    lastError,
    cards,
    agents,
    coexistence,
    env: envChecks,
  };
}

export type HealthReport = Awaited<ReturnType<typeof runHealthCheck>>;
