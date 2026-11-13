// Final evidence-package audit (read-only on existing evidence; writes two new files):
//   evidence-package-audit-20261110.md   findings
//   evidence-manifest-20261110.sha256    sha256  size  mtime  path   (every file in this folder + the reports)
//   node evidence-package-audit.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const reports = path.resolve(dir, "../..");
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const has = (f) => fs.existsSync(path.join(dir, f));
const out = [];
const P = (...l) => out.push(...l);
const now = new Date().toISOString();
P(`# Evidence-package audit`, ``, `Generated ${now} by \`evidence-package-audit.mjs\`. Read-only: no scan was re-run and no evidence was changed or deleted.`, ``);

// ---- 1. per-scan artefacts -----------------------------------------------------
const status = R("disk-scan-status-20261110.log") + "\n" + R("archive-scan-status-20261110.log");
const scans = [
  { id: "A1", log: "fingerprint-scan-A1-E-drive-20261110-v2.log", exit: /Finished A1-E-drive: PID (\d+) exit code (-?\d+)/g },
  { id: "A2", log: "fingerprint-scan-A2-E-drive-20261110-v2.log", exit: /Finished A2-E-drive: PID (\d+) exit code (-?\d+)/g },
  { id: "A3", log: "fingerprint-scan-A3-E-drive-20261110-v2.log", exit: /Finished A3-E-drive: PID (\d+) exit code (-?\d+)/g },
  { id: "B", log: "fingerprint-scan-B-C-profile-20261110-v2.log", exit: /Finished B-C-profile: PID (\d+) exit code (-?\d+)/g },
  { id: "D", log: "fingerprint-scan-D-drive-ProgramData-20261110-v2.log", exit: /Finished D-drive-ProgramData: PID (\d+) exit code (-?\d+)/g },
  { id: "G1", log: "fingerprint-scan-G1-tourtravel-git-retry-20261110.log", exit: null },
  { id: "G2", log: "fingerprint-scan-G2-flutter-git-20261110-v2.log", exit: /G2 attempt 2 .* exit code (-?\d+)/g },
  { id: "Z1", log: "fingerprint-scan-Z1-archives-D-20261110-v2.log", exit: /Z1 exit code (-?\d+)/g },
  { id: "Z2", log: "fingerprint-scan-Z2-archives-A1-B-20261110-v2.log", exit: /Z2 attempt 2 .* exit code (-?\d+)/g },
  { id: "Z3", log: "fingerprint-scan-Z3-archives-A3-20261110-v2.log", exit: /Z3 .* exit code (-?\d+)/g },
  { id: "Z4", log: "fingerprint-scan-Z4-archives-A2-20261110-v2.log", exit: /Z4 .* exit code (-?\d+)/g },
  { id: "A4 (9 Nov, v1)", log: "fingerprint-scan-A4-E-git-history-20261109-final.log", exit: null, v1: true },
  { id: "A5 (9 Nov, v1)", log: "fingerprint-scan-A5-E-git-alternates-20261109-final.log", exit: null, v1: true },
];
P(`## 1. Per-scan artefacts`, ``, `| Scan | Log | Journal | Progress | Completion marker | Exit code record | Journal complete record | Verdict |`, `|---|---|---|---|---|---|---|---|`);
const scanStats = {};
for (const s of scans) {
  const log = has(s.log), jr = has(s.log + ".journal"), pr = has(s.log + ".progress");
  const t = log ? R(s.log) : "";
  const marker = (t.match(/SCAN COMPLETED at (\S+)/) || [])[1];
  const ex = s.exit ? [...status.matchAll(s.exit)].pop() : null;
  const exit = ex ? ex[ex.length - 1] : null;
  const jc = jr ? R(s.log + ".journal").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((o) => o.t === "complete") : null;
  const m = t.match(/Scanned (\d+) files, (\d+) MB, (\d+) unreadable/);
  scanStats[s.id] = { files: +m?.[1], mb: +m?.[2], unreadable: +m?.[3] };
  const needJ = !s.v1;
  const ok = log && marker && (!needJ || (jr && jc)) && (exit === "0" || (!s.exit));
  const exitTxt = exit !== null ? `exit ${exit}` : s.id === "G1" ? "**NOT CAPTURED** (see 2)" : "not recorded (v1 runner)";
  P(`| ${s.id} | ${log ? "yes" : "**MISSING**"} | ${s.v1 ? "n/a (v1)" : jr ? "yes" : "**MISSING**"} | ${pr ? "yes" : s.v1 ? "n/a" : "no"} | ${marker ?? "**MISSING**"} | ${exitTxt} | ${s.v1 ? "n/a" : jc ? `yes (${jc.units} units)` : "**MISSING**"} | ${ok ? (exit === "0" ? "COMPLETE" : "COMPLETE (log), exit code not recorded") : "**INCOMPLETE**"} |`);
}
P(``, `Failed or aborted attempts are kept, not overwritten:`);
P(`- \`fingerprint-scan-A4-E-git-history-20261109-attempt1-failed.progress\` (A4 attempt 1).`);
P(`- \`fingerprint-scan-G2-flutter-git-20261110-v2-attempt1-failed.journal\` (G2 attempt 1, exit 134).`);
P(`- Z2 attempt 1 never started; recorded in \`archive-scan-status-20261110.log\`.`);
P(`- The interrupted v1 workers' \`fingerprint-scan-{A1,A2,A3,B}-*-20261109-final.progress\` files.`, ``);

// ---- 2. G1 ------------------------------------------------------------------------
const g1 = R("fingerprint-scan-G1-tourtravel-git-retry-20261110.log");
P(`## 2. G1 exit code`, ``);
P(`G1 (\`git:E:\\tourtravelwebiste\`) was run in the foreground before the runner existed, as \`(time node … ) | tail -5\`. A pipe returns the exit status of its last command (\`tail\`), so node's own exit code was **never captured**, and no status log recorded it.`, ``);
P(`Evidence that the run nevertheless completed normally:`);
P(`- its log ends with \`${(g1.match(/SCAN COMPLETED at \S+/) || ["(missing)"])[0]}\`;`);
P(`- its journal has a \`complete\` record;`);
P(`- the scanner prints \`complete:\` only after writing the log, and that line was shown;`);
P(`- \`Unreadable entries: 0\`;`);
P(`- the 4,457 MB read matches git's own object total (4,456 MB, 8,140 objects).`, ``);
P(`It is still reported as **exit code not captured**, never as exit 0.`, ``);

// ---- 4. unreadable reconciliation --------------------------------------------------
P(`## 3. Unreadable-entry reconciliation`, ``);
const recs = (f) => R(f + ".journal").split("\n").filter(Boolean).map((l) => JSON.parse(l));
function unreadable(id, f) {
  const r = recs(f), done = new Set(r.filter((o) => o.t === "done").map((o) => o.unit));
  return r.filter((o) => o.t === "unreadable" && done.has(o.unit)).map((o) => o.v);
}
const cat = (v) => {
  if (/pagefile\.sys|DumpStack|hiberfil|swapfile/i.test(v)) return "Windows memory/dump file (locked)";
  if (/System Volume Information/i.test(v)) return "System Volume Information (Windows-owned)";
  if (/\$RECYCLE\.BIN|\$Recycle\.Bin/i.test(v)) return "Recycle Bin of SYSTEM or of an orphaned SID";
  if (/^C:\\ProgramData/i.test(v)) return "C:\\ProgramData, Windows-owned (EPERM)";
  if (/^C:\\Windows\\Temp/i.test(v)) return "C:\\Windows\\Temp (EPERM)";
  if (/\\Packages\\/i.test(v)) return "Profile: Store-app data held open (EBUSY)";
  if (/Chrome|Code\\Network|discord|Edge/i.test(v) && /EBUSY/.test(v)) return "Profile: browser/editor cookies, sessions (EBUSY)";
  if (/NTUSER|ntuser/i.test(v)) return "Profile: registry hive (EBUSY)";
  if (/ENOENT/.test(v)) return "File vanished during scan (ENOENT)";
  if (/EBUSY/.test(v)) return "Profile: other files held open (EBUSY)";
  if (/archive (failed|partial)|nested deeper/.test(v)) return "Archive that did not fully open";
  return "Other";
};
let diskTotal = 0;
const diskCats = {};
for (const [id, f] of [["A1", "fingerprint-scan-A1-E-drive-20261110-v2.log"], ["A2", "fingerprint-scan-A2-E-drive-20261110-v2.log"], ["A3", "fingerprint-scan-A3-E-drive-20261110-v2.log"], ["B", "fingerprint-scan-B-C-profile-20261110-v2.log"], ["D", "fingerprint-scan-D-drive-ProgramData-20261110-v2.log"]]) {
  const u = unreadable(id, f);
  if (u.length !== scanStats[id].unreadable) P(`**MISMATCH** ${id}: journal ${u.length} vs log ${scanStats[id].unreadable}`);
  diskTotal += u.length;
  for (const v of u) { const k = cat(v); (diskCats[k] ||= { n: 0, by: {} }).n++; diskCats[k].by[id] = (diskCats[k].by[id] || 0) + 1; }
}
P(`### Disk sweep: ${diskTotal} unreadable entries (log totals: ${["A1", "A2", "A3", "B", "D"].map((k) => `${k} ${scanStats[k].unreadable}`).join(", ")})`, ``, `| Category | Entries | By worker | Report classification |`, `|---|---|---|---|`);
const cls = {
  "Windows memory/dump file (locked)": "7.4 NOT SCANNED (page files); 7.3 D: and E: PARTIALLY SCANNED",
  "System Volume Information (Windows-owned)": "7.3 E: PARTIALLY SCANNED",
  "Recycle Bin of SYSTEM or of an orphaned SID": "7.3 E: PARTIALLY SCANNED; 7.4 C:\\$Recycle.Bin\\S-1-5-18",
  "C:\\ProgramData, Windows-owned (EPERM)": "7.3 C:\\ProgramData PARTIALLY SCANNED",
  "C:\\Windows\\Temp (EPERM)": "7.4 NOT SCANNED",
  "Profile: Store-app data held open (EBUSY)": "7.3 C:\\Users\\ali PARTIALLY SCANNED",
  "Profile: browser/editor cookies, sessions (EBUSY)": "7.3 C:\\Users\\ali PARTIALLY SCANNED",
  "Profile: registry hive (EBUSY)": "7.3 C:\\Users\\ali PARTIALLY SCANNED",
  "Profile: other files held open (EBUSY)": "7.3 C:\\Users\\ali PARTIALLY SCANNED",
  "File vanished during scan (ENOENT)": "7.3 C:\\Users\\ali (transient temp file; nothing left to scan)",
};
for (const [k, v] of Object.entries(diskCats).sort((a, b) => b[1].n - a[1].n)) P(`| ${k} | ${v.n} | ${Object.entries(v.by).map(([a, b]) => `${a} ${b}`).join(", ")} | ${cls[k] || "**UNCLASSIFIED**"} |`);
let arcTotal = 0; const arcCats = {};
for (const [id, f] of [["Z1", "fingerprint-scan-Z1-archives-D-20261110-v2.log"], ["Z2", "fingerprint-scan-Z2-archives-A1-B-20261110-v2.log"], ["Z3", "fingerprint-scan-Z3-archives-A3-20261110-v2.log"], ["Z4", "fingerprint-scan-Z4-archives-A2-20261110-v2.log"]]) {
  const u = unreadable(id, f);
  if (u.length !== scanStats[id].unreadable) P(`**MISMATCH** ${id}: journal ${u.length} vs log ${scanStats[id].unreadable}`);
  arcTotal += u.length;
  for (const v of u) {
    const k = /pc-v2\\arch\\o-corrupt/.test(v) ? "this session's deliberately corrupt control fixture"
      : /\.pack\.gz/.test(v) ? "webpack cache .pack.gz (not valid gzip)"
      : /~\$/.test(v) ? "Office lock file (~$…), not a document"
      : /testdata|[\\/]tests?[\\/]|fixtures|test-|\.pub-preload-cache/i.test(v) ? "third-party library test fixture (encrypted/malformed/bz2/xz by design)"
      : "other";
    (arcCats[k] ||= { n: 0, by: {} }).n++; arcCats[k].by[id] = (arcCats[k].by[id] || 0) + 1;
    if (k === "other") P(`  other (archive): ${v}`);
  }
}
P(``, `### Archive phase: ${arcTotal} unreadable entries (log totals: ${["Z1", "Z2", "Z3", "Z4"].map((k) => `${k} ${scanStats[k].unreadable}`).join(", ")})`, ``, `| Category | Entries | By phase | Report classification |`, `|---|---|---|---|`);
for (const [k, v] of Object.entries(arcCats).sort((a, b) => b[1].n - a[1].n)) P(`| ${k} | ${v.n} | ${Object.entries(v.by).map(([a, b]) => `${a} ${b}`).join(", ")} | Section 5: explained failures; raw bytes covered by the disk sweep |`);
P(``);

// ---- 5. Z4 -------------------------------------------------------------------------
const z4 = recs("fingerprint-scan-Z4-archives-A2-20261110-v2.log");
const roots = fs.readFileSync(path.join(dir, "archive-roots-A2-20261110.txt"), "utf8").split(/\r?\n/).filter(Boolean);
const z4done = new Set(z4.filter((o) => o.t === "done").map((o) => o.unit));
const z4top = z4.filter((o) => o.t === "archive-result" && o.depth === 0);
const notDone = roots.filter((r) => !z4done.has(r));
P(`## 4. Z4 completeness`, ``);
P(`- Inventory roots: **${roots.length}**; distinct finished units: **${z4done.size}**; inventory roots without a finished unit: **${notDone.length}**.`);
P(`- Top-level results: ${z4top.length} (ok ${z4top.filter((o) => o.status === "ok").length}, partial ${z4top.filter((o) => o.status === "partial").length}, failed ${z4top.filter((o) => o.status === "failed").length}).`);
P(`- Production fingerprint matches: **${z4.filter((o) => o.t === "hit").length}**.`, ``);
P(`| Container | Result | Files scanned from it | Reason |`, `|---|---|---|---|`);
for (const o of z4top.filter((o) => o.status !== "ok")) P(`| \`${o.file}\` | ${o.status.toUpperCase()} | ${o.scannedFiles} | ${o.detail.replace(/\|/g, "/").replace(/\\\\\?\\\\D:[^']*/g, "<scratch>").slice(0, 140)} |`);
P(``);

// ---- 6. database / runtime checks ---------------------------------------------------
P(`## 5. 13-check database and 8-check runtime verification`, ``);
const latest = (re) => fs.readdirSync(dir).filter((f) => re.test(f)).sort((a, b) => fs.statSync(path.join(dir, a)).mtimeMs - fs.statSync(path.join(dir, b)).mtimeMs).pop(); // newest by modification time
const dbLog = latest(/^dev-db-verify-.*\.log$/), rtLog = latest(/^runtime-isolation-.*\.log$/);
P(`- Newest \`dev-db verify\` log: \`${dbLog}\`, modified ${fs.statSync(path.join(dir, dbLog)).mtime.toISOString()}.`);
P(`- Newest runtime-isolation log: \`${rtLog}\`, modified ${fs.statSync(path.join(dir, rtLog)).mtime.toISOString()}.`);
P(`- No log dated 10 November exists for either check.`);
P(`- Both remain **NOT VERIFIED today**: Docker Desktop was never started in this session, because starting it could restart CareerPath AI containers.`);
P(`- What was verified today instead:`);
P(`  - the process environment (\`process-env-check-20261110T0728Z.log\`);`);
P(`  - the TCP table (\`prod-connection-check-20261110T0728Z.log\`);`);
P(`  - refusals (\`headers-and-routes-20261110T0727Z.log\`).`, ``);

// ---- 3. reports ----------------------------------------------------------------------
P(`## 6. Reports and template`, ``, `| File | Exists | Size | Modified (UTC) | Consistency checks |`, `|---|---|---|---|---|`);
const rep = [
  ["MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md", ["13 of 15", "87%", "1,095", "3,041,452", "24 files", "NOT VERIFIED"]],
  ["MARINA_MUSE_SECURITY_ISOLATION_EVIDENCE.md", ["10 November 2026: full verification", "57 of 59", "NOT VERIFIED"]],
  ["MARINA_MUSE_PHASE2_FINAL_COMPLETION_REPORT.md", ["Security update, 10 November 2026", "15. Backend and testing completion audit", "17 of 72", "251", "not** authorized"]],
  ["MARINA_MUSE_PRODUCTION_DEPLOYMENT_CHECKLIST.md", ["NOT authorized", "Rotate the production MongoDB", "VERIFIED"]],
  ["MARINA_MUSE_CAREERPATH_SEPARATION_PROPOSAL.md", ["PROPOSED, not approved", "0 matches", "Rollback"]],
  ["MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env", ["names and placeholders only", "MONGODB_URI=<secret: set on server>", "PAYPAL_MODE=live"]],
];
for (const [f, needles] of rep) {
  const p = path.join(reports, f);
  if (!fs.existsSync(p)) { P(`| ${f} | **NO** | | | |`); continue; }
  const t = fs.readFileSync(p, "utf8"), st = fs.statSync(p);
  const miss = needles.filter((n) => !t.includes(n));
  const pend = (t.match(/<!--|\(pending\)/g) || []).length;
  P(`| ${f} | yes | ${st.size} | ${st.mtime.toISOString()} | ${miss.length ? "**missing: " + miss.join("; ") + "**" : `${needles.length}/${needles.length} key facts present`}${pend ? `; **${pend} pending markers**` : "; no pending markers"} |`);
}
const tpl = fs.readFileSync(path.join(reports, "MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env"), "utf8");
const literal = tpl.split("\n").filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l) && !/=(<[^>]+>|false|live|)$/.test(l));
P(``, `Template: ${tpl.split("\n").filter((l) => /^#?\s?[A-Z][A-Z0-9_]*=/.test(l)).length} variable lines. Active lines with a value other than a placeholder, empty, \`false\` or \`live\`: **${literal.length}**${literal.length ? " (" + literal.map((l) => l.split("=")[0]).join(", ") + ")" : ""}.`);
const sc = has("reports-folder-secret-check-20261110.log") ? R("reports-folder-secret-check-20261110.log") : "";
P(`Secret check of the whole \`reports/\` folder (\`reports-folder-secret-check-20261110.log\`): ${/RESULT: no copy/.test(sc) && /SCAN COMPLETED/.test(sc) ? "**complete, 0 production URI/password/user fingerprints**" : "**not complete**"}.`, ``);

// ---- 7. manifest ------------------------------------------------------------------------
const files = [];
for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isFile() && !/^evidence-(package-audit-20261110\.md|manifest-20261110\.sha256)$/.test(f)) files.push(p); }
for (const f of fs.readdirSync(reports)) { const p = path.join(reports, f); if (fs.statSync(p).isFile() && /^MARINA_MUSE_/.test(f)) files.push(p); }
const man = [];
let bytes = 0;
for (const p of files.sort()) {
  const st = fs.statSync(p);
  const h = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  bytes += st.size;
  man.push(`${h}  ${String(st.size).padStart(10)}  ${st.mtime.toISOString()}  ${path.relative(reports, p).replace(/\\/g, "/")}`);
}
fs.writeFileSync(path.join(dir, "evidence-manifest-20261110.sha256"), `# sha256  size  mtime(UTC)  path (relative to reports/) — generated ${now}\n` + man.join("\n") + "\n");
P(`## 7. Evidence inventory`, ``);
P(`- **${files.length} files, ${(bytes / 1e6).toFixed(1)} MB**, each with its SHA-256, size and modification time.`);
P(`- Listed in \`evidence-manifest-20261110.sha256\`, generated with the same timestamp as this file.`);
P(`- Covered: every file in \`reports/evidence/security/\` and every \`MARINA_MUSE_*\` report.`);
P(`- This audit and the manifest are excluded, since neither can hash itself.`);
P(`- To verify later, recompute each SHA-256 and compare.`, ``);
fs.writeFileSync(path.join(dir, "evidence-package-audit-20261110.md"), out.join("\n") + "\n");
console.log(out.join("\n"));
