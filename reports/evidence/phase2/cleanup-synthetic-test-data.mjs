// Removes ONLY the synthetic records created by reports/evidence/phase2/webhook-tests.mjs from the
// LOCAL test database (127.0.0.1:27018, marina_muse_dev). Markers: ids containing "isolated-test", chat sessions starting "isolatedtest",
// and the synthetic WhatsApp sender 919999000001 (session wa_919999000001). Prints counts only.
//   node scripts/isolated-env.mjs -- node reports/evidence/phase2/cleanup-synthetic-test-data.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const env = loadEnvConfig(root, true, { info() {}, error() {} }).combinedEnv;
const host = (env.MONGODB_URI || "").match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/)?.[1];
if (host !== "127.0.0.1:27018" || env.MONGODB_DB_NAME !== "marina_muse_dev") { console.error("refusing: not the local test database"); process.exit(2); }
const c = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await c.connect();
const db = c.db(env.MONGODB_DB_NAME);
const marker = /isolated-test/;
const session = "wa_919999000001", phone = "919999000001";
const plan = [
  ["ai_calls", { id: marker }],
  ["ai_leads", { $or: [{ sessionId: session }, { phone: { $in: [phone, `+${phone}`] } }] }],
  ["ai_wa_messages", { $or: [{ sessionId: session }, { wamid: marker }] }],
  ["ai_sessions", { $or: [{ id: session }, { id: /^isolatedtest/ }] }],
  ["ai_messages", { $or: [{ sessionId: session }, { sessionId: /^isolatedtest/ }] }],
  ["ai_leads", { sessionId: /^isolatedtest/ }],
  ["wa_webhook_events", { key: marker }],
  ["wa_contacts", { $or: [{ phone }, { wa_id: phone }] }],
];
console.log(`Cleanup of synthetic webhook-test records, ${new Date().toISOString()} (test DB ${host}/${env.MONGODB_DB_NAME})`);
for (const [col, q] of plan) {
  const r = await db.collection(col).deleteMany(q);
  console.log(`  ${col}: deleted ${r.deletedCount}`);
}
await c.close();
