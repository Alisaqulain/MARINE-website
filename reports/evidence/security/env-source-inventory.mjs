// Source-code inventory of environment variables (read-only; never opens .env.local).
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON reports/evidence/security/env-source-inventory.mjs
// For every UPPER_CASE name it records, with file:line evidence:
//   direct  - process.env.NAME / process.env["NAME"]
//   helper  - env("NAME") (lib/ai/http.ts helper) or other call with the name as its first string arg
//   listed  - the name as a string literal elsewhere (status lists, diagnostics)
// Code is split into: runtime (app, lib, components, middleware, auth*, next.config),
// script (scripts/), test (selftest, provider-selftest, check scripts). The registry file is
// reported separately. Output: env-source-inventory-20261110.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_REGISTRY } from "../../../lib/ai/env-registry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SKIP = new Set(["node_modules", ".next", ".git", "reports", "public", "docs"]);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(p);
  }
})(root);
const rel = (p) => path.relative(root, p).replace(/\\/g, "/");
const kindOf = (r) =>
  r === "lib/ai/env-registry.ts" ? "registry"
  : /^(lib\/ai\/(selftest|provider-selftest)\.ts|scripts\/check-)/.test(r) ? "test"
  : r.startsWith("scripts/") ? "script"
  : "runtime";
const NAME = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+";
const inv = {};
const add = (n, how, kind, where) => { const o = (inv[n] ||= { direct: {}, helper: {}, listed: {} }); (o[how][kind] ||= []).push(where); };
for (const f of files) {
  const r = rel(f), kind = kindOf(r);
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const where = `${r}:${i + 1}`;
    const seen = new Set();
    for (const m of line.matchAll(new RegExp(`process\\.env(?:\\.(${NAME})|\\[\\s*["'\`](${NAME})["'\`]\\s*\\])`, "g"))) { const n = m[1] || m[2]; add(n, "direct", kind, where); seen.add(n); }
    for (const m of line.matchAll(new RegExp(`\\b(?:env|envOr|readEnv|getEnv|envFlag|envNumber|envList|flag|read)\\(\\s*["'\`](${NAME})["'\`]`, "g"))) { if (!seen.has(m[1])) { add(m[1], "helper", kind, where); seen.add(m[1]); } }
    // an env object passed in as a parameter (e.g. env = process.env): env.NAME, source.NAME, env?.NAME
    for (const m of line.matchAll(new RegExp(`\\b(?:env|source|e)\\??\\.(${NAME})\\b`, "g"))) { if (!seen.has(m[1])) { add(m[1], "helper", kind, where); seen.add(m[1]); } }
    for (const m of line.matchAll(new RegExp(`["'\`](${NAME})["'\`]`, "g"))) { if (!seen.has(m[1])) { add(m[1], "listed", kind, where); seen.add(m[1]); } }
  });
}
// keep only names that are plausibly env vars: read anywhere, or registered
const reg = new Map(ENV_REGISTRY.map((v) => [v.name, v]));
const out = {};
for (const [n, o] of Object.entries(inv)) {
  const readRuntime = (o.direct.runtime?.length || 0) + (o.helper.runtime?.length || 0);
  const readAny = Object.values(o.direct).flat().length + Object.values(o.helper).flat().length;
  if (!readAny && !reg.has(n)) continue;
  out[n] = { registered: reg.has(n), readRuntime, ...o };
}
for (const n of reg.keys()) if (!out[n]) out[n] = { registered: true, readRuntime: 0, direct: {}, helper: {}, listed: {} };
const exampleText = fs.readFileSync(path.join(root, ".env.example"), "utf8");
for (const [n, o] of Object.entries(out)) {
  o.inExample = new RegExp(`^#?\\s*${n}=`, "m").test(exampleText);
}
fs.writeFileSync(path.join(root, "reports/evidence/security/env-source-inventory-20261110.json"), JSON.stringify(out, null, 1));
const s = (k) => Object.values(out).filter(k).length;
console.log(`names: ${Object.keys(out).length}; registered: ${s((o) => o.registered)}; read by runtime code: ${s((o) => o.readRuntime > 0)}; registered but not read at runtime: ${s((o) => o.registered && !o.readRuntime)}; read at runtime but not registered: ${s((o) => !o.registered && o.readRuntime)}`);
for (const [n, o] of Object.entries(out).sort()) {
  const fl = (x) => Object.entries(x).map(([k, v]) => `${k}:${v.length}`).join(",");
  console.log(`${n.padEnd(40)} reg=${o.registered ? "Y" : "-"} ex=${o.inExample ? "Y" : "-"} rt=${o.readRuntime} direct[${fl(o.direct)}] helper[${fl(o.helper)}] listed[${fl(o.listed)}]`);
}
