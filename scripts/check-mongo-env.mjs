/**
 * Run on the KVM (in project root) to verify MongoDB env matches Atlas — not what Next cached.
 * Usage: npm run check:mongo
 */
import dns from "node:dns";
import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

dns.setDefaultResultOrder("ipv4first");

const ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];

function parseLine(line) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) return null;
  let v = m[2].trim();
  while (v.startsWith("=")) v = v.slice(1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return { key: m[1], value: v };
}

/** File values win — mimics what you expect after editing .env on disk. */
function loadEnvFiles() {
  const fromFiles = {};
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith("#")) continue;
      const p = parseLine(line);
      if (p) fromFiles[p.key] = p.value;
    }
    console.log("Read", file);
  }
  for (const [key, value] of Object.entries(fromFiles)) {
    const prev = process.env[key];
    if (prev !== undefined && prev !== value && key === "MONGODB_URI") {
      console.warn(
        "WARN: pm2/systemd MONGODB_URI differs from .env file — Next.js keeps the OLD pm2 value. Remove it from pm2 and use --update-env."
      );
      console.warn("  pm2 length:", prev.length, "· file length:", value.length);
    }
    process.env[key] = value;
  }
}

function credsFromUri(uri) {
  const u = new URL(uri.replace(/^mongodb\+srv:/, "mongodb:"));
  return {
    user: decodeURIComponent(u.username),
    pass: decodeURIComponent(u.password),
    host: u.hostname,
  };
}

async function main() {
  console.log("cwd:", process.cwd());
  loadEnvFiles();

  const uri = process.env.MONGODB_URI_STANDARD?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("FAIL: MONGODB_URI not set (check .env.production.local or .env on this server)");
    process.exit(1);
  }

  const c = credsFromUri(uri);
  console.log("user:", c.user);
  console.log("cluster:", c.host);
  console.log("password length in URI:", c.pass.length);
  if (process.env.MONGODB_URI_STANDARD) console.log("(using MONGODB_URI_STANDARD)");

  const directFlag = process.env.MONGODB_DIRECT ?? "(not set)";
  const srvOnly = process.env.MONGODB_SRV_ONLY === "1";
  const wantDirect =
    !srvOnly &&
    !(process.env.MONGODB_DIRECT === "0" && process.platform === "win32") &&
    uri.startsWith("mongodb+srv://");
  if (process.env.MONGODB_DIRECT === "0" && process.platform === "linux") {
    console.log("MONGODB_DIRECT=0 ignored on Linux — VPS still uses direct shards (remove =0 or delete the line).");
  }
  console.log(
    "MONGODB_DIRECT:",
    directFlag,
    srvOnly ? "→ SRV only (MONGODB_SRV_ONLY=1)" : wantDirect ? "→ try direct shards first" : "→ SRV only"
  );

  const nodeMajor = Number(/^v(\d+)/.exec(process.version)?.[1] ?? 0);
  const skipSrvAfterDirect =
    (process.platform === "win32" && nodeMajor >= 24) || process.env.MONGODB_SKIP_SRV_FALLBACK === "1";
  const preferIpv4 =
    process.platform === "win32" ||
    process.env.MONGODB_PREFER_IPV4 === "1" ||
    process.env.MONGODB_FORCE_IPV4 === "1";
  const opts = {
    serverSelectionTimeoutMS: 15_000,
    autoSelectFamily: preferIpv4 ? false : undefined,
    ...(preferIpv4 ? { family: 4 } : {}),
  };
  console.log("check-mongo script: direct-shards-v2 · Node", process.version, "·", process.platform);

  async function tryPing(label, tryUri, tryOpts = opts) {
    const client = new MongoClient(tryUri, tryOpts);
    try {
      await client.connect();
      await client.db(process.env.MONGODB_DB_NAME || "marina_muse").command({ ping: 1 });
      console.log("OK:", label);
      await client.close();
      return true;
    } catch (e) {
      console.log("FAIL:", label, "-", e.message?.split("\n")[0]);
      await client.close().catch(() => {});
      return false;
    }
  }

  if (wantDirect && uri.startsWith("mongodb+srv://")) {
    console.log("Trying direct Atlas shard hosts (SRV lookup)...");
    const recs = await dns.promises.resolveSrv(`_mongodb._tcp.${c.host}`);
    const auth = `${encodeURIComponent(c.user)}:${encodeURIComponent(c.pass)}`;
    const sortKey = (h) =>
      h.includes("shard-00-01") ? 0 : h.includes("shard-00-00") ? 1 : h.includes("shard-00-02") ? 2 : 3;
    const sorted = [...recs].sort((a, b) => sortKey(a.name) - sortKey(b.name));
    for (const r of sorted) {
      const direct = `mongodb://${auth}@${r.name}:27017/?ssl=true&authSource=admin&directConnection=true`;
      if (await tryPing(`direct ${r.name}`, direct)) return;
    }
    console.log("All direct shard attempts failed.");
  } else if (!uri.startsWith("mongodb+srv://")) {
    console.log("URI is not mongodb+srv — skipping direct shard step.");
  }

  if (!skipSrvAfterDirect) {
    if (await tryPing("mongodb+srv", uri)) return;
  } else {
    console.log("Skipping mongodb+srv fallback.");
  }

  console.error(
    "\nIf every attempt shows SSL alert 80: MongoDB Atlas → Network Access → add this server's public IP (or 0.0.0.0/0)."
  );
  process.exit(1);
}

main();
