// Phase 2 self-test from the command line: npm run check:phase2
// The pure logic checks are the same as on /test; the file checks below keep the env registry,
// .env.example and the code in sync.
import fs from "node:fs";
import path from "node:path";
import { runPhase2SelfTest } from "../lib/ai/selftest.ts";
import { runProviderSelfTest } from "../lib/ai/provider-selftest.ts";
import { ENV_REGISTRY } from "../lib/ai/env-registry.ts";

const results = [...runPhase2SelfTest(), ...(await runProviderSelfTest())];

// ── Environment consistency (code ↔ registry ↔ .env.example) ──
const section = "Environment consistency (files)";
const roots = ["app", "lib", "components", "auth.ts", "auth.config.ts", "middleware.ts"];
const used = new Set<string>();
const walk = (p: string) => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) return fs.readdirSync(p).forEach((f) => walk(path.join(p, f)));
  if (!/\.(ts|tsx|mjs)$/.test(p) || p.endsWith("env-registry.ts")) return;
  const src = fs.readFileSync(p, "utf8");
  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)|\benv\("([A-Z][A-Z0-9_]+)"\)|\bflag\("([A-Z][A-Z0-9_]+)"\)|\benv\.([A-Z][A-Z0-9_]{3,})\b/g)) {
    used.add(m[1] || m[2] || m[3] || m[4]);
  }
};
roots.forEach(walk);
used.delete("NODE_ENV");
const registered = new Set(ENV_REGISTRY.map((v) => v.name));
const unregistered = [...used].filter((n) => !registered.has(n)).sort();
results.push({ section, name: "Every variable the code reads is in the registry", pass: !unregistered.length, detail: unregistered.join(", ") });
const example = fs.readFileSync(".env.example", "utf8");
const notInExample = ENV_REGISTRY.map((v) => v.name).filter((n) => !new RegExp(`^#? ?${n}=`, "m").test(example));
results.push({ section, name: "Every registered variable is in .env.example (run npm run docs:env)", pass: !notInExample.length, detail: notInExample.join(", ") });
const leaked = /^[A-Z0-9_]+=(?:AIza|AQ.|EAA|sk-|re_)[A-Za-z0-9]/m.test(example) || /Admin@marinamuse/.test(example);
results.push({ section, name: ".env.example contains no real-looking secrets or the old sample password", pass: !leaked, detail: "" });
const envDoc = fs.existsSync("docs/phase2/ENVIRONMENT_SETUP.md") ? fs.readFileSync("docs/phase2/ENVIRONMENT_SETUP.md", "utf8") : "";
const notInDoc = ENV_REGISTRY.map((v) => v.name).filter((n) => !envDoc.includes(`\`${n}\``));
results.push({ section, name: "Every registered variable is documented in ENVIRONMENT_SETUP.md", pass: !notInDoc.length, detail: notInDoc.join(", ") });

// ── Agent switch coverage: every scheduled, background or side-effect path checks the fail-closed switch ──
{
  const section = "Agent switch · guard coverage (source)";
  const src = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
  const guards: [string, string, RegExp][] = [
    ["Chat route refuses when the chat agent is off", "app/api/ai/chat/route.ts", /if \(!agentEnabled\("chat"\)\)/],
    ["WhatsApp AI replies and STOP/START confirmations need the WhatsApp agent", "lib/whatsapp/inbound.ts", /if \(!agentEnabled\("whatsapp"\)\) return \{ sent: false as const, drafted: false as const \};[\s\S]*if \(!agentEnabled\("whatsapp"\)\) return \{ sent: false as const, drafted: false as const \};[\s\S]*if \(!agentEnabled\("whatsapp"\)\) return/],
    ["Voice tool calls need the voice agent", "lib/ai/voice.ts", /if \(!agentEnabled\("voice"\)\) \{\s*return \{ status: 200/],
    ["Voice Gemini call analysis needs the voice agent", "lib/ai/voice.ts", /!agentEnabled\("voice"\)\) return \{ insight: null, rules \}/],
    ["Voice missed-call owner email needs the voice agent", "lib/ai/voice.ts", /if \(!agentEnabled\("voice"\)\) \{\s*const db = await getDb\(\);\s*await db\.collection\("ai_audit"\)\.insertOne\(\{ at, action: "missed_call_alert"/],
    ["Cron follow-ups: nothing queued or sent for an agent that is off", "lib/ai/followups.ts", /const chatOn = agentEnabled\("chat"\);[\s\S]*if \(!agentEnabled\(followUpAgent\(row\.channel\)\)\) \{\s*counts\.agentOff/],
    ["Cron daily report skips (no email, no Google reads) when the growth agent is off", "app/api/ai/report/daily/route.ts", /if \(!agentEnabled\("growth"\)\) \{\s*await recordJobRun\("daily_report", true, \{ skipped/],
    ["Daily report send and external reads need the growth agent", "lib/ai/daily-report.ts", /agentEnabled\("growth"\) \? externalGrowthData\(7\)[\s\S]*if \(!agentEnabled\("growth"\)\) throw/],
    ["Owner lead alerts need the lead's agent", "lib/ai/crm.ts", /if \(alert && agentEnabled\(input\.channel\)\)/],
    ["Admin: Vapi sync and outbound callback need the voice agent", "app/api/admin/ai/actions/route.ts", /\(action === "vapi_sync" \|\| action === "approve_callback"\) && !agentEnabled\("voice"\)/],
    ["Admin: WhatsApp resend needs the WhatsApp agent", "app/api/admin/ai/actions/route.ts", /if \(action === "wa_resend"\) \{\s*if \(!agentEnabled\("whatsapp"\)\) return/],
    ["Admin: content drafts need the growth agent", "app/api/admin/ai/actions/route.ts", /if \(!agentEnabled\("growth"\)\) return NextResponse\.json/],
  ];
  for (const [name, file, re] of guards) results.push({ section, name, pass: re.test(src(file)), detail: file });
  const agentsSrc = src("lib/ai/agents.ts");
  results.push({ section, name: "No opt-out default left in lib/ai/agents.ts", pass: !/Empty = all four on/.test(agentsSrc) && /AI_AGENTS_ENABLED/.test(agentsSrc), detail: "" });
  const tpl = src("MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env");
  results.push({ section, name: "Production template: all four disabled, nothing enabled or approved", pass: /^AI_AGENTS_DISABLED=chat,voice,growth,whatsapp$/m.test(tpl) && /^AI_AGENTS_ENABLED=$/m.test(tpl) && /^AI_AGENTS_PRODUCTION_APPROVED=$/m.test(tpl), detail: "" });
}

let current = "";
for (const result of results) {
  if (result.section !== current) {
    current = result.section;
    console.log(`\n${current}`);
  }
  console.log(`  ${result.pass ? "PASS" : "FAIL"} ${result.name}${result.pass ? "" : ` — ${result.detail}`}`);
}
const failed = results.filter((result) => !result.pass).length;
console.log(`\nTOTAL ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
