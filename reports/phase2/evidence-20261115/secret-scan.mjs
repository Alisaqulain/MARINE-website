// Read-only secret-pattern scan for the Phase 2 handover (15 Nov 2026).
//   node reports/phase2/evidence-20261115/secret-scan.mjs > reports/phase2/evidence-20261115/secret-scan-results.txt
// Prints file, line and pattern NAME only. Matched text is never printed or stored.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
process.chdir(root);
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).split("\n").filter(Boolean);
const changed = git("diff", "--name-only");
const untracked = git("ls-files", "--others", "--exclude-standard");
const evidenceDirs = ["reports/evidence/phase2/g1", "reports/evidence/phase2/g2", "reports/evidence/phase2/g3", "reports/evidence/phase2/g4local", "reports/evidence/phase2/final"];
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name).replace(/\\/g, "/")])) : []);
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf)$/i;
const all = [...new Set([...changed, ...untracked, ...evidenceDirs.flatMap(walk)])];
const excluded = [];
const files = all.filter((f) => {
  if (BINARY.test(f)) return excluded.push(`${f} (binary image/PDF)`), false;
  if (f === "tsconfig.tsbuildinfo") return excluded.push(`${f} (generated TypeScript build cache)`), false;
  if (f.startsWith("reports/phase2/evidence-20261115/")) return excluded.push(`${f} (this scan's own output folder; git-tracked-changes.diff duplicates the scanned files)`), false;
  return fs.existsSync(f);
});
const PATTERNS = [
  ["MongoDB URI with credentials", /mongodb(\+srv)?:\/\/[^<\s/:@]+:[^<\s@]+@/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["Google OAuth key prefix AQ.", /\bAQ\.[0-9A-Za-z_.-]{30,}/],
  ["Meta access token", /\bEAA[0-9A-Za-z]{30,}/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Bearer token literal", /Bearer [A-Za-z0-9_-]{32,}/],
  ["password= assignment", /\bpassword\s*=\s*["']?[^\s"'&]{8,}/i],
  ["Stripe/PayPal-like live key", /\b(sk|pk|rk)_live_[0-9A-Za-z]{10,}/],
  ["Resend key", /\bre_[0-9A-Za-z]{20,}/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["ya29 OAuth token", /ya29\.[0-9A-Za-z_.-]{20,}/],
];
const findings = [];
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [name, re] of PATTERNS) if (re.test(line)) findings.push({ f, line: i + 1, name, ctx: f === "package-lock.json" ? "lockfile" : "" });
  });
}
console.log(`Secret-pattern scan ${new Date().toISOString()} — values never printed`);
console.log(`Scope: ${files.length} files = git-modified tracked files, untracked non-ignored files, and evidence logs in ${evidenceDirs.join(", ")}`);
console.log(`Not scanned (by design): .env.local and other git-ignored env files (they legitimately hold development values; checked separately for names only), node_modules/, .next/, .git/, the rest of the unchanged repository, the backup folder outside the repository.`);
console.log(`Excluded from the file set: ${excluded.length}`);
for (const e of excluded) console.log(`  - ${e}`);
console.log(`Patterns: ${PATTERNS.map((p) => p[0]).join("; ")}`);
console.log(`\nFindings: ${findings.length}`);
for (const x of findings) console.log(`  ${x.f}:${x.line}  [${x.name}]`);
