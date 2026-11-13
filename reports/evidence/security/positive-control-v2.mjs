// Positive / negative controls for fingerprint-scan-v2.mjs. SYNTHETIC values only:
// nothing here is, or is derived from, a real credential.
//   node positive-control-v2.mjs <work dir (empty scratch folder)> <log file>
// Builds a fixture set, runs the scanner with the synthetic fingerprints added, and
// checks every expected detection (and every expected non-detection) against the log.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [work, logFile] = process.argv.slice(2);
const fp = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 10);
const USER = "ctrl_usr_7Qx", PASS = "Cz9!pQ-2vLm_8tR";
const URI = `mongodb+srv://${USER}:${PASS}@ctrl0.zz9test.example/ctrl?retryWrites=true`;
const NEAR = "Cz9!pQ-2vLm_8tS"; // one character different: must NOT match
const FP_EXTRA = `${fp(URI)}=CONTROL uri;${fp(PASS)}=CONTROL password;${fp(USER)}=CONTROL user`;
const TAR = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
const scanner = path.join(path.dirname(fileURLToPath(import.meta.url)), "fingerprint-scan-v2.mjs");

fs.rmSync(work, { recursive: true, force: true });
const D = (...p) => path.join(work, ...p);
fs.mkdirSync(D("disk"), { recursive: true }); fs.mkdirSync(D("src"), { recursive: true }); fs.mkdirSync(D("arch"), { recursive: true }); fs.mkdirSync(D("x"), { recursive: true });
const W = (p, s) => fs.writeFileSync(p, s);
const filler = (n) => Buffer.alloc(n, "abcdefgh ").toString("latin1").slice(0, n);

// 1. Normal environment files
W(D("disk", "a.env"), `# sample\nNODE_ENV=development\nMONGODB_URI=${URI}\n`);
W(D("disk", ".env.local"), `DB_PASSWORD=${PASS}\nDB_USER="${USER}"\n`);
// 2. JSON and transcript (JSONL with escaped strings, as in Claude / chat transcripts)
W(D("disk", "b.json"), JSON.stringify({ config: { mongo: URI } }, null, 2));
W(D("disk", "c-transcript.jsonl"), [{ role: "user", content: `my db password is ${PASS} pls fix` }, { role: "tool", content: `cat .env\nMONGODB_URI=\"${URI}\"` }].map((o) => JSON.stringify(o)).join("\n"));
// 3. JavaScript strings
W(D("disk", "d.js"), `const user = '${USER}';\nconst uri = \`${URI}\`;\nmodule.exports={p:"${PASS}"};\n`);
// 4. Chunk boundaries: the value straddles the 4 MiB read boundary (and a second at 8 MiB)
const CH = 4 * 1024 * 1024;
W(D("disk", "e-boundary-uri.log"), filler(CH - 20) + " " + URI + " " + filler(200));
W(D("disk", "f-boundary-pass.log"), filler(2 * CH - 7) + "=" + PASS + "\n" + filler(100));
// 5. Negative controls: near-miss value, and the password split by a line break
W(D("disk", "g-negative.txt"), `PASSWORD=${NEAR}\nhalf=${PASS.slice(0, 7)}\n${PASS.slice(7)}\n`);

// 6. Archives (contents must be found only by decompression; raw bytes checked below)
W(D("src", "inner.env"), `MONGODB_URI=${URI}\n` + filler(5000));
W(D("src", "only-pass.txt"), `token=${PASS}\n` + filler(5000));
const tar = (args) => execFileSync(TAR, args, { cwd: D("src") });
tar(["-a", "-cf", D("arch", "h.zip"), "inner.env"]);
tar(["-czf", D("arch", "i.tar.gz"), "only-pass.txt"]);
tar(["-cf", D("arch", "j.tar"), "only-pass.txt"]);
let sevenZ = true; try { tar(["--format", "7zip", "-cf", D("arch", "k.7z"), "inner.env"]); } catch { sevenZ = false; }
W(D("arch", "l-single.txt.gz"), zlib.gzipSync(Buffer.from(`user=${USER}\n` + filler(5000))));
// nested: a zip inside a zip
fs.copyFileSync(D("arch", "h.zip"), D("src", "nested-inner.zip"));
tar(["-a", "-cf", D("arch", "m-nested.zip"), "nested-inner.zip"]);
// office document (zip container) with the value in its XML
fs.mkdirSync(D("src", "word"), { recursive: true });
W(D("src", "word", "document.xml"), `<w:document><w:t>password: ${PASS}</w:t>${filler(3000)}</w:document>`);
tar(["-a", "-cf", D("arch", "n-doc.zip"), "word"]); fs.renameSync(D("arch", "n-doc.zip"), D("arch", "n-doc.docx"));
// corrupt archive: must be reported FAILED, never silently skipped
W(D("arch", "o-corrupt.zip"), Buffer.concat([Buffer.from("PK\x03\x04"), crypto.randomBytes(2000)]));
// (.tar is uncompressed by design, so its raw bytes are expected to hold the plaintext.)
const rawLeaks = fs.readdirSync(D("arch")).filter((f) => !f.endsWith(".tar")).filter((f) => { const b = fs.readFileSync(D("arch", f)).toString("latin1"); return b.includes(PASS) || b.includes(USER); });

// 7. Git history: the value is committed, then removed (only history holds it)
const repo = D("repo");
fs.mkdirSync(repo);
const git = (...a) => execFileSync("git", ["-C", repo, "-c", "user.name=ctrl", "-c", "user.email=ctrl@example.invalid", ...a]);
git("init", "-q"); W(path.join(repo, "cfg.js"), `export const u = "${URI}";\n`); git("add", "."); git("commit", "-q", "-m", "add");
W(path.join(repo, "cfg.js"), "export const u = process.env.MONGODB_URI;\n"); git("commit", "-q", "-am", "remove");

const archives = fs.readdirSync(D("arch")).map((f) => `archive:${D("arch", f)}`);
const roots = [D("disk"), ...archives, `git:${repo}`, `git:${D("no-such-repo")}`];
const env = { ...process.env, FP_EXTRA, EXTRACT_BASE: D("x") };
for (const f of [logFile, logFile + ".journal", logFile + ".progress"]) fs.rmSync(f, { force: true });
const r1 = spawnSync(process.execPath, [scanner, logFile, ...roots], { env, encoding: "utf8" });
const log1 = fs.readFileSync(logFile, "utf8");
// Resume test: drop the "done" record of one unit and re-run; that unit must be rescanned, the rest skipped.
const jf = logFile + ".journal";
const jl = fs.readFileSync(jf, "utf8").split("\n").filter(Boolean);
const victim = D("disk", "e-boundary-uri.log");
fs.writeFileSync(jf, jl.filter((l) => { const o = JSON.parse(l); return !((o.t === "done" || o.t === "complete") && (o.unit === victim || o.t === "complete")); }).join("\n") + "\n");
const r2 = spawnSync(process.execPath, [scanner, logFile, ...roots], { env, encoding: "utf8" });
const log2 = fs.readFileSync(logFile, "utf8");
const j2 = fs.readFileSync(jf, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const lastStart = j2.map((o) => o.t).lastIndexOf("start");
const rescanned = j2.slice(lastStart).filter((o) => o.t === "done").map((o) => o.unit);

const found = (label, needle) => { const sec = log2.split(`  CONTROL ${label}: `)[1]?.split(/\n  [A-Za-z]/)[0] || ""; return sec.includes(needle); };
const checks = [
  ["env file: full URI", found("uri", "a.env")],
  ["env file: password (KEY=value)", found("password", ".env.local")],
  ["env file: quoted user", found("user", ".env.local")],
  ["JSON: URI in nested object", found("uri", "b.json")],
  ["JSONL transcript: password in prose", found("password", "c-transcript.jsonl")],
  ["JSONL transcript: escaped-quoted URI", found("uri", "c-transcript.jsonl")],
  ["JS: single-quoted user", found("user", "d.js")],
  ["JS: template-literal URI", found("uri", "d.js")],
  ["JS: double-quoted password", found("password", "d.js")],
  ["chunk boundary at 4 MiB: URI", found("uri", "e-boundary-uri.log")],
  ["chunk boundary at 8 MiB: password", found("password", "f-boundary-pass.log")],
  ["zip (deflate)", found("uri", "h.zip :: inner.env")],
  ["tar.gz", found("password", "i.tar.gz :: only-pass.txt")],
  ["tar (uncompressed)", found("password", "j.tar :: only-pass.txt")],
  ["7z", sevenZ ? found("uri", "k.7z :: inner.env") : "SKIPPED (tar cannot create 7z)"],
  ["single-file .gz", found("user", "l-single.txt.gz :: l-single.txt")],
  ["nested zip in zip", found("uri", "m-nested.zip :: nested-inner.zip :: inner.env")],
  ["office document (.docx)", found("password", "n-doc.docx :: word")],
  ["git history (value removed from working tree)", found("uri", "git objects of")],
  ["NEGATIVE: near-miss value not matched", !log2.includes("g-negative.txt")],
  ["NEGATIVE: production fingerprints absent in fixtures", /production MONGODB_URI \(full value\): ABSENT/.test(log2) && /production DB password: ABSENT/.test(log2)],
  ["corrupt archive reported FAILED (not skipped)", /FAILED: .*o-corrupt\.zip/.test(log2)],
  ["missing git repo reported unreadable", /git objects of .*no-such-repo.*git exit/.test(log2)],
  ["archive raw bytes do not contain plaintext (so hits prove decompression)", rawLeaks.length === 0 || `raw plaintext in: ${rawLeaks.join(", ")}`],
  ["resume: only the unit without a 'done' record was rescanned", rescanned.length === 1 && rescanned[0] === victim],
  ["resume: totals identical after resume", log1.split("\nScanned ")[1]?.split("\n")[0] === log2.split("\nScanned ")[1]?.split("\n")[0]],
  ["scanner exit codes 0 / 0", r1.status === 0 && r2.status === 0],
  ["extraction scratch folder empty afterwards", fs.readdirSync(D("x")).length === 0],
];
const out = [
  `Positive/negative controls for fingerprint-scan-v2.mjs, ${new Date().toISOString()}`,
  `Synthetic fingerprints: CONTROL uri=${fp(URI)}, CONTROL password=${fp(PASS)}, CONTROL user=${fp(USER)} (synthetic values, defined in positive-control-v2.mjs)`,
  `Scanner log: ${path.basename(logFile)} (journal alongside)`,
  "",
  ...checks.map(([name, ok]) => `${ok === true ? "PASS" : typeof ok === "string" && ok.startsWith("SKIPPED") ? "SKIP" : "FAIL"}  ${name}${typeof ok === "string" ? `  (${ok})` : ""}`),
  "",
  `${checks.filter(([, ok]) => ok === true).length}/${checks.length} PASS`,
];
console.log(out.join("\n"));
if (r1.status !== 0) console.log("run1 stderr:", r1.stderr.slice(-2000));
if (r2.status !== 0) console.log("run2 stderr:", r2.stderr.slice(-2000));
fs.writeFileSync(logFile.replace(/\.log$/, "") + "-summary.log", out.join("\n") + "\n");
