/**
 * Local development/test database (MongoDB 7 in Docker, bound to 127.0.0.1 only).
 * Development must never use the production database; lib/mongodb.ts refuses remote hosts outside production.
 *
 *   node scripts/dev-db.mjs setup    create the container + a readWrite user for marina_muse_dev only,
 *                                    then point MONGODB_URI / MONGODB_DB_NAME in .env.local at it
 *   node scripts/dev-db.mjs seed     add the isolation marker and clearly labelled TEST products
 *   node scripts/dev-db.mjs verify   sanitized target + read/write/delete probe + permission checks
 *   node scripts/dev-db.mjs start    start the container again after a reboot
 *   node scripts/dev-db.mjs reset --yes   delete the container and its volume (test data only)
 *
 * Secrets are generated here, written only to .env.local and never printed.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { devDatabaseBlockReason, mongoUriHosts } from "../lib/env-mongo-uri.ts";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");

const CONTAINER = "marina-dev-mongo";
const VOLUME = "marina-dev-mongo-data";
const IMAGE = "mongo:7.0";
const PORT = 27018;
const DB = "marina_muse_dev";
const APP_USER = "marina_dev_app";
const MARKER = "marina-muse-development-test-database";
const ENV_FILE = ".env.local";

const fp = (v) => createHash("sha256").update(v).digest("hex").slice(0, 10);
const secret = () => randomBytes(24).toString("base64url");

function docker(args, opts = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8", ...opts });
  if (r.error) throw r.error;
  return r;
}

function containerState() {
  const r = docker(["inspect", "-f", "{{.State.Status}}", CONTAINER]);
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Replace or append KEY=value lines in .env.local without touching anything else. */
function setEnvLines(values, remove = []) {
  const text = readFileSync(ENV_FILE, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (key && remove.includes(key)) continue;
    if (key && key in values) {
      if (!seen.has(key)) out.push(`${key}=${values[key]}`);
      seen.add(key);
      continue;
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  for (const [k, v] of Object.entries(values)) if (!seen.has(k)) out.push(`${k}=${v}`);
  writeFileSync(ENV_FILE, out.join(eol) + eol);
}

function loadEnv() {
  return loadEnvConfig(process.cwd(), true, { info() {}, error() {} }).combinedEnv;
}

async function waitForMongo(rootPw) {
  for (let i = 0; i < 60; i++) {
    const r = docker(
      ["exec", "-e", "ROOT_PW", CONTAINER, "sh", "-c",
        'mongosh --quiet -u devroot -p "$ROOT_PW" --authenticationDatabase admin --eval "db.runCommand({ping:1}).ok"'],
      { env: { ...process.env, ROOT_PW: rootPw } }
    );
    if (r.status === 0 && r.stdout.trim().endsWith("1")) return;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("MongoDB container did not become ready");
}

async function setup() {
  if (containerState()) {
    console.log(`Container ${CONTAINER} already exists. Use "start", or "reset --yes" to rebuild it.`);
    process.exit(1);
  }
  const rootPw = secret();
  const appPw = secret();
  const run = docker(
    ["run", "-d", "--name", CONTAINER, "--restart", "unless-stopped",
      "-p", `127.0.0.1:${PORT}:27017`, "-v", `${VOLUME}:/data/db`,
      "-e", "MONGO_INITDB_ROOT_USERNAME=devroot", "-e", "MONGO_INITDB_ROOT_PASSWORD",
      "--label", "purpose=marina-muse-dev-test-db", IMAGE],
    { env: { ...process.env, MONGO_INITDB_ROOT_PASSWORD: rootPw } }
  );
  if (run.status !== 0) throw new Error("docker run failed: " + run.stderr.trim().split("\n").pop());
  await waitForMongo(rootPw);
  const create = docker(
    ["exec", "-i", "-e", "ROOT_PW", "-e", "APP_PW", CONTAINER, "sh", "-c",
      'mongosh --quiet -u devroot -p "$ROOT_PW" --authenticationDatabase admin'],
    {
      env: { ...process.env, ROOT_PW: rootPw, APP_PW: appPw },
      input: `db.getSiblingDB("${DB}").createUser({ user: "${APP_USER}", pwd: process.env.APP_PW, roles: [{ role: "readWrite", db: "${DB}" }] }); print("user-created");\n`,
    }
  );
  if (!create.stdout.includes("user-created")) throw new Error("creating the app user failed");
  const uri = `mongodb://${APP_USER}:${appPw}@127.0.0.1:${PORT}/${DB}?authSource=${DB}&directConnection=true`;
  setEnvLines({ MONGODB_URI: uri, MONGODB_DB_NAME: DB }, ["MONGODB_URI_STANDARD"]);
  console.log(`Container ${CONTAINER} running on 127.0.0.1:${PORT} (${IMAGE}), volume ${VOLUME}.`);
  console.log(`User ${APP_USER}: readWrite on ${DB} only. Root password not printed or saved to a file, but Docker keeps it in the container configuration (docker inspect): anyone with Docker access on this PC can read it. It reaches only this local test container.`);
  console.log(`.env.local updated: MONGODB_URI (fp ${fp(uri)}), MONGODB_DB_NAME=${DB}; MONGODB_URI_STANDARD removed if present.`);
}

async function connect() {
  const env = loadEnv();
  const uri = env.MONGODB_URI_STANDARD || env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const blocked = devDatabaseBlockReason(uri, { ...env, NODE_ENV: "development" });
  if (blocked) throw new Error("Refused: " + blocked);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return { client, env, uri };
}

const TEST_PRODUCTS = [
  { slug: "dev-test-brass-compass", name: "TEST ONLY Brass Compass", sku: "DEVTEST-001", price: 49, channel: "both", stock: "in-stock", quantity: 12 },
  { slug: "dev-test-ship-wheel", name: "TEST ONLY Ship Wheel", sku: "DEVTEST-002", price: 120, channel: "retail", stock: "low", quantity: 3 },
  { slug: "dev-test-telescope", name: "TEST ONLY Telescope", sku: "DEVTEST-003", price: 89, channel: "wholesale", stock: "made-to-order", wholesaleFrom: 60, moq: 10 },
];

async function seed() {
  const { client, env } = await connect();
  try {
    const db = client.db(env.MONGODB_DB_NAME);
    const now = new Date();
    await db.collection("_dev_isolation").updateOne(
      { _id: "marker" },
      { $set: { marker: MARKER, note: "Development/test database. Test data only. No production data.", updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    for (const p of TEST_PRODUCTS) {
      await db.collection("products").updateOne(
        { slug: p.slug },
        {
          $set: { ...p, image: "/favicon-512.png", description: "Synthetic product for development testing. Not for sale.", active: true, testData: true, updatedAt: now.toISOString() },
          $setOnInsert: { createdAt: now.toISOString() },
        },
        { upsert: true }
      );
    }
    console.log(`Seeded marker and ${TEST_PRODUCTS.length} TEST products into ${env.MONGODB_DB_NAME}.`);
  } finally {
    await client.close();
  }
}

async function verify() {
  const results = [];
  const check = (name, ok, detail = "") => {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  };
  const { client, env, uri } = await connect();
  try {
    const hosts = mongoUriHosts(uri);
    const scheme = uri.startsWith("mongodb+srv") ? "mongodb+srv" : "mongodb";
    console.log(`Target: ${scheme}://<user>:<redacted>@${hosts.join(",")}:${PORT}/${env.MONGODB_DB_NAME}  uri-fp ${fp(uri)}`);
    check("URI uses a local host only", hosts.every((h) => ["127.0.0.1", "localhost", "::1", "[::1]"].includes(h)), hosts.join(","));
    check("URI is not an Atlas/SRV string", !/mongodb\+srv|mongodb\.net/i.test(uri));
    check("MONGODB_URI_STANDARD is not set", !env.MONGODB_URI_STANDARD);
    check("MONGODB_DB_NAME is the test database", env.MONGODB_DB_NAME === DB, env.MONGODB_DB_NAME);

    const db = client.db(env.MONGODB_DB_NAME);
    const marker = await db.collection("_dev_isolation").findOne({ _id: "marker" });
    check("Isolation marker present (connected DB is the test DB)", marker?.marker === MARKER);

    const probeId = "probe-" + randomBytes(6).toString("hex");
    await db.collection("_dev_isolation_probe").insertOne({ _id: probeId, at: new Date() });
    const read = await db.collection("_dev_isolation_probe").findOne({ _id: probeId });
    const del = await db.collection("_dev_isolation_probe").deleteOne({ _id: probeId });
    check("Write, read back and delete a probe document", Boolean(read) && del.deletedCount === 1);

    const testProducts = await db.collection("products").countDocuments({ testData: true });
    const allProducts = await db.collection("products").countDocuments({});
    check("Products collection holds only TEST fixtures", allProducts === testProducts, `${testProducts}/${allProducts}`);
    for (const c of ["orders", "users", "ai_leads", "contact_messages", "wholesale_applications"]) {
      const n = await db.collection(c).countDocuments({});
      console.log(`      ${c}: ${n} documents`);
    }

    let otherDbDenied = false;
    try {
      await client.db("marina_muse").collection("_probe").insertOne({ at: new Date() });
    } catch (err) {
      otherDbDenied = /not authorized|Unauthorized/i.test(String(err?.message));
    }
    check("App user cannot write to any other database", otherDbDenied);

    // listDatabases succeeds for any user but only returns the databases that user is authorized for.
    const visible = (await client.db("admin").admin().listDatabases({ nameOnly: true })).databases.map((d) => d.name);
    check("App user can see only the test database (least privilege)", visible.length === 1 && visible[0] === DB, visible.join(","));

    const inspect = docker(["inspect", "-f", "{{range $p, $b := .NetworkSettings.Ports}}{{range $b}}{{.HostIp}}:{{.HostPort}} {{end}}{{end}}", CONTAINER]);
    const bindings = inspect.stdout.trim();
    check("Container port bound to 127.0.0.1 only", bindings.length > 0 && bindings.split(/\s+/).every((b) => b.startsWith("127.0.0.1:")), bindings);

    const prodLike = { ...env, NODE_ENV: "development", MONGODB_DEV_ALLOWED_HOSTS: "" };
    check("Guard refuses an Atlas SRV URI in development", Boolean(devDatabaseBlockReason("mongodb+srv://u:p@cluster0.example.mongodb.net/db", prodLike)));
    check("Guard refuses a remote standard URI in development", Boolean(devDatabaseBlockReason("mongodb://u:p@ac-x-shard-00-00.example.mongodb.net:27017,localhost:27017/db", prodLike)));
    check("Guard allows the local test URI", devDatabaseBlockReason(uri, prodLike) === null);
  } finally {
    await client.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `\nRESULT: ${failed} check(s) FAILED` : `\nRESULT: ISOLATED (${results.length}/${results.length} checks passed)`);
  process.exit(failed ? 1 : 0);
}

const cmd = process.argv[2];
if (cmd === "setup") await setup();
else if (cmd === "seed") await seed();
else if (cmd === "verify") await verify();
else if (cmd === "start") {
  const r = docker(["start", CONTAINER]);
  console.log(r.status === 0 ? `${CONTAINER} started` : r.stderr.trim());
} else if (cmd === "reset") {
  if (!process.argv.includes("--yes")) {
    console.log("This deletes the local test container and its volume. Re-run with --yes.");
    process.exit(1);
  }
  docker(["rm", "-f", CONTAINER]);
  docker(["volume", "rm", VOLUME]);
  console.log(`Removed ${CONTAINER} and ${VOLUME}. Run setup again.`);
} else {
  console.log("Usage: node scripts/dev-db.mjs setup | seed | verify | start | reset --yes");
  process.exit(1);
}
