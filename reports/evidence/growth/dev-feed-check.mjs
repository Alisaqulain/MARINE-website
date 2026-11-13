/**
 * Validates the Google Shopping feed served by a LOCAL development server (static catalogue + local TEST data).
 *   node reports/evidence/growth/dev-feed-check.mjs [baseUrl]
 */
const base = (process.argv[2] || "http://localhost:3919").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error("Refusing: local servers only."); process.exit(2); }
const res = await fetch(`${base}/feeds/google.xml`);
const xml = await res.text();
const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);
const tag = (s, t) => (s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "") ?? null;
const ids = items.map((i) => tag(i, "g:id"));
const dup = ids.filter((id, n) => ids.indexOf(id) !== n);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
check("Feed served", res.ok && items.length > 0, `HTTP ${res.status}, ${items.length} items`);
check("All ids present and at most 50 characters", ids.every((id) => id && id.length <= 50), `longest ${Math.max(...ids.map((i) => (i || "").length))}`);
check("No duplicate ids", dup.length === 0, `${dup.length} duplicates`);
const titles = items.map((i) => tag(i, "g:title") ?? tag(i, "title") ?? "");
check("All titles 1-150 characters", titles.every((t) => t.length > 0 && t.length <= 150), `longest ${Math.max(...titles.map((t) => t.length))}`);
check("Every item declares identifier_exists", items.every((i) => /<g:identifier_exists>no<\/g:identifier_exists>/.test(i) || /<g:gtin>|<g:mpn>/.test(i)));
for (const t of ["g:price", "g:availability", "g:image_link", "g:link", "g:condition"]) check(`Every item has ${t}`, items.every((i) => tag(i, t)));
const pre = items.filter((i) => tag(i, "g:availability") === "preorder" || tag(i, "g:availability") === "backorder");
check("Pre-order/backorder items carry availability_date", pre.every((i) => tag(i, "g:availability_date")), `${pre.length} such items`);
const links = items.map((i) => tag(i, "g:link") || "");
console.log(`INFO  link origin(s): ${[...new Set(links.map((l) => { try { return new URL(l).origin; } catch { return "invalid"; } }))].join(", ")}`);
const testItems = items.filter((i) => /DEVTEST|dev-test-/.test(i)).length;
console.log(`INFO  TEST fixtures in feed: ${testItems} (local data only; the production feed is built from production data)`);
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\nRESULT: ${failed} check(s) FAILED` : `\nRESULT: FEED VALID (${results.length}/${results.length})`);
process.exit(failed ? 1 : 0);
