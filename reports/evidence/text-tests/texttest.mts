import { ENV, redact } from "./vapi-lib.mjs";
import { desiredAssistant } from "file:///E:/marina%20e-comm%20(2)/marina%20e-comm/lib/ai/vapi.ts";
const A = desiredAssistant("https://marinamuseinternational.com", "x".repeat(32));
const MODEL = A.model.model, SYS = A.model.messages[0].content;
const decls = A.model.tools.map((t: any) => t.function);
const HOOK = "http://localhost:3917/api/ai/voice/webhook";
const captured: any[] = [];
async function tool(name: string, args: any) {
  if (name === "record_enquiry") { captured.push(args); return "Enquiry saved. Tell the caller the team will follow up."; }
  const r = await fetch(HOOK, { method: "POST", headers: { "Content-Type": "application/json", "x-vapi-secret": ENV.VAPI_WEBHOOK_SECRET }, body: JSON.stringify({ message: { type: "tool-calls", call: { id: "texttest", type: "webCall" }, toolCallList: [{ id: "t", type: "function", function: { name, arguments: args } }] } }) });
  return (await r.json()).results?.[0]?.result ?? "error";
}
async function gen(contents: any[]) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": ENV.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents, tools: [{ functionDeclarations: decls }], generationConfig: { temperature: 0.3, maxOutputTokens: 400 } }) });
  const j = await r.json(); if (!r.ok) throw new Error(`${r.status} ${redact(JSON.stringify(j)).slice(0, 300)}`); return j.candidates[0].content;
}
const scenarios: Record<string, string[]> = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
for (const [title, turns] of Object.entries(scenarios)) {
  console.log(`\n=== ${title}`); captured.length = 0;
  const contents: any[] = [{ role: "model", parts: [{ text: A.firstMessage }] }];
  for (const u of turns) {
    console.log(`USER: ${u}`); contents.push({ role: "user", parts: [{ text: u }] });
    for (let i = 0; i < 4; i++) {
      const c = await gen(contents); contents.push(c);
      const calls = c.parts.filter((p: any) => p.functionCall);
      if (!calls.length) { console.log(`BOT: ${c.parts.map((p: any) => p.text || "").join("").trim()}`); break; }
      const resp = [];
      for (const p of calls) { const out = await tool(p.functionCall.name, p.functionCall.args); console.log(`  [tool ${p.functionCall.name} ${JSON.stringify(p.functionCall.args)} -> ${String(out).slice(0, 120).replace(/\n/g, " | ")}...]`); resp.push({ functionResponse: { name: p.functionCall.name, response: { result: out } } }); }
      contents.push({ role: "user", parts: resp });
    }
  }
  if (captured.length) console.log(`  MOCK record_enquiry captured: ${JSON.stringify(captured)}`);
}
