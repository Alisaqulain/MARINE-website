// Prints the archive phase roots ("archive:<file>") for every archive and office container
// recorded in the given v2 journals (packages are listed in the report, not decompressed).
//   node archive-roots.mjs <journal> [...] > roots.txt
import fs from "node:fs";
const out = new Set();
for (const j of process.argv.slice(2)) for (const l of fs.readFileSync(j, "utf8").split("\n").filter(Boolean)) {
  const o = JSON.parse(l); if (o.t === "container" && o.kind !== "package") out.add(`archive:${o.file}`);
}
process.stdout.write([...out].join("\n") + "\n");
