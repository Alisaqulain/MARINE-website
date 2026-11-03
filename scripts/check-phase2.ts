// Phase 2 self-test from the command line: npm run check:phase2
// The pure logic checks are the same as on /test; the file checks below keep the env registry,
// .env.example and the code in sync.
import fs from "node:fs";
import path from "node:path";
import { runPhase2SelfTest } from "../lib/ai/selftest.ts";
import { ENV_REGISTRY } from "../lib/ai/env-registry.ts";

const results = runPhase2SelfTest();

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
const leaked = /^[A-Z0-9_]+=(?:AIza|EAA|sk-|re_)[A-Za-z0-9]/m.test(example) || /Admin@marinamuse/.test(example);
results.push({ section, name: ".env.example contains no real-looking secrets or the old sample password", pass: !leaked, detail: "" });
const envDoc = fs.existsSync("docs/phase2/ENVIRONMENT_SETUP.md") ? fs.readFileSync("docs/phase2/ENVIRONMENT_SETUP.md", "utf8") : "";
const notInDoc = ENV_REGISTRY.map((v) => v.name).filter((n) => !envDoc.includes(`\`${n}\``));
results.push({ section, name: "Every registered variable is documented in ENVIRONMENT_SETUP.md", pass: !notInDoc.length, detail: notInDoc.join(", ") });

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
