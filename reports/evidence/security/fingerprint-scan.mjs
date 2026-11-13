// Read-only scan for copies of the old production MongoDB credentials, by
// fingerprint. The plain values no longer exist anywhere we can read them from,
// so every candidate string found on disk is hashed (SHA-256, first 10 hex) and
// compared with the fingerprints recorded on 9 Nov before the backups were
// deleted. Nothing secret is read from a known location and nothing secret is
// printed: the log holds only fingerprints, counts and file paths.
//
//   node fingerprint-scan.mjs <log file> <root> [<root> ...]
//   root "git:<repo>" scans every object in that repository's history.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const TARGETS = {
  "0f74c955cd": "production MONGODB_URI (full value)",
  "443117db38": "production DB password",
  "8328be9d60": "production DB user name",
};
// Positive control only: FP_EXTRA="fp=label;fp=label" adds synthetic fingerprints.
for (const pair of (process.env.FP_EXTRA || "").split(";").filter(Boolean)) {
  const [k, v] = pair.split("="); TARGETS[k] = v;
}
const HOST_MARKERS = ["1za3pdr"]; // cluster id of the production host; not secret, reported separately
// Windows-owned folders only; everything else, node_modules included, is read.
const SKIP_DIRS = new Set(["System Volume Information", "WindowsApps", "$WinREAgent"]);
// Media and machine code can't hold a pasted credential in readable form.
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp4", ".mp3", ".wav", ".woff", ".woff2", ".ttf", ".exe", ".dll", ".pdb", ".node", ".vhdx", ".iso", ".msi"]);
// Compressed archives are read too, but their contents are invisible here; listed for a separate check.
const ARCHIVE_EXT = new Set([".zip", ".7z", ".rar", ".gz", ".tgz", ".tar"]);
const MAX_BYTES = 4e9;
const LARGE = 150e6;

const fp = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 10);
const [logFile, ...roots] = process.argv.slice(2);

// Every way the values could appear: the full URI, its user and password parts
// (raw and URL-decoded), and the password on its own (e.g. KEY=value lines).
const URI_RE = /mongodb(?:\+srv)?:\/\/[^\s"'`\\<>]+/g;
function candidates(text, out) {
  for (const m of text.matchAll(URI_RE)) {
    const uri = m[0].replace(/[),.;]+$/, "");
    out.add(uri);
    const u = uri.match(/^mongodb(?:\+srv)?:\/\/([^:@/]+):([^@/]+)@/);
    if (u) for (const v of [u[1], u[2]]) { out.add(v); try { out.add(decodeURIComponent(v)); } catch {} }
  }
  // The production user name and password needed no percent-encoding (raw ===
  // decoded, checked on 9 Nov), so they consist only of URI-safe ASCII; any
  // other byte is a boundary. This also keeps binary files cheap.
  for (const tok of text.match(/[A-Za-z0-9\-._~!$&'()*+,;=%]{4,}/g) || []) {
    if (tok.length <= 256) out.add(tok);
    // A value can itself contain these separators (e.g. "!"), so try every
    // start just after one and every end just before one, not a plain split.
    const starts = [0], ends = [tok.length];
    for (let i = 0; i < tok.length && starts.length < 40; i++) if ("=,;&()'*+!$".includes(tok[i])) { starts.push(i + 1); ends.push(i); }
    for (const s of starts) for (const e of ends) if (e - s >= 4 && e - s <= 256) out.add(tok.slice(s, e));
  }
}
// Tokens already hashed and not matching; bounded, so memory stays flat.
const seen = new Set();

const hits = {}; // label -> Set(file)
const hostHits = new Set();
let files = 0, bytes = 0, unreadable = 0;
// Everything not read in full is recorded by path, so coverage gaps are explicit.
const unreadableList = [], tooLarge = [], large = [], archives = [], skippedExt = {}, skippedDirs = [];
let links = 0, empty = 0;
const failed = (p, e) => { unreadable++; unreadableList.push(`${p}  [${e?.code || e?.message || "error"}]`); };
function check(text, where) {
  const set = new Set();
  candidates(text, set);
  for (const c of set) {
    if (seen.has(c)) continue;
    const label = TARGETS[fp(c)];
    if (label) (hits[label] ||= new Set()).add(where);
    else { if (seen.size > 3e6) seen.clear(); seen.add(c); }
  }
  if (HOST_MARKERS.some((h) => text.includes(h))) hostHits.add(where);
}
// Large inputs are checked in overlapping chunks so memory stays bounded; the
// overlap is longer than any URI or token we hash, so nothing straddles unseen.
const CHUNK = 4 * 1024 * 1024, OVERLAP = 4096;
function progress() { if (files % 5000 === 0) process.stderr.write(`${new Date().toISOString()} ${files} files, ${(bytes / 1e6).toFixed(0)} MB\n`); }
const buf = Buffer.alloc(CHUNK + OVERLAP);
function scanFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (SKIP_EXT.has(ext)) { skippedExt[ext] = (skippedExt[ext] || 0) + 1; return; }
  let st; try { st = fs.statSync(file); } catch (e) { failed(file, e); return; }
  if (!st.isFile()) return;
  if (st.size === 0) { empty++; return; }
  if (st.size > MAX_BYTES) { tooLarge.push(`${file}  (${(st.size / 1e6).toFixed(0)} MB)`); return; }
  if (ARCHIVE_EXT.has(ext)) archives.push(`${file}  (${(st.size / 1e6).toFixed(1)} MB)`);
  if (st.size > LARGE) large.push(`${file}  (${(st.size / 1e6).toFixed(0)} MB)`);
  let fd; try { fd = fs.openSync(file, "r"); } catch (e) { failed(file, e); return; }
  try {
    for (let pos = 0; pos < st.size; pos += CHUNK) {
      const n = fs.readSync(fd, buf, 0, CHUNK + OVERLAP, pos);
      if (n <= 0) break;
      check(buf.toString("latin1", 0, n), file);
    }
  } catch (e) { failed(file, e); return; } finally { fs.closeSync(fd); }
  files++; bytes += st.size; progress();
}
function walk(dir) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { failed(dir + path.sep, e); return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    // Links and junctions point at folders scanned on their own (e.g. the legacy "Application Data" junctions).
    if (e.isSymbolicLink()) { links++; continue; }
    if (e.isDirectory()) { if (SKIP_DIRS.has(e.name)) skippedDirs.push(p); else walk(p); } else scanFile(p);
  }
}
// Streams a command's stdout through check(); a non-zero exit is recorded as unreadable.
async function scanCommand(cmd, args, where) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d; });
  let tail = "";
  for await (const chunk of child.stdout) {
    const text = tail + chunk.toString("latin1");
    check(text, where);
    tail = text.slice(-OVERLAP);
    bytes += chunk.length;
  }
  const code = await new Promise((res) => (child.exitCode !== null ? res(child.exitCode) : child.on("close", res)));
  if (code !== 0) { failed(where, { message: `${cmd} exit ${code}: ${stderr.trim().split("\n").pop()}` }); return; }
  files++; progress();
}
// Every object (all commits, trees, blobs, including unreachable ones), decompressed.
// safe.directory=*: read-only access to repositories git would otherwise refuse as "dubious ownership".
const scanGit = (repo) => scanCommand("git", ["-c", "safe.directory=*", "-C", repo, "cat-file", "--batch-all-objects", "--batch"], `git objects of ${repo}`);
// Decompressed contents of an archive (Windows bsdtar reads zip, 7z, tar, gz).
// The System32 tar is bsdtar; a GNU tar earlier on PATH (Git for Windows) reads "C:" as a remote host.
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
const scanArchive = (file) => scanCommand(TAR, ["-xOf", file], `contents of ${file}`);

const started = Date.now();
const lines = [`Checked at ${new Date().toISOString()}`, `Fingerprints searched: ${Object.entries(TARGETS).map(([k, v]) => `${v} = ${k}`).join("; ")}`, `Roots:`];
for (const r of roots) {
  const before = files;
  if (r.startsWith("git:")) await scanGit(r.slice(4));
  else if (r.startsWith("archive:")) await scanArchive(r.slice(8));
  else if (fs.existsSync(r)) fs.statSync(r).isFile() ? scanFile(r) : walk(r);
  else { lines.push(`  ${r}  (does not exist)`); continue; }
  lines.push(`  ${r}  (${files - before} files)`);
}
lines.push(`Scanned ${files} files, ${(bytes / 1e6).toFixed(0)} MB, ${unreadable} unreadable entries, ${((Date.now() - started) / 1000).toFixed(0)} s`);
const extTotal = Object.values(skippedExt).reduce((a, b) => a + b, 0);
lines.push("", "COVERAGE");
lines.push(`  Skipped by extension (media / machine code): ${extTotal} files: ${Object.entries(skippedExt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
lines.push(`  Skipped empty files: ${empty}; links/junctions not followed: ${links}`);
lines.push(`  Skipped Windows-owned folders: ${skippedDirs.length}`); skippedDirs.forEach((d) => lines.push(`      ${d}`));
lines.push(`  Files over ${MAX_BYTES / 1e9} GB (not read): ${tooLarge.length}`); tooLarge.forEach((d) => lines.push(`      ${d}`));
lines.push(`  Large files read in full (over ${LARGE / 1e6} MB): ${large.length}`); large.forEach((d) => lines.push(`      ${d}`));
lines.push(`  Compressed archives (read as bytes; compressed contents need a separate check): ${archives.length}`); archives.forEach((d) => lines.push(`      ${d}`));
lines.push(`  Unreadable entries: ${unreadable}`); unreadableList.forEach((d) => lines.push(`      ${d}`));
lines.push("", "RESULTS (credential fingerprints):");
for (const label of Object.values(TARGETS)) {
  const s = hits[label];
  lines.push(`  ${label}: ${s ? `FOUND in ${s.size} file(s)` : "ABSENT"}`);
  if (s) for (const f of s) lines.push(`      ${f}`);
}
lines.push(`  production cluster host marker (not a secret): ${hostHits.size ? `in ${hostHits.size} file(s)` : "absent"}`);
for (const f of hostHits) lines.push(`      ${f}`);
const credFound = [TARGETS["0f74c955cd"], TARGETS["443117db38"]].some((l) => hits[l]);
lines.push("", `RESULT: ${credFound ? "PRODUCTION CREDENTIAL COPY FOUND" : "no copy of the production URI or password found"}`);
lines.push(`SCAN COMPLETED at ${new Date().toISOString()} (a log without this line is from an interrupted run)`);
const text = lines.join("\n");
console.log(text);
if (logFile) fs.writeFileSync(logFile, text + "\n");
