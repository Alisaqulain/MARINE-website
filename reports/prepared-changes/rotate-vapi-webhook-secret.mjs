// Rotates VAPI_WEBHOOK_SECRET for the Marina Muse Assistant only. Prepared 9 Nov 2026; see
// reports/MARINA_MUSE_WEBHOOK_SECRET_ROTATION_GUIDE.md for the full procedure.
//
//   node reports/prepared-changes/rotate-vapi-webhook-secret.mjs --check           read-only prerequisites
//   node reports/prepared-changes/rotate-vapi-webhook-secret.mjs --apply           update Marina's webhook header in Vapi
//   node reports/prepared-changes/rotate-vapi-webhook-secret.mjs --verify <url>    new secret accepted, previous rejected
//
// Secrets are read from .env.local and never printed: only SHA-256 prefixes appear in output.
// Riley and every other assistant are never written. Production is not touched.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
createRequire(path.join(ROOT, "package.json"))("@next/env").loadEnvConfig(ROOT, true, { info() {}, error() {} });

const MARINA = "e0bf7b4e-dcb0-4be1-8f3f-c41f1512ee4d";
const RILEY = "c9069498-818d-4f78-95be-3ee571a98abc";
const RILEY_SHA256 = "9b7c0c6bec803d5c9d204255a42e59505b2f60fe62b8a17453edd201ebd4e716"; // baseline 8 Nov 2026
const key = process.env.VAPI_API_KEY || "";
const current = process.env.VAPI_WEBHOOK_SECRET || "";
const next = process.env.VAPI_WEBHOOK_SECRET_NEXT || "";
const previous = process.env.VAPI_WEBHOOK_SECRET_PREVIOUS || "";
const fp = (s) => (s ? createHash("sha256").update(s).digest("hex").slice(0, 10) : "(none)");
const sha = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex");
const fail = (msg) => { console.log(`STOP: ${msg}`); process.exit(1); };
const vapi = async (p, init = {}) => {
  const r = await fetch(`https://api.vapi.ai${p}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const headerValues = (a) => [a?.server?.headers?.["x-vapi-secret"], ...(a?.model?.tools || []).map((t) => t?.server?.headers?.["x-vapi-secret"])];
const placeholder = (v) => /^(your|change|example|placeholder|<|x{6,})/i.test(v) || /VAPI_WEBHOOK_SECRET/i.test(v);

async function rileyUnchanged() {
  const r = await vapi(`/assistant/${RILEY}`);
  const ok = r.status === 200 && sha(r.data) === RILEY_SHA256;
  console.log(`Riley: HTTP ${r.status}, sha256 ${r.status === 200 ? sha(r.data).slice(0, 10) : "-"}, unchanged: ${ok}`);
  return ok;
}

const mode = process.argv[2] || "--check";
if (!key) fail("VAPI_API_KEY is not set.");

if (mode === "--check" || mode === "--apply") {
  console.log(`current secret: set ${!!current}, fp ${fp(current)} | next secret: set ${!!next}, fp ${fp(next)}`);
  const marina = await vapi(`/assistant/${MARINA}`);
  if (marina.status !== 200) fail(`Marina assistant read failed (HTTP ${marina.status}).`);
  const stored = headerValues(marina.data);
  console.log(`Marina: ${marina.data.name}, version ${marina.data.latestVersion}, webhook ${marina.data.server?.url}`);
  console.log(`Marina stored header fps: ${stored.map(fp).join(", ")} | all equal current: ${stored.every((v) => v === current)}`);
  const riley = await rileyUnchanged();
  const problems = [
    !next && "VAPI_WEBHOOK_SECRET_NEXT is not set in .env.local (the client has not provided the replacement yet)",
    next && next.length < 32 && "VAPI_WEBHOOK_SECRET_NEXT is shorter than 32 characters",
    next && placeholder(next) && "VAPI_WEBHOOK_SECRET_NEXT looks like placeholder text",
    next && next === current && "VAPI_WEBHOOK_SECRET_NEXT equals the current secret",
    !stored.every((v) => v === current) && "Marina's stored header does not match the current secret; investigate before rotating",
    !riley && "Riley differs from the recorded baseline; stop and investigate",
  ].filter(Boolean);
  if (problems.length) fail(problems.join("; "));
  if (mode === "--check") { console.log("READY: prerequisites met. Nothing was changed."); process.exit(0); }

  // --apply: replace only the header value; everything else is copied from the live configuration.
  const before = marina.data;
  const swap = (s) => (s?.headers ? { ...s, headers: { ...s.headers, "x-vapi-secret": next } } : s);
  const body = { server: swap(before.server), model: { ...before.model, tools: (before.model.tools || []).map((t) => ({ ...t, server: swap(t.server) })) } };
  const r = await vapi(`/assistant/${MARINA}`, { method: "PATCH", body: JSON.stringify(body) });
  if (r.status !== 200) fail(`PATCH failed (HTTP ${r.status}). Nothing else was attempted.`);
  const after = (await vapi(`/assistant/${MARINA}`)).data;
  const strip = (a) => JSON.parse(JSON.stringify({ ...a, updatedAt: 0, latestVersion: 0, server: { ...a.server, headers: {} }, model: { ...a.model, tools: (a.model.tools || []).map((t) => ({ ...t, server: { ...t.server, headers: {} } })) } }));
  console.log(`after: version ${after.latestVersion}, header fps ${headerValues(after).map(fp).join(", ")}, all equal next: ${headerValues(after).every((v) => v === next)}`);
  console.log(`only the header changed: ${sha(strip(before)) === sha(strip(after))}`);
  await rileyUnchanged();
  console.log("Next: in .env.local rename VAPI_WEBHOOK_SECRET -> VAPI_WEBHOOK_SECRET_PREVIOUS and VAPI_WEBHOOK_SECRET_NEXT -> VAPI_WEBHOOK_SECRET, restart the dev server, then run --verify.");
  process.exit(0);
}

if (mode === "--verify") {
  const url = (process.argv[3] || "http://localhost:3918").replace(/\/$/, "") + "/api/ai/voice/webhook";
  if (!previous) fail("VAPI_WEBHOOK_SECRET_PREVIOUS is not set (needed to prove the old secret is rejected).");
  const call = async (secret) => (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { "x-vapi-secret": secret } : {}) }, body: JSON.stringify({ message: { type: "tool-calls", call: { id: "rotation-check", type: "webCall" }, toolCallList: [{ id: "t", type: "function", function: { name: "lookup_product", arguments: { query: "anchor" } } }] } }) })).status;
  const [n, o, none] = [await call(current), await call(previous), await call("")];
  console.log(`local webhook ${url}: new secret -> ${n} (want 200), previous -> ${o} (want 401), none -> ${none} (want 401)`);
  // Neither secret may appear in reports, docs, evidence or the dev server's build output logs.
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.git$|\.next/.test(p)) walk(p); } else if (/\.(md|log|txt|json|html|mjs|mts|ts|tsx)$/.test(e.name) && fs.statSync(p).size < 5e6) { const t = fs.readFileSync(p, "utf8"); if (t.includes(current) || t.includes(previous)) hits.push(path.relative(ROOT, p)); } } };
  for (const d of ["reports", "docs", "app", "lib", "components", "scripts"]) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  console.log(`files containing either secret: ${hits.length ? hits.join(", ") : "none"}`);
  const ok = n === 200 && o === 401 && none === 401 && !hits.length;
  console.log(ok ? "VERIFIED. Now delete the VAPI_WEBHOOK_SECRET_PREVIOUS line from .env.local." : "NOT VERIFIED: see above.");
  process.exit(ok ? 0 : 1);
}
fail(`unknown mode ${mode}`);
