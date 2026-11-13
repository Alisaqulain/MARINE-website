// Classifies each fingerprint match recorded in the v2 scan journals WITHOUT printing
// the matched value or raw surrounding text. For every occurrence it reports:
//   byte offset, the nearest preceding key name (e.g. MONGODB_URI, "user"), and, when the
//   value sits inside a mongodb:// URI, what the URI's password part is: a placeholder
//   (<redacted>, ****, <password>...), the production password (by fingerprint), or
//   another value (fingerprint shown) - never the value itself.
//   node investigate-matches.mjs <out log> <journal> [<journal> ...]
import fs from "node:fs";
import crypto from "node:crypto";

const [out, ...journals] = process.argv.slice(2);
const fp = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 10);
const TARGETS = { "0f74c955cd": "production MONGODB_URI (full value)", "443117db38": "production DB password", "8328be9d60": "production DB user name" };
const PASS_FP = "443117db38";
const hits = [];
for (const j of journals) for (const l of fs.readFileSync(j, "utf8").split("\n").filter(Boolean)) {
  const o = JSON.parse(l); if (o.t === "hit") hits.push({ journal: j.split(/[\\/]/).pop(), ...o });
}
const lines = [`Match investigation, ${new Date().toISOString()}. Values and raw context are never printed.`, `Matches in journals: ${hits.length}`, ""];
const files = [...new Set(hits.map((h) => h.where))];
for (const file of files) {
  const labels = [...new Set(hits.filter((h) => h.where === file).map((h) => h.label))];
  lines.push(`FILE: ${file}`, `  labels: ${labels.join(", ")}`);
  if (file.includes(" :: ") || file.startsWith("git objects")) { lines.push("  (inside an archive or git store: classified by the scan only)", ""); continue; }
  let st; try { st = fs.statSync(file); } catch (e) { lines.push(`  now: ${e.code} (file no longer present)`, ""); continue; }
  lines.push(`  size ${st.size} bytes, modified ${st.mtime.toISOString()}`);
  const text = fs.readFileSync(file).toString("latin1");
  // find every occurrence of any target value: candidate tokens of the same shape as the scanner
  const occ = [];
  for (const m of text.matchAll(/[A-Za-z0-9\-._~!$&'()*+,;=%]{4,}/g)) {
    const tok = m[0];
    const starts = [0], ends = [tok.length];
    for (let i = 0; i < tok.length && starts.length < 40; i++) if ("=,;&()'*+!$".includes(tok[i])) { starts.push(i + 1); ends.push(i); }
    for (const s of starts) for (const e of ends) if (e - s >= 4 && e - s <= 256) {
      const f = fp(tok.slice(s, e)); if (TARGETS[f]) occ.push({ at: m.index + s, len: e - s, label: TARGETS[f] });
    }
  }
  const uniq = [...new Map(occ.map((o) => [o.at + ":" + o.label, o])).values()];
  lines.push(`  occurrences: ${uniq.length}`);
  const kinds = {};
  for (const o of uniq) {
    const before = text.slice(Math.max(0, o.at - 300), o.at);
    const after = text.slice(o.at + o.len, o.at + o.len + 300);
    const key = (before.match(/([A-Za-z_][A-Za-z0-9_]*)\s*["']?\s*[:=]\s*["'`]?[^\n"'`]*$/) || [])[1] || "(none)";
    let uriPass = "not in a URI";
    if (/mongodb(\+srv)?:\/\/$/.test(before)) {
      const pm = after.match(/^:([^@\/\s"'`\\]*)@/);
      if (!pm) uriPass = "URI without password part";
      else if (/^(<[^>]*>|\*+|x+|\.\.\.|…|%3C[^@]*%3E|redacted|REDACTED|password|PASSWORD|\$\{?[A-Z_]+\}?)$/.test(pm[1])) uriPass = `placeholder (${pm[1].length} chars, ${/redact/i.test(pm[1]) ? "'redacted'" : "masked"})`;
      else uriPass = fp(pm[1]) === PASS_FP || fp(decodeURIComponent(pm[1])) === PASS_FP ? "PRODUCTION PASSWORD" : `other value (fp ${fp(pm[1])}, not the production password)`;
    }
    const k = `${o.label} | key ${key} | ${uriPass}`;
    kinds[k] = (kinds[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(kinds)) lines.push(`    ${n} x ${k}`);
  lines.push("");
}
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.join("\n"));
