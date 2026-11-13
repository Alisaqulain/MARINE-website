// Fingerprint scanner v2 (10 Nov 2026). Same detection logic as fingerprint-scan.mjs
// (v1, kept unchanged as evidence), plus:
//   * a crash-safe JSONL journal (<log>.journal): every match, coverage gap and
//     finished unit is written to disk immediately, so an interruption (the
//     9 Nov shutdown killed the v1 workers before they wrote anything) loses at
//     most the unit in progress, and a re-run resumes from the journal;
//   * real decompression of archives ("archive:<file>"): extracted into an empty
//     scratch folder, every extracted file scanned on its own (nested archives up
//     to depth 3), then the folder is deleted; failures are recorded, never skipped;
//   * low-memory git ("git:<repo>"): git's pack/delta caches are capped.
//
// Read-only for every scanned location. Nothing secret is printed: the journal
// and log hold only fingerprints (SHA-256, first 10 hex), counts and paths.
//
//   node fingerprint-scan-v2.mjs <log file> <root> [<root> ...]
//   env FP_EXTRA="fp=label;..."  adds synthetic fingerprints (positive controls only)
//   env EXTRACT_BASE=<dir>       where archives are unpacked (default: OS temp)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const TARGETS = {
  "0f74c955cd": "production MONGODB_URI (full value)",
  "443117db38": "production DB password",
  "8328be9d60": "production DB user name",
};
for (const pair of (process.env.FP_EXTRA || "").split(";").filter(Boolean)) {
  const [k, v] = pair.split("="); TARGETS[k] = v;
}
const HOST_MARKERS = ["1za3pdr"]; // production cluster id; not secret, reported separately
const SKIP_DIRS = new Set(["System Volume Information", "WindowsApps", "$WinREAgent"]);
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp4", ".mp3", ".wav", ".woff", ".woff2", ".ttf", ".exe", ".dll", ".pdb", ".node", ".vhdx", ".iso", ".msi"]);
// Compressed containers. "archive": decompressed in the archive phase. "office": zip-based
// documents a person could paste text into; also decompressed. "package": zip-based build /
// install artefacts (jar, apk, ...); listed and counted.
const ARCHIVE_EXT = new Set([".zip", ".7z", ".rar", ".gz", ".tgz", ".tar", ".bz2", ".xz", ".tbz2", ".txz"]);
const OFFICE_EXT = new Set([".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"]);
const PACKAGE_EXT = new Set([".jar", ".war", ".apk", ".aab", ".aar", ".whl", ".nupkg", ".vsix", ".xpi", ".crx", ".egg"]);
const MAX_BYTES = 4e9;
const LARGE = 150e6;
const MAX_NEST = 3;

const fp = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 10);
// "@<file>" reads roots from a file, one per line (Windows limits a command line to 32,767 characters).
const [logFile, ...rawRoots] = process.argv.slice(2);
const roots = rawRoots.flatMap((r) => (r.startsWith("@") ? fs.readFileSync(r.slice(1), "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [r]));
if (!logFile) { console.error("usage: node fingerprint-scan-v2.mjs <log> <root>..."); process.exit(64); }
const journalFile = logFile + ".journal";
const progressFile = logFile + ".progress";
const EXTRACT_BASE = process.env.EXTRACT_BASE || os.tmpdir();

const URI_RE = /mongodb(?:\+srv)?:\/\/[^\s"'`\\<>]+/g;
function candidates(text, out) {
  for (const m of text.matchAll(URI_RE)) {
    const uri = m[0].replace(/[),.;]+$/, "");
    out.add(uri);
    const u = uri.match(/^mongodb(?:\+srv)?:\/\/([^:@/]+):([^@/]+)@/);
    if (u) for (const v of [u[1], u[2]]) { out.add(v); try { out.add(decodeURIComponent(v)); } catch {} }
  }
  for (const tok of text.match(/[A-Za-z0-9\-._~!$&'()*+,;=%]{4,}/g) || []) {
    if (tok.length <= 256) out.add(tok);
    const starts = [0], ends = [tok.length];
    for (let i = 0; i < tok.length && starts.length < 40; i++) if ("=,;&()'*+!$".includes(tok[i])) { starts.push(i + 1); ends.push(i); }
    for (const s of starts) for (const e of ends) if (e - s >= 4 && e - s <= 256) out.add(tok.slice(s, e));
  }
}
// Cache of already-hashed, non-matching candidates (speed only; clearing it never skips a check).
// FP_SEEN_MAX lowers the cap for very large inputs (G2: Flutter's 1.17 M git objects exhausted 3 GB).
const SEEN_MAX = Number(process.env.FP_SEEN_MAX) || 3e6;
const seen = new Set();

// ---- journal ---------------------------------------------------------------
const J = (o) => fs.appendFileSync(journalFile, JSON.stringify({ ts: new Date().toISOString(), ...o }) + "\n");
const done = new Map(); // unit -> done record
const kept = [];        // coverage/hit records of finished units (from earlier runs)
if (fs.existsSync(journalFile)) {
  const recs = fs.readFileSync(journalFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  for (const r of recs) if (r.t === "done") done.set(r.unit, r);
  for (const r of recs) if (r.unit && r.t !== "done" && done.has(r.unit)) kept.push(r);
}
J({ t: "start", pid: process.pid, resumedUnits: done.size, roots });

let unit = null;      // unit being scanned
let C = null;         // counters of the current unit
const newC = () => ({ files: 0, bytes: 0, unreadable: 0, empty: 0, links: 0, skippedExt: {} });
const rec = (t, v) => J({ t, unit, v });
const failed = (p, e) => { C.unreadable++; rec("unreadable", `${p}  [${e?.code || e?.message || "error"}]`); };

let totalFiles = 0, totalBytes = 0, lastBeat = 0;
function progress(force) {
  const now = Date.now();
  if (!force && totalFiles % 5000 !== 0 && now - lastBeat < 60000) return;
  lastBeat = now;
  fs.appendFileSync(progressFile, `${new Date().toISOString()} ${totalFiles} files, ${(totalBytes / 1e6).toFixed(0)} MB (this run) unit=${unit}\n`);
}

function check(text, where) {
  const set = new Set();
  candidates(text, set);
  for (const c of set) {
    if (seen.has(c)) continue;
    const label = TARGETS[fp(c)];
    if (label) J({ t: "hit", unit, label, where });
    else { if (seen.size > SEEN_MAX) seen.clear(); seen.add(c); }
  }
  if (HOST_MARKERS.some((h) => text.includes(h))) J({ t: "host", unit, where });
}
const CHUNK = 4 * 1024 * 1024, OVERLAP = 4096;
const buf = Buffer.alloc(CHUNK + OVERLAP);
const counted = (n) => { C.files++; C.bytes += n; totalFiles++; totalBytes += n; progress(); };

// ctx: null for disk files; {depth, label, stats} for files extracted from an archive.
async function scanFile(file, ctx) {
  const ext = path.extname(file).toLowerCase();
  const where = ctx ? `${ctx.label} :: ${path.relative(ctx.dir, file)}` : file;
  if (SKIP_EXT.has(ext)) { C.skippedExt[ext] = (C.skippedExt[ext] || 0) + 1; return; }
  let st; try { st = fs.statSync(file); } catch (e) { failed(where, e); return; }
  if (!st.isFile()) return;
  if (st.size === 0) { C.empty++; return; }
  if (st.size > MAX_BYTES) { rec("toolarge", `${where}  (${(st.size / 1e6).toFixed(0)} MB)`); return; }
  const kind = ARCHIVE_EXT.has(ext) ? "archive" : OFFICE_EXT.has(ext) ? "office" : PACKAGE_EXT.has(ext) ? "package" : null;
  if (kind) {
    if (!ctx) J({ t: "container", unit, kind, file, size: st.size });
    else if (kind !== "package") { ctx.stats.nested++; if (ctx.depth < MAX_NEST) await scanArchive(file, ctx.depth + 1, where); else failed(where, { message: `nested deeper than ${MAX_NEST}, not decompressed` }); }
    else ctx.stats.nestedPackages++;
  }
  if (st.size > LARGE) rec("large", `${where}  (${(st.size / 1e6).toFixed(0)} MB)`);
  let fd; try { fd = fs.openSync(file, "r"); } catch (e) { failed(where, e); return; }
  try {
    for (let pos = 0; pos < st.size; pos += CHUNK) {
      const n = fs.readSync(fd, buf, 0, CHUNK + OVERLAP, pos);
      if (n <= 0) break;
      check(buf.toString("latin1", 0, n), where);
    }
  } catch (e) { failed(where, e); return; } finally { fs.closeSync(fd); }
  if (ctx) { ctx.stats.scannedFiles++; ctx.stats.scannedBytes += st.size; }
  counted(st.size);
}
async function walk(dir, ctx) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { failed(dir + path.sep, e); return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) { C.links++; continue; }
    if (e.isDirectory()) { if (!ctx && SKIP_DIRS.has(e.name)) rec("skipdir", p); else await walk(p, ctx); }
    else await scanFile(p, ctx);
  }
}
function run(cmd, args, onData) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-4000); });
    child.stdout.on("data", (d) => onData?.(d));
    child.on("error", (e) => resolve({ code: -1, stderr: e.message }));
    child.on("close", (code) => resolve({ code, stderr: stderr.trim() }));
  });
}
// Every git object (all commits, trees, blobs, unreachable included), decompressed, with
// git's memory use capped (delta base cache, mmap windows) so large packs don't exhaust RAM.
async function scanGit(repo) {
  const where = `git objects of ${repo}`;
  let tail = "", n = 0;
  const lowMem = ["-c", "core.deltaBaseCacheLimit=8m", "-c", "core.packedGitWindowSize=1m", "-c", "core.packedGitLimit=64m", "-c", "core.bigFileThreshold=1m", "-c", "safe.directory=*"];
  const { code, stderr } = await run("git", [...lowMem, "-C", repo, "cat-file", "--batch-all-objects", "--batch", "--unordered"], (chunk) => {
    const text = tail + chunk.toString("latin1");
    check(text, where); tail = text.slice(-OVERLAP); n += chunk.length; C.bytes += chunk.length; totalBytes += chunk.length;
  });
  if (code !== 0) { failed(where, { message: `git exit ${code}: ${stderr.split("\n").pop()}` }); J({ t: "git-result", unit, repo, ok: false, bytes: n }); return; }
  C.files++; totalFiles++; J({ t: "git-result", unit, repo, ok: true, bytes: n });
}
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
// Unpacks into an empty scratch folder and scans each extracted file separately.
async function scanArchive(file, depth = 0, label = file) {
  const dir = fs.mkdtempSync(path.join(EXTRACT_BASE, "fpx-"));
  const stats = { scannedFiles: 0, scannedBytes: 0, nested: 0, nestedPackages: 0 };
  let status = "ok", detail = "";
  try {
    const ext = path.extname(file).toLowerCase();
    const plainGz = ext === ".gz" && !/\.tar\.gz$/i.test(file);
    let r = await run(TAR, ["-xf", file, "-C", dir]);
    if (r.code !== 0 && (plainGz || ext === ".bz2" || ext === ".xz")) {
      // Single compressed file (not a tar): decompress the stream itself.
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
      const out = path.join(dir, path.basename(file).replace(/\.(gz|bz2|xz)$/i, "") || "content");
      try {
        if (ext !== ".gz") throw new Error(`no ${ext} stream decoder`);
        await pipeline(fs.createReadStream(file), zlib.createGunzip(), fs.createWriteStream(out));
        r = { code: 0, stderr: "" }; detail = "single-file gzip stream";
      } catch (e) { r = { code: r.code, stderr: `${r.stderr} | stream: ${e.message}` }; }
    }
    if (r.code !== 0) { status = "failed"; detail = r.stderr.split("\n").slice(-2).join(" / "); }
    await walk(dir, { depth, label, dir, stats });
    if (status === "failed" && stats.scannedFiles > 0) status = "partial";
    if (status !== "ok") failed(label, { message: `archive ${status}: ${detail}` });
  } catch (e) { status = "failed"; detail = e.message; failed(label, { message: `archive failed: ${detail}` }); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  J({ t: "archive-result", unit, file: label, depth, status, detail, ...stats });
  if (depth === 0) { C.files++; totalFiles++; }
}

// A root is split into units (its direct children) so a resumed run skips finished parts.
async function runUnit(u, root, fn) {
  if (done.has(u)) return;
  unit = u; C = newC();
  await fn();
  J({ t: "done", unit: u, root, ...C });
  done.set(u, { unit: u, root, ...C });
}
const rootStatus = [];
try {
  for (const r of roots) {
    if (r.startsWith("git:")) await runUnit(r, r, () => scanGit(r.slice(4)));
    else if (r.startsWith("archive:")) await runUnit(r, r, () => scanArchive(r.slice(8)));
    else if (!fs.existsSync(r)) { rootStatus.push(`  ${r}  (does not exist)`); continue; }
    else if (fs.statSync(r).isFile()) await runUnit(r, r, () => scanFile(r));
    else {
      let entries;
      try { entries = fs.readdirSync(r, { withFileTypes: true }); }
      catch (e) { await runUnit(r, r, async () => failed(r + path.sep, e)); continue; }
      for (const e of entries) {
        const p = path.join(r, e.name);
        await runUnit(p, r, async () => {
          if (e.isSymbolicLink()) C.links++;
          else if (e.isDirectory()) { if (SKIP_DIRS.has(e.name)) rec("skipdir", p); else await walk(p); }
          else await scanFile(p);
        });
      }
    }
  }
} catch (e) {
  J({ t: "fatal", unit, error: String(e?.stack || e).slice(0, 2000) });
  progress(true);
  process.exit(2);
}

// ---- final log, built only from the journal ------------------------------------
const recs = fs.readFileSync(journalFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const doneRecs = new Map(); for (const r of recs) if (r.t === "done") doneRecs.set(r.unit, r);
const fin = recs.filter((r) => r.unit && r.t !== "done" && doneRecs.has(r.unit));
const runs = recs.filter((r) => r.t === "start");
const T = newC(); const perRoot = {};
for (const d of doneRecs.values()) {
  for (const k of ["files", "bytes", "unreadable", "empty", "links"]) T[k] += d[k];
  for (const [k, v] of Object.entries(d.skippedExt)) T.skippedExt[k] = (T.skippedExt[k] || 0) + v;
  const pr = (perRoot[d.root] ||= { units: 0, files: 0, bytes: 0, unreadable: 0 });
  pr.units++; pr.files += d.files; pr.bytes += d.bytes; pr.unreadable += d.unreadable;
}
const by = (t) => fin.filter((r) => r.t === t);
const lines = [
  `Scanner: fingerprint-scan-v2.mjs`,
  `Runs: ${runs.length} (first started ${runs[0]?.ts}, PIDs ${runs.map((r) => r.pid).join(", ")})`,
  `Fingerprints searched: ${Object.entries(TARGETS).map(([k, v]) => `${v} = ${k}`).join("; ")}`,
  `Roots:`,
];
for (const r of roots) {
  const pr = perRoot[r];
  lines.push(pr ? `  ${r}  (${pr.units} units, ${pr.files} files, ${(pr.bytes / 1e6).toFixed(0)} MB, ${pr.unreadable} unreadable)` : `  ${r}  (no units)`);
}
lines.push(...rootStatus);
lines.push(`Scanned ${T.files} files, ${(T.bytes / 1e6).toFixed(0)} MB, ${T.unreadable} unreadable entries, ${doneRecs.size} units`);
const extTotal = Object.values(T.skippedExt).reduce((a, b) => a + b, 0);
lines.push("", "COVERAGE");
lines.push(`  Skipped by extension (media / machine code): ${extTotal} files: ${Object.entries(T.skippedExt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
lines.push(`  Skipped empty files: ${T.empty}; links/junctions not followed: ${T.links}`);
const list = (title, t) => { const a = by(t); lines.push(`  ${title}: ${a.length}`); a.forEach((r) => lines.push(`      ${r.v}`)); };
list("Skipped Windows-owned folders", "skipdir");
list(`Files over ${MAX_BYTES / 1e9} GB (not read)`, "toolarge");
list(`Large files read in full (over ${LARGE / 1e6} MB)`, "large");
for (const kind of ["archive", "office", "package"]) {
  const a = by("container").filter((r) => r.kind === kind);
  lines.push(`  Compressed containers, ${kind}: ${a.length} (${(a.reduce((s, r) => s + r.size, 0) / 1e6).toFixed(0)} MB; raw bytes read, contents need the archive phase)`);
  a.forEach((r) => lines.push(`      ${r.file}  (${(r.size / 1e6).toFixed(1)} MB)`));
}
const ar = by("archive-result");
if (ar.length) {
  const cnt = (s) => ar.filter((r) => r.depth === 0 && r.status === s).length;
  lines.push(`  Archives decompressed: ${ar.filter((r) => r.depth === 0).length} top-level (ok ${cnt("ok")}, partial ${cnt("partial")}, failed ${cnt("failed")}), ${ar.filter((r) => r.depth > 0).length} nested`);
  lines.push(`  Extracted files scanned: ${ar.reduce((s, r) => s + r.scannedFiles, 0)}, ${(ar.reduce((s, r) => s + r.scannedBytes, 0) / 1e6).toFixed(0)} MB; nested packages not decompressed: ${ar.reduce((s, r) => s + r.nestedPackages, 0)}`);
  ar.filter((r) => r.status !== "ok").forEach((r) => lines.push(`      ${r.status.toUpperCase()}: ${r.file}  [${r.detail}] (${r.scannedFiles} files scanned)`));
}
const gr = by("git-result");
if (gr.length) lines.push(`  Git object stores: ${gr.length} (read ${gr.filter((r) => r.ok).length}, failed ${gr.filter((r) => !r.ok).length}); ${(gr.reduce((s, r) => s + r.bytes, 0) / 1e6).toFixed(0)} MB of decompressed objects`);
list("Unreadable entries", "unreadable");
lines.push("", "RESULTS (credential fingerprints):");
const hits = {}; for (const h of by("hit")) (hits[h.label] ||= new Set()).add(h.where);
for (const label of Object.values(TARGETS)) {
  const s = hits[label];
  lines.push(`  ${label}: ${s ? `FOUND in ${s.size} file(s)` : "ABSENT"}`);
  if (s) for (const f of s) lines.push(`      ${f}`);
}
const host = new Set(by("host").map((r) => r.where));
lines.push(`  production cluster host marker (not a secret): ${host.size ? `in ${host.size} file(s)` : "absent"}`);
for (const f of host) lines.push(`      ${f}`);
const credFound = [TARGETS["0f74c955cd"], TARGETS["443117db38"]].some((l) => hits[l]);
lines.push("", `RESULT: ${credFound ? "PRODUCTION CREDENTIAL COPY FOUND" : "no copy of the production URI or password found"}`);
lines.push(`SCAN COMPLETED at ${new Date().toISOString()} (a log without this line is from an interrupted run)`);
J({ t: "complete", units: doneRecs.size, files: T.files, bytes: T.bytes });
fs.writeFileSync(logFile, lines.join("\n") + "\n");
progress(true);
console.log(`complete: ${logFile}`);
