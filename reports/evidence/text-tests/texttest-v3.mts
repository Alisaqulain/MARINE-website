// Non-call text harness for Marina Muse Assistant (v3).
// Same method as v2: the assistant's exact prompt, model, temperature and tool schemas from lib/ai/vapi.ts;
// lookup_product -> local webhook (real catalogue, read-only); record_enquiry -> mock applying the real consent gate.
// Not equivalent to a Vapi call: no speech, no Vapi pipeline, no telephony.
//
// Request savings over v2 (coverage unchanged: same scenarios, same turns, every model reply recorded):
//  - Quota gate: refuses to start before the reset time recorded from Google's last 429 (quota-state.json),
//    so no request is spent just to receive another 429.
//  - Resume ledger: scenarios already recorded with live replies (results/ledger.json) are skipped,
//    so a batch stopped by quota continues where it stopped instead of starting over.
//  - Budget: BUDGET (default 18) caps requests per run; a scenario starts only if its estimated requests fit,
//    leaving the rest of the daily quota for the live website.
//  - Stops at the first 429 and records Google's retry delay. A 5xx or timeout gets one retry.
//
// Isolation (9 Nov 2026): .env.local points at the production database, so by default lookup_product runs
// in-process against catalogue-snapshot.json (taken from the public catalogue endpoint) with the same logic as
// the webhook (answerFromCatalogue + MOQ lines). No database and no dev server are needed. CATALOGUE=webhook
// uses the local webhook instead and needs DB_ISOLATION_CONFIRMED=1 (a dev server on an isolated database).
//
// Usage (from this folder):
//   node texttest-v3.mts --snapshot               refresh catalogue-snapshot.json (one public GET, no Gemini)
//   node texttest-v3.mts batch-1.json             run (or resume) batch 1
//   DRY_RUN=1 node texttest-v3.mts batch-1.json   validate scenarios and tools, show request estimate, 0 Gemini requests
//   RERUN=T3 node texttest-v3.mts batch-1.json    re-record one scenario that is already in the ledger
//   FORCE=1 ...                                   ignore the recorded quota reset time (one request may get a 429)
//
// Auto-checks are aids, not verdicts: the final PASSED/FAILED in the report is assigned after reading each transcript.
import fs from "node:fs";
import { ENV, redact } from "./vapi-lib.mjs";

Object.assign(process.env, ENV);
const vapi = await import("file:///E:/marina%20e-comm%20(2)/marina%20e-comm/lib/ai/vapi.ts");
const A = vapi.desiredAssistant("https://marinamuseinternational.com", "x".repeat(32));
const MODEL = A.model.model;
const SYS = A.model.messages[0].content;
const decls = A.model.tools.map((t: any) => t.function);
const HOOK = process.env.HOOK || "http://localhost:3918/api/ai/voice/webhook";
const DRY = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";
const BUDGET = Number(process.env.BUDGET || 18);
const RERUN = new Set((process.env.RERUN || "").split(",").map((s) => s.trim()).filter(Boolean));
const TEST_KEY = process.env.GEMINI_TEST_API_KEY || ENV.GEMINI_TEST_API_KEY || "";
// Only the dedicated test key is ever sent; the production GEMINI_API_KEY is not read for requests.
const GEMINI_KEY = TEST_KEY;
// Quota is tracked per key source: a dedicated test key has its own quota.
const QUOTA_KEY = TEST_KEY ? `test:${MODEL}` : MODEL;
const TEST_PROJECT = "marina-muse-gemini-testing";
const PROJECT_CONFIRMED = process.env.GEMINI_TEST_PROJECT_CONFIRMED || ENV.GEMINI_TEST_PROJECT_CONFIRMED || "";
const CATALOGUE = process.env.CATALOGUE === "webhook" ? "webhook" : "snapshot";
const SNAPSHOT = "catalogue-snapshot.json";
const answer = await import("file:///E:/marina%20e-comm%20(2)/marina%20e-comm/lib/ai/answer.ts");

// ── Catalogue snapshot (public endpoint, read-only) ──
if (process.argv[2] === "--snapshot") {
  const source = "https://marinamuseinternational.com/api/catalog/products";
  const res = await fetch(source);
  const items = ((await res.json()).items || []) as any[];
  // Same mapping as facts() in lib/ai/crm.ts, region "other" (no caller number in a text test).
  const facts = items.slice(0, 400).map((p) => ({ slug: p.slug, name: p.name, sku: p.sku, price: p.price, currency: "USD", material: p.material, dimensions: p.dimensions, stock: p.stock, quantity: p.quantity, description: p.description || p.name, href: `/product/${p.slug}`, moq: p.moq }));
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ fetchedAt: new Date().toISOString(), source, status: res.status, count: facts.length, facts }, null, 1));
  console.log(`Saved ${facts.length} catalogue facts from ${source} (HTTP ${res.status}) to ${SNAPSHOT}. No Gemini request.`);
  process.exit(0);
}
const snapshot = CATALOGUE === "snapshot" && fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) : null;

/** lookup_product exactly as lib/ai/voice.ts runTool + lib/ai/crm.ts lookupProductsForAgent, on the snapshot. */
function snapshotLookup(args: any) {
  const query = String(args.query || "").trim();
  if (!query) return "Ask the caller which product they mean.";
  const found = answer.answerFromCatalogue(query.slice(0, 300), snapshot.facts);
  if (found.unknown) return "No verified catalogue match. Tell the caller you don't have that information and offer a callback from the team.";
  const moq = found.products.filter((p: any) => p.moq).map((p: any) => `${p.name}: wholesale minimum order ${p.moq} units.`);
  return [found.text, ...moq].join("\n");
}

type Expect = {
  tools?: string[]; // each must be called at least once
  noTools?: boolean;
  noSaveBeforeLastTurn?: boolean; // record_enquiry only after the consent turn
  save?: { enquiryType?: string; consent: boolean } | false; // false: no successful save may happen
  mustMatch?: string[]; // regexes (case-insensitive) the final reply must match
  mustNotMatch?: string[]; // regexes no assistant reply may match
};
type Scenario = { title: string; turns: string[]; maxRequests: number; failTool?: "lookup_product" | "record_enquiry"; authFail?: boolean; expect: Expect };

const file = process.argv[2];
const scenarios: Record<string, Scenario> = JSON.parse(fs.readFileSync(file, "utf8"));
fs.mkdirSync("runs", { recursive: true });
fs.mkdirSync("results", { recursive: true });
const LEDGER = "results/ledger.json";
const QUOTA = "quota-state.json";
const ledger: Record<string, any> = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
const quota: Record<string, { resetAt: string; seenAt: string; message: string }> = fs.existsSync(QUOTA) ? JSON.parse(fs.readFileSync(QUOTA, "utf8")) : {};

const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
const logPath = `runs/${stamp}Z-${file.replace(/\.json$/, "")}${DRY ? "-dry" : ""}-v3.log`;
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); fs.writeFileSync(logPath, redact(lines.join("\n")) + "\n"); };
const saveLedger = () => fs.writeFileSync(LEDGER, redact(JSON.stringify(ledger, null, 2)));

log(`Run ${new Date().toISOString()} | ${file} | model ${MODEL} | voice ${A.voice.voiceId} | ${DRY ? "DRY RUN (no Gemini)" : `live Gemini, budget ${BUDGET}`}`);

// ── Isolation gate ──
// Quota is per Google Cloud project, so a second key in the website's project is not isolation. Live requests need
// all three: GEMINI_TEST_API_KEY; GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing, set by whoever checked
// in Google AI Studio / Cloud Console that the key belongs to that project; and an isolated catalogue (the snapshot,
// or CATALOGUE=webhook with DB_ISOLATION_CONFIRMED=1). The production GEMINI_API_KEY is never used.
const isolationProblems = [
  !TEST_KEY && "GEMINI_TEST_API_KEY is not set (the production GEMINI_API_KEY is never used for tests)",
  PROJECT_CONFIRMED !== TEST_PROJECT && `GEMINI_TEST_PROJECT_CONFIRMED is not "${TEST_PROJECT}" (confirm the key's project in Google AI Studio first)`,
  CATALOGUE === "snapshot" && !snapshot && `${SNAPSHOT} is missing (run: node texttest-v3.mts --snapshot)`,
  CATALOGUE === "webhook" && process.env.DB_ISOLATION_CONFIRMED !== "1" && "CATALOGUE=webhook reads the dev server's database, which is production; set DB_ISOLATION_CONFIRMED=1 only for an isolated database",
].filter(Boolean);
log(`Isolation: key ${TEST_KEY ? "GEMINI_TEST_API_KEY" : "none"} | project ${PROJECT_CONFIRMED || "unconfirmed"} | catalogue ${CATALOGUE}${snapshot ? ` (${snapshot.count} items, ${snapshot.fetchedAt})` : ""}`);
if (!DRY && isolationProblems.length) {
  log(`ISOLATION GATE: ${isolationProblems.join("; ")}. No request sent.`);
  log(`Pending (BLOCKED): ${Object.keys(scenarios).filter((id) => !ledger[id]?.recorded || RERUN.has(id)).join(", ")}`);
  process.exit(3);
}

// ── Quota gate ──
const gate = quota[QUOTA_KEY];
if (!DRY && !FORCE && gate && Date.parse(gate.resetAt) > Date.now()) {
  log(`QUOTA GATE: ${MODEL} quota resets ${gate.resetAt} (recorded ${gate.seenAt} from Google's 429). No request sent.`);
  log(`Pending (BLOCKED): ${Object.keys(scenarios).filter((id) => !ledger[id]?.recorded || RERUN.has(id)).join(", ")}`);
  process.exit(2);
}

async function tool(name: string, args: any, sc: Scenario) {
  if (sc.failTool === name) return vapi.TOOL_FAILURE_RESULT[name];
  if (name === "record_enquiry") {
    const d = vapi.enquiryDecision(args);
    return d.save ? "Enquiry saved. Tell the caller the team will follow up." : d.result;
  }
  if (CATALOGUE === "snapshot") {
    // The real webhook answers 401 without the secret (verified by check:routes); Vapi then reports no result.
    if (sc.authFail) return "No result returned (HTTP 401).";
    if (!snapshot) return "No result returned (no catalogue snapshot).";
    return snapshotLookup(args);
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!sc.authFail) headers["x-vapi-secret"] = ENV.VAPI_WEBHOOK_SECRET;
  const r = await fetch(HOOK, { method: "POST", headers, body: JSON.stringify({ message: { type: "tool-calls", call: { id: "texttest", type: "webCall" }, toolCallList: [{ id: "t", type: "function", function: { name, arguments: args } }] } }) });
  // Vapi treats any non-200 as "no result returned".
  if (r.status !== 200) return `No result returned (HTTP ${r.status}).`;
  return (await r.json()).results?.[0]?.result ?? "No result returned.";
}

class QuotaError extends Error {}
let requests = 0;
async function gen(contents: any[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    requests += 1;
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents, tools: [{ functionDeclarations: decls }], generationConfig: { temperature: 0.3, maxOutputTokens: 400 } }),
      });
    } catch (err) {
      if (attempt === 0) { log(`  (timeout/network error, one retry: ${(err as Error).message})`); await new Promise((s) => setTimeout(s, 2000)); continue; }
      throw err;
    }
    const j = await r.json();
    if (r.status === 429) {
      const msg = String(j.error?.message || "HTTP 429");
      const delay = (j.error?.details || []).find((d: any) => d.retryDelay)?.retryDelay as string | undefined;
      const seconds = delay ? Number(delay.replace(/s$/, "")) : NaN;
      if (Number.isFinite(seconds) && seconds > 60) {
        quota[QUOTA_KEY] = { resetAt: new Date(Date.now() + seconds * 1000).toISOString(), seenAt: new Date().toISOString(), message: msg.slice(0, 200) };
        fs.writeFileSync(QUOTA, JSON.stringify(quota, null, 2));
      }
      throw new QuotaError(msg.slice(0, 300));
    }
    if (r.status >= 500 && attempt === 0) { log(`  (HTTP ${r.status}, one retry)`); await new Promise((s) => setTimeout(s, 2000)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${redact(JSON.stringify(j)).slice(0, 300)}`);
    return j.candidates[0].content;
  }
}

function autoCheck(sc: Scenario, calls: { turn: number; name: string; args: any; result: string }[], replies: string[]) {
  const e = sc.expect;
  const out: string[] = [];
  const ok = (cond: boolean, label: string) => out.push(`${cond ? "ok  " : "FAIL"} ${label}`);
  const last = replies[replies.length - 1] || "";
  for (const t of e.tools || []) ok(calls.some((c) => c.name === t), `called ${t}`);
  if (e.noTools) ok(calls.length === 0, "no tool called");
  if (e.noSaveBeforeLastTurn) ok(!calls.some((c) => c.name === "record_enquiry" && c.turn < sc.turns.length - 1), "no record_enquiry before the consent turn");
  const saved = calls.filter((c) => c.name === "record_enquiry" && c.result.startsWith("Enquiry saved"));
  if (e.save === false) ok(saved.length === 0, "nothing saved");
  else if (e.save) {
    ok(saved.length >= 1, "enquiry saved");
    const want = e.save;
    if (want.enquiryType) ok(saved.some((c) => c.args.enquiryType === want.enquiryType), `enquiryType ${want.enquiryType}`);
    ok(saved.every((c) => c.args.consentToContact === want.consent), `consentToContact ${want.consent}`);
  }
  for (const re of e.mustMatch || []) ok(new RegExp(re, "i").test(last), `final reply matches /${re}/`);
  for (const re of e.mustNotMatch || []) ok(!replies.some((r) => new RegExp(re, "i").test(r)), `no reply matches /${re}/`);
  return out;
}

const pending = Object.keys(scenarios).filter((id) => !ledger[id]?.recorded || RERUN.has(id));
const skipped = Object.keys(scenarios).filter((id) => !pending.includes(id));
if (skipped.length) log(`Already recorded (skipped, no requests): ${skipped.join(", ")}`);
log(`Pending: ${pending.join(", ") || "none"} | estimated requests: ${pending.reduce((n, id) => n + scenarios[id].maxRequests, 0)}`);

for (const [i, id] of pending.entries()) {
  const sc = scenarios[id];
  if (!sc.turns?.length || !sc.expect || !sc.maxRequests) throw new Error(`${id}: turns, expect and maxRequests are required`);
  if (DRY) {
    const probe = sc.failTool ? await tool(sc.failTool, { query: "anchor", notes: "dry", consentToContact: true }, sc) : await tool("lookup_product", { query: "anchor" }, sc);
    log(`${id} ${sc.title}: ${sc.turns.length} turn(s), est. ${sc.maxRequests} requests | tool path: ${String(probe).slice(0, 90).replace(/\n/g, " | ")}`);
    continue;
  }
  if (requests + sc.maxRequests > BUDGET) {
    log(`\nBUDGET: ${requests} used of ${BUDGET}; ${id} needs up to ${sc.maxRequests}. Not started: ${pending.slice(i).join(", ")} (resume next run).`);
    break;
  }
  const startedAt = new Date().toISOString();
  const before = requests;
  log(`\n=== ${id} ${sc.title}  [${startedAt}]${sc.failTool ? ` (simulated ${sc.failTool} failure)` : ""}${sc.authFail ? " (no webhook secret)" : ""}`);
  const contents: any[] = [{ role: "model", parts: [{ text: A.firstMessage }] }];
  const transcript: { role: string; text: string; at: string }[] = [{ role: "assistant", text: A.firstMessage, at: startedAt }];
  const calls: { turn: number; name: string; args: any; result: string }[] = [];
  const replies: string[] = [];
  try {
    for (const [turn, u] of sc.turns.entries()) {
      log(`USER: ${u}`);
      transcript.push({ role: "user", text: u, at: new Date().toISOString() });
      contents.push({ role: "user", parts: [{ text: u }] });
      for (let step = 0; step < 4; step++) {
        const c = await gen(contents);
        contents.push(c);
        const fnCalls = c.parts.filter((p: any) => p.functionCall);
        if (!fnCalls.length) {
          const text = c.parts.map((p: any) => p.text || "").join("").trim();
          replies.push(text);
          transcript.push({ role: "assistant", text, at: new Date().toISOString() });
          log(`BOT: ${text}`);
          break;
        }
        const resp = [];
        for (const p of fnCalls) {
          const out = await tool(p.functionCall.name, p.functionCall.args, sc);
          calls.push({ turn, name: p.functionCall.name, args: p.functionCall.args, result: String(out) });
          transcript.push({ role: "tool", text: `${p.functionCall.name} ${JSON.stringify(p.functionCall.args)} -> ${String(out).slice(0, 300)}`, at: new Date().toISOString() });
          log(`  [tool ${p.functionCall.name} ${JSON.stringify(p.functionCall.args)} -> ${String(out).slice(0, 160).replace(/\n/g, " | ")}]`);
          resp.push({ functionResponse: { name: p.functionCall.name, response: { result: out } } });
        }
        contents.push({ role: "user", parts: resp });
      }
    }
    const checks = autoCheck(sc, calls, replies);
    checks.forEach((c) => log(`  auto-check ${c}`));
    ledger[id] = { recorded: true, title: sc.title, startedAt, finishedAt: new Date().toISOString(), model: MODEL, voice: A.voice.voiceId, requests: requests - before, log: logPath, autoChecks: checks, transcript, status: "NEEDS REVIEW" };
    saveLedger();
  } catch (err) {
    if (err instanceof QuotaError) {
      log(`  STOPPED: HTTP 429 quota - ${err.message}`);
      log(`\nBLOCKED (quota, will resume next run): ${pending.slice(i).join(", ")}`);
      break;
    }
    log(`  ERROR: ${(err as Error).message} (scenario not recorded; it will be retried next run)`);
  }
}
log(`\nGemini requests made: ${requests} | log: ${logPath} | ledger: ${LEDGER}`);
