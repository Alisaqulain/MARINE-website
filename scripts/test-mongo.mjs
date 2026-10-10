import { MongoClient, ServerApiVersion } from "mongodb";
import dns from "node:dns";
import { readFileSync, existsSync } from "node:fs";

dns.setDefaultResultOrder("ipv4first");

function loadUri() {
  const path = existsSync(".env.local") ? ".env.local" : ".env";
  const env = readFileSync(path, "utf8");
  const line = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
  if (!line) throw new Error("MONGODB_URI not in " + path);
  let uri = line.slice("MONGODB_URI=".length).trim();
  if (!uri.includes("retryWrites=")) {
    uri += uri.includes("?") ? "&retryWrites=true&w=majority" : "?retryWrites=true&w=majority";
  }
  return uri;
}

const srvUri = loadUri();

function loadCreds() {
  const path = existsSync(".env.local") ? ".env.local" : ".env";
  const env = readFileSync(path, "utf8");
  const line = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
  const raw = line.slice("MONGODB_URI=".length).trim();
  const m = raw.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)/);
  if (!m) return null;
  return { user: decodeURIComponent(m[1]), pass: decodeURIComponent(m[2]) };
}

function standardUri(creds) {
  const hosts = [
    "ac-yqibwz9-shard-00-00.a9zxbuj.mongodb.net:27017",
    "ac-yqibwz9-shard-00-01.a9zxbuj.mongodb.net:27017",
    "ac-yqibwz9-shard-00-02.a9zxbuj.mongodb.net:27017",
  ].join(",");
  const rs = process.env.MONGODB_REPLICA_SET ?? "atlas-yqibwz9-shard-0";
  const auth = encodeURIComponent(creds.user) + ":" + encodeURIComponent(creds.pass);
  return `mongodb://${auth}@${hosts}/?ssl=true&authSource=admin&replicaSet=${rs}&retryWrites=true&w=majority`;
}

function directUri(creds) {
  const auth = encodeURIComponent(creds.user) + ":" + encodeURIComponent(creds.pass);
  return `mongodb://${auth}@ac-yqibwz9-shard-00-00.a9zxbuj.mongodb.net:27017/?ssl=true&authSource=admin&directConnection=true&retryWrites=true&w=majority`;
}

const creds = loadCreds();
const uris = [{ label: "mongodb+srv", uri: srvUri }];
if (creds) {
  uris.push({ label: "mongodb standard (no SRV)", uri: standardUri(creds) });
  uris.push({ label: "direct single node", uri: directUri(creds) });
}

async function tryConnect(label, uri, options) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000, ...options });
  try {
    await client.connect();
    await client.db("marina_muse").command({ ping: 1 });
    console.log("OK:", label);
    await client.close();
    return true;
  } catch (e) {
    console.log("FAIL:", label, "-", e.message?.split("\n")[0]);
    try {
      await client.close();
    } catch {
      /* ignore */
    }
    return false;
  }
}

console.log("Node", process.version);
console.log("Testing Atlas URI (host hidden)...\n");

const optsList = [
  ["autoSelectFamily: false", { autoSelectFamily: false }],
  ["driver defaults", {}],
];

for (const { label: uriLabel, uri } of uris) {
  for (const [optLabel, opts] of optsList) {
    if (await tryConnect(`${uriLabel} / ${optLabel}`, uri, opts)) {
      if (uriLabel.includes("standard")) {
        console.log("\nTip: set MONGODB_URI to the standard connection string in Atlas (Connect → Drivers → “Standard connection string”).");
      }
      process.exit(0);
    }
  }
}
console.log("\nIf all fail on Node 24, install Node 20 LTS: https://nodejs.org/en/download");
process.exit(1);
