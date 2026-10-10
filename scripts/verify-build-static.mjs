import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const cssDir = path.join(process.cwd(), ".next", "static", "css");

if (!existsSync(cssDir)) {
  console.error("\n[build verify] Missing .next/static/css — Tailwind/CSS did not compile.");
  console.error("Run: npm install (includes tailwindcss) then npm run build\n");
  process.exit(1);
}

const files = readdirSync(cssDir).filter((f) => f.endsWith(".css"));
if (files.length === 0) {
  console.error("\n[build verify] No .css files in .next/static/css\n");
  process.exit(1);
}

const total = files.reduce((n, f) => n + statSync(path.join(cssDir, f)).size, 0);
if (total < 10_000) {
  console.error(`\n[build verify] CSS bundle too small (${total} bytes) — purge/build may be broken.\n`);
  process.exit(1);
}

console.log(`[build verify] OK — ${files.length} CSS file(s), ${Math.round(total / 1024)} KB`);
