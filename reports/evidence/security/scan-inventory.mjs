// Builds the coverage inventory for the security report directly from the scan logs and
// journals, so every total in the report can be traced to a log line. No values are read
// from any scanned file. Output: scan-inventory-<date>.md (markdown tables) + console.
//   node scan-inventory.mjs
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")).replace(/%20/g, " ");
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const exists = (f) => fs.existsSync(path.join(dir, f));
const status = (exists("disk-scan-status-20261110.log") ? R("disk-scan-status-20261110.log") : "") + "\n" + (exists("archive-scan-status-20261110.log") ? R("archive-scan-status-20261110.log") : "");

const scans = [
  ["A1", "E: section 1 (40 top-level entries)", "fingerprint-scan-A1-E-drive-20261110-v2.log", /Finished A1-E-drive: PID (\d+) exit code (-?\d+)/],
  ["A2", "E: section 2 (40 top-level entries)", "fingerprint-scan-A2-E-drive-20261110-v2.log", /Finished A2-E-drive: PID (\d+) exit code (-?\d+)/],
  ["A3", "E: section 3 (39 top-level entries)", "fingerprint-scan-A3-E-drive-20261110-v2.log", /Finished A3-E-drive: PID (\d+) exit code (-?\d+)/],
  ["B", "Windows profile, C: Recycle Bin, C:\\Windows\\Temp, C:\\Users\\Public", "fingerprint-scan-B-C-profile-20261110-v2.log", /Finished B-C-profile: PID (\d+) exit code (-?\d+)/],
  ["D", "D:\\ and C:\\ProgramData", "fingerprint-scan-D-drive-ProgramData-20261110-v2.log", /Finished D-drive-ProgramData: PID (\d+) exit code (-?\d+)/],
  ["G1", "git history retry: E:\\tourtravelwebiste", "fingerprint-scan-G1-tourtravel-git-retry-20261110.log", null],
  ["G2", "git history: D:\\src\\flutter (only repository on C: profile / D:)", "fingerprint-scan-G2-flutter-git-20261110-v2.log", /G2 .* exit code (-?\d+)/],
  ["Z1", "archives found by D", "fingerprint-scan-Z1-archives-D-20261110-v2.log", /Z1 exit code (-?\d+)/],
  ["Z2", "archives found by A1 + B", "fingerprint-scan-Z2-archives-A1-B-20261110-v2.log", /Z2 attempt 2 .* exit code (-?\d+)/],
  ["Z3", "archives found by A3", "fingerprint-scan-Z3-archives-A3-20261110-v2.log", /Z3 .* exit code (-?\d+)/],
  ["Z4", "archives found by A2", "fingerprint-scan-Z4-archives-A2-20261110-v2.log", /Z4 .* exit code (-?\d+)/],
  ["A4", "git history, 130 repositories (9 Nov, v1)", "fingerprint-scan-A4-E-git-history-20261109-final.log", null],
  ["A5", "git object stores git refused (9 Nov, v1)", "fingerprint-scan-A5-E-git-alternates-20261109-final.log", null],
];
const md = ["| Scan | Scope | Files | MB | Unreadable | Exit code | Completed (UTC) | Credential matches |", "|---|---|---|---|---|---|---|---|"];
const rows = [];
for (const [id, scope, log, re] of scans) {
  if (!exists(log)) { md.push(`| ${id} | ${scope} | — | — | — | — | **NOT COMPLETE (no log)** | — |`); rows.push({ id, complete: false }); continue; }
  const t = R(log);
  const m = t.match(/Scanned (\d+) files, (\d+) MB, (\d+) unreadable/);
  const done = (t.match(/SCAN COMPLETED at (\S+)/) || [])[1];
  // last matching status line = final attempt (earlier failed attempts stay in the status log)
  const e = re ? [...status.matchAll(new RegExp(re.source, "g"))].pop() || null : null;
  const exit = e ? e[e.length - 1] : "not recorded (log has SCAN COMPLETED)";
  const res = t.match(/RESULTS \(credential fingerprints\):\n([\s\S]*?)\n\s*production cluster host marker/);
  const found = [];
  if (res) for (const l of res[1].split("\n")) { const f = l.match(/^  (production [^:]+|CONTROL [^:]+): FOUND in (\d+)/); if (f) found.push(`${f[1].replace("production ", "")}: ${f[2]}`); }
  md.push(`| ${id} | ${scope} | ${m?.[1] ?? "?"} | ${m?.[2] ?? "?"} | ${m?.[3] ?? "?"} | ${exit} | ${done ?? "**INTERRUPTED**"} | ${found.length ? found.join("; ") : "none"} |`);
  rows.push({ id, files: +m?.[1], mb: +m?.[2], unreadable: +m?.[3], exit, done, found });
}
const disk = rows.filter((r) => ["A1", "A2", "A3", "B", "D"].includes(r.id) && r.files);
const arch = rows.filter((r) => /^Z/.test(r.id) && r.files);
const sum = (a, k) => a.reduce((s, r) => s + (r[k] || 0), 0);
md.push("", `Disk sweep totals (A1–A3, B, D): ${sum(disk, "files")} files, ${sum(disk, "mb")} MB, ${sum(disk, "unreadable")} unreadable entries.`);
md.push(`Archive phase totals (Z1–Z4): ${sum(arch, "files")} files (extracted + containers), ${sum(arch, "mb")} MB, ${sum(arch, "unreadable")} unreadable entries.`);

// distinct matched files per label, across all v2 journals
const hits = new Map();
for (const f of fs.readdirSync(dir).filter((f) => /-20261110(-v2)?\.log\.journal$/.test(f) && !/positive-control/.test(f)))
  for (const l of R(f).split("\n").filter(Boolean)) { const o = JSON.parse(l); if (o.t === "hit") { if (!hits.has(o.where)) hits.set(o.where, new Set()); hits.get(o.where).add(o.label); } }
md.push("", `Distinct files with a production fingerprint match: ${hits.size}`, "", "| File | Fingerprints matched |", "|---|---|");
for (const [w, s] of [...hits].sort()) md.push(`| \`${w}\` | ${[...s].map((x) => x.replace("production ", "")).join(", ")} |`);
const out = path.join(dir, "scan-inventory-20261110.md");
fs.writeFileSync(out, md.join("\n") + "\n");
console.log(md.join("\n"));
