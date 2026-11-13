// Read-only scan: where on this machine could a development process find the
// production database credentials? Takes the production values from the
// pre-isolation backup (outside the repository), never prints them, and reports
// counts and file paths only. No database connection is made.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const BACKUP = path.join(os.homedir(), ".marina-env-backup", "env.local.pre-isolation-20261109");
const ROOT = process.cwd();
const fp = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 10);

const backup = fs.readFileSync(BACKUP, "utf8");
const uriLine = backup.split(/\r?\n/).find((l) => /^MONGODB_URI=/.test(l));
const prodUri = uriLine.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");
const m = prodUri.match(/^mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^/?]+)/);
const [, prodUser, prodPassRaw, prodHost] = m;
const prodPass = decodeURIComponent(prodPassRaw);

// What we look for. Values are kept in memory only; the log shows fingerprints.
const needles = [
  { label: "production URI (full)", value: prodUri, secret: true },
  { label: "production DB password", value: prodPass, secret: true },
  { label: "production DB password (URL-encoded)", value: prodPassRaw, secret: true },
  { label: "production DB user name", value: prodUser, secret: true },
  { label: "production cluster host", value: prodHost.split(":")[0], secret: false },
  { label: "production cluster id 1za3pdr", value: "1za3pdr", secret: false },
  { label: "Atlas cluster id a9zxbuj (test-mongo.mjs)", value: "a9zxbuj", secret: false },
].filter((n, i, a) => a.findIndex((x) => x.value === n.value) === i);

const log = [];
const say = (s) => { log.push(s); console.log(s); };
say(`Checked at ${new Date().toISOString()}`);
say(`Production values taken from the backup outside the repository (fingerprints only):`);
for (const n of needles) say(`  ${n.label}: ${n.secret ? "fp " + fp(n.value) : n.value}`);

function scanFile(file, hits) {
  let buf;
  try { const st = fs.statSync(file); if (!st.isFile() || st.size > 20e6) return; buf = fs.readFileSync(file, "latin1"); } catch { return; }
  for (const n of needles) if (buf.includes(n.value)) (hits[n.label] ||= []).push(path.relative(ROOT, file) || file);
}
function walk(dir, hits, skip = new Set()) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  let count = 0;
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skip.has(e.name)) count += walk(p, hits, skip); }
    else { scanFile(p, hits); count++; }
  }
  return count;
}
function report(title, hits, files) {
  say(`\n--- ${title} (${files} files) ---`);
  if (!Object.keys(hits).length) { say("  no production value found"); return; }
  for (const [label, list] of Object.entries(hits)) say(`  ${label}: ${list.length} file(s): ${list.slice(0, 8).join(", ")}${list.length > 8 ? " …" : ""}`);
}

// 1. Environment files the app can load.
{
  const hits = {}; const files = fs.readdirSync(ROOT).filter((f) => /^\.env/.test(f));
  files.forEach((f) => scanFile(path.join(ROOT, f), hits));
  say(`\nEnv files in project root: ${files.join(", ")}`);
  report("1. Project env files", hits, files.length);
}
// 2. Process environment of this shell and the persistent user/machine environment.
{
  const found = needles.filter((n) => Object.values(process.env).some((v) => v && v.includes(n.value)));
  say(`\n--- 2. Environment variables ---`);
  say(`  this process (inherited from the session shell): ${found.length ? found.map((n) => n.label).join(", ") : "no production value"}`);
  for (const scope of ["User", "Machine"]) {
    const out = execSync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariables('${scope}').Values -join [char]10"`, { encoding: "utf8" });
    const f = needles.filter((n) => out.includes(n.value));
    say(`  ${scope} scope: ${f.length ? f.map((n) => n.label).join(", ") : "no production value"}`);
  }
  const mongoVars = Object.keys(process.env).filter((k) => /MONGO|DATABASE_URL/i.test(k));
  say(`  MONGO*/DATABASE_URL variable names in this process: ${mongoVars.length ? mongoVars.join(", ") : "none"}`);
}
// 3. Repository source, scripts, reports and the Next.js build/cache output.
{
  const hits = {}; const n = walk(ROOT, hits, new Set(["node_modules", ".git", ".next"]));
  report("3. Project files (excluding node_modules, .git, .next)", hits, n);
}
{
  const hits = {}; const n = walk(path.join(ROOT, ".next"), hits);
  report("4. .next build and dev cache", hits, n);
}
// 5. Git history: was a production value ever committed?
{
  say(`\n--- 5. Git history ---`);
  for (const nd of needles.filter((x) => x.secret)) {
    let c = "0";
    try { c = execSync(`git log --all -S "${nd.value.replace(/"/g, '\\"')}" --oneline`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").filter(Boolean).length + ""; } catch {}
    say(`  ${nd.label}: in ${c} commit(s)`);
  }
  say(`  .env.local tracked by git: ${execSync("git ls-files .env.local", { encoding: "utf8" }).trim() ? "YES" : "no"}`);
}
// 6. Other copies on this machine outside the repository.
{
  const hits = {}; let n = 0;
  for (const d of [path.join(os.homedir(), ".marina-env-backup"), process.env.TEMP && path.join(process.env.TEMP, "claude")]) if (d) n += walk(d, hits);
  report("6. Outside the repository: env backup folder and session scratchpads", hits, n);
}
fs.writeFileSync(path.join(ROOT, "reports/evidence/security/prod-credential-scan-20261109.log"), log.join("\n") + "\n");
