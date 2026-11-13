// Environment readiness audit (read-only). Prints NAMES and status flags only, never values.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON reports/evidence/security/env-readiness-audit.mjs
// Cross-checks: ENV_REGISTRY (lib/ai/env-registry.ts)  x  .env.example  x  process.env reads in code,
// then validates .env.local with the registry validators and looks for production references.
import fs from "node:fs";
import path from "node:path";
import { ENV_REGISTRY, envReport } from "../../../lib/ai/env-registry.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")).replace(/%20/g, " "), "../../..");
const parse = (f) => {
  const out = {};
  if (!fs.existsSync(f)) return out;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/); if (!m) continue;
    let v = m[2].trim(); if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1); out[m[1]] = v;
  }
  return out;
};
const exampleText = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const exampleActive = new Set(Object.keys(parse(path.join(root, ".env.example"))));
// gen-env-docs writes advanced variables commented out ("# NAME="); they are documented too.
const exampleCommented = new Set([...exampleText.matchAll(/^#\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
const exampleNames = new Set([...exampleActive, ...exampleCommented]);
const local = parse(path.join(root, ".env.local"));
const reg = new Map(ENV_REGISTRY.map((v) => [v.name, v]));

// process.env reads in source (app, lib, components, scripts, middleware, next.config)
const used = new Map();
const literal = new Map(); // name -> files mentioning it as a literal (helpers like env("X"))
const SKIP = new Set(["node_modules", ".next", ".git", "reports", "public"]);
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name)) {
      const t = fs.readFileSync(p, "utf8");
      if (!p.endsWith("env-registry.ts")) for (const m of t.matchAll(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/g)) { if (!literal.has(m[1])) literal.set(m[1], new Set()); literal.get(m[1]).add(path.relative(root, p).replace(/\\/g, "/")); }
      for (const m of t.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\])/g)) {
        const n = m[1] || m[2]; if (!used.has(n)) used.set(n, new Set()); used.get(n).add(path.relative(root, p).replace(/\\/g, "/"));
      }
    }
  }
})(root);
const RUNTIME = new Set(["NODE_ENV", "NEXT_RUNTIME", "PORT", "HOSTNAME", "CI", "VERCEL", "VERCEL_ENV", "NEXT_PHASE", "TZ", "DEBUG", "HOME", "USERPROFILE", "APPDATA", "TEMP", "TMP", "PATH", "SystemRoot"]);

const L = [];
const now = new Date().toISOString();
L.push(`Environment readiness audit, ${now}. Names and flags only; no value is printed.`, "");
L.push(`Registry variables: ${reg.size}; .env.example variables: ${exampleNames.size} (${exampleActive.size} active, ${exampleCommented.size} commented-out advanced); distinct process.env names read in code: ${used.size}; .env.local variables: ${Object.keys(local).length}`, "");

const inRegNotExample = [...reg.keys()].filter((n) => !exampleNames.has(n));
const inExampleNotReg = [...exampleNames].filter((n) => !reg.has(n));
const usedNotReg = [...used.keys()].filter((n) => !reg.has(n) && !RUNTIME.has(n)).sort();
const regNotUsed = [...reg.keys()].filter((n) => !used.has(n) && !literal.has(n));
const localNotReg = Object.keys(local).filter((n) => !reg.has(n));
L.push(`[consistency] in registry but not in .env.example: ${inRegNotExample.length} ${inRegNotExample.join(", ")}`);
L.push(`[consistency] in .env.example but not in registry: ${inExampleNotReg.length} ${inExampleNotReg.join(", ")}`);
L.push(`[consistency] read by code but not in registry (excluding runtime names): ${usedNotReg.length}`);
for (const n of usedNotReg) L.push(`    ${n}  <- ${[...used.get(n)].slice(0, 3).join(", ")}`);
L.push(`[unused] in registry but never referenced in app/lib/components/scripts (process.env or helper literal): ${regNotUsed.length} ${regNotUsed.join(", ")}`);
L.push(`[obsolete] in .env.local but not in registry: ${localNotReg.length} ${localNotReg.join(", ")}`);
const dupLocal = []; { const seen = new Set(); for (const l of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/); if (m) { if (seen.has(m[1])) dupLocal.push(m[1]); seen.add(m[1]); } } }
L.push(`[duplicates] names defined twice in .env.local: ${dupLocal.length} ${dupLocal.join(", ")}`, "");

// .env.local validation (development)
const rep = envReport(local);
const missingReq = rep.filter((r) => r.required === "required" && !r.set && r.scope !== "production");
const invalid = rep.filter((r) => r.set && !r.valid);
L.push(`[.env.local] required (non-production-only) variables missing: ${missingReq.length} ${missingReq.map((r) => r.name).join(", ")}`);
L.push(`[.env.local] set but failing validation: ${invalid.length}`);
for (const r of invalid) L.push(`    ${r.name}: ${r.problem}`);
const prodOnlySet = rep.filter((r) => r.set && r.scope === "production").map((r) => r.name);
L.push(`[.env.local] production-scope variables set in development: ${prodOnlySet.length} ${prodOnlySet.join(", ")}`, "");

// production references in development configuration (values inspected in memory only)
const prodRefs = [];
for (const [k, v] of Object.entries(local)) {
  if (/mongodb(\+srv)?:\/\//.test(v)) { const h = (v.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/) || [])[1] || ""; const hosts = h.split(","); if (!hosts.every((x) => /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(x))) prodRefs.push(`${k}: non-local database host`); if (/mongodb\.net/.test(h)) prodRefs.push(`${k}: Atlas host`); }
  if (/marinamuseinternational\.com/i.test(v) && /URL/.test(k)) prodRefs.push(`${k}: points at the production site domain`);
  if (k === "PAYPAL_MODE" && v === "live") prodRefs.push("PAYPAL_MODE=live");
  if (/_ALLOW_(LIVE_)?OUTSIDE_PRODUCTION$/.test(k) && /^(1|true)$/i.test(v)) prodRefs.push(`${k} enables a production side effect in development`);
  if (k === "WHATSAPP_PRODUCTION_ONBOARDING_APPROVED" && /^(1|true)$/i.test(v)) prodRefs.push(`${k} is on`);
  if (/_OUTBOUND_ENABLED$/.test(k) && /^(1|true)$/i.test(v)) prodRefs.push(`${k} is on (outbound calls/messages)`);
}
L.push(`[.env.local] production references: ${prodRefs.length}`); prodRefs.forEach((r) => L.push(`    ${r}`));
L.push(`[.env.local] NODE_ENV set in file: ${"NODE_ENV" in local ? "yes" : "no"}`, "");

// readiness matrix by category: what each integration needs
const cats = {};
for (const v of ENV_REGISTRY) (cats[v.category] ||= []).push(v);
L.push("REGISTRY MATRIX (name | required | scope | secret | set in .env.local | valid)");
for (const [c, vs] of Object.entries(cats)) {
  L.push(`  ${c}`);
  for (const v of vs) { const r = rep.find((x) => x.name === v.name); L.push(`    ${v.name} | ${v.required} | ${v.scope} | ${v.secret ? "secret" : "-"} | ${r.set ? "set" : "unset"} | ${r.set ? (r.valid ? "ok" : "INVALID") : "-"}`); }
}
const out = path.join(root, "reports/evidence/security", `env-readiness-audit-${now.slice(0, 10).replace(/-/g, "")}.log`);
fs.writeFileSync(out, L.join("\n") + "\n");
console.log(L.join("\n"));
