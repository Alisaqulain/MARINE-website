// Non-call text harness for Marina Muse Assistant (v2).
// Uses the assistant's exact prompt, model, temperature and tool schemas from lib/ai/vapi.ts.
// lookup_product -> local webhook (real catalogue, read-only). record_enquiry -> mock that applies the real consent gate.
// Not equivalent to a Vapi call: no speech, no Vapi pipeline, no telephony.
//
// Usage (needs the local dev server; default :3918, override with HOOK=...):
//   node texttest-v2.mts batch-1.json            run a batch, log to ./runs/
//   DRY_RUN=1 node texttest-v2.mts batch-1.json  check scenarios and tools without calling Gemini
// Stops at the first HTTP 429 and marks the rest BLOCKED, so quota is never spent on repeated 429s.
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

type Scenario = string[] | { turns: string[]; failTool?: "lookup_product" | "record_enquiry"; authFail?: boolean };
const file = process.argv[2];
const scenarios: Record<string, Scenario> = JSON.parse(fs.readFileSync(file, "utf8"));
fs.mkdirSync("runs", { recursive: true });
const logPath = `runs/${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}Z-${file.replace(/\.json$/, "")}${DRY ? "-dry" : ""}.log`;
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); fs.writeFileSync(logPath, redact(lines.join("\n")) + "\n"); };
let requests = 0;

async function tool(name: string, args: any, sc: Exclude<Scenario, string[]>) {
  if (sc.failTool === name) return vapi.TOOL_FAILURE_RESULT[name];
  if (name === "record_enquiry") {
    const d = vapi.enquiryDecision(args);
    return d.save ? "Enquiry saved. Tell the caller the team will follow up." : d.result;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!sc.authFail) headers["x-vapi-secret"] = ENV.VAPI_WEBHOOK_SECRET;
  const r = await fetch(HOOK, { method: "POST", headers, body: JSON.stringify({ message: { type: "tool-calls", call: { id: "texttest", type: "webCall" }, toolCallList: [{ id: "t", type: "function", function: { name, arguments: args } }] } }) });
  // Vapi treats any non-200 as "no result returned".
  if (r.status !== 200) return `No result returned (HTTP ${r.status}).`;
  return (await r.json()).results?.[0]?.result ?? "No result returned.";
}

class QuotaError extends Error {}
async function gen(contents: any[]) {
  requests += 1;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": ENV.GEMINI_API_KEY },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents, tools: [{ functionDeclarations: decls }], generationConfig: { temperature: 0.3, maxOutputTokens: 400 } }),
  });
  const j = await r.json();
  if (r.status === 429) throw new QuotaError(String(j.error?.message || "HTTP 429").slice(0, 300));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${redact(JSON.stringify(j)).slice(0, 300)}`);
  return j.candidates[0].content;
}

log(`Run ${new Date().toISOString()} | file ${file} | model ${MODEL} | voice ${A.voice.voiceId} | ${DRY ? "DRY RUN (no Gemini)" : "live Gemini"}`);
const titles = Object.keys(scenarios);
for (const [i, title] of titles.entries()) {
  const raw = scenarios[title];
  const sc = Array.isArray(raw) ? { turns: raw } : raw;
  log(`\n=== ${title}  [${new Date().toISOString()}]${sc.failTool ? ` (simulated ${sc.failTool} failure)` : ""}${sc.authFail ? " (no webhook secret)" : ""}`);
  if (DRY) {
    if (sc.turns.length === 0) throw new Error(`${title}: no turns`);
    const probe = sc.failTool ? await tool(sc.failTool, { query: "anchor", notes: "dry", consentToContact: true }, sc) : await tool("lookup_product", { query: "anchor" }, sc);
    log(`  turns: ${sc.turns.length} | tool check: ${String(probe).slice(0, 110).replace(/\n/g, " | ")}`);
    continue;
  }
  const contents: any[] = [{ role: "model", parts: [{ text: A.firstMessage }] }];
  try {
    for (const u of sc.turns) {
      log(`USER: ${u}`);
      contents.push({ role: "user", parts: [{ text: u }] });
      for (let step = 0; step < 4; step++) {
        const c = await gen(contents);
        contents.push(c);
        const calls = c.parts.filter((p: any) => p.functionCall);
        if (!calls.length) { log(`BOT: ${c.parts.map((p: any) => p.text || "").join("").trim()}`); break; }
        const resp = [];
        for (const p of calls) {
          const out = await tool(p.functionCall.name, p.functionCall.args, sc);
          log(`  [tool ${p.functionCall.name} ${JSON.stringify(p.functionCall.args)} -> ${String(out).slice(0, 160).replace(/\n/g, " | ")}]`);
          resp.push({ functionResponse: { name: p.functionCall.name, response: { result: out } } });
        }
        contents.push({ role: "user", parts: resp });
      }
    }
  } catch (err) {
    if (err instanceof QuotaError) {
      log(`  STOPPED: HTTP 429 quota - ${err.message}`);
      log(`\nBLOCKED (not run, quota): ${[title, ...titles.slice(i + 1)].join("; ")}`);
      break;
    }
    log(`  ERROR: ${(err as Error).message}`);
  }
}
log(`\nGemini requests made: ${requests} | log: ${logPath}`);
