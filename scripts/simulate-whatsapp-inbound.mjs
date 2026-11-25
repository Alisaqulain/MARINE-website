// Local only: sends a FAKE, correctly signed WhatsApp "incoming message" webhook to your own dev server.
// Nothing is sent to Meta or to any phone. Usage:
//   node scripts/simulate-whatsapp-inbound.mjs [baseUrl] [message]
//   node scripts/simulate-whatsapp-inbound.mjs http://localhost:3000 "Hi, test from local" [senderDigits]
import { createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && !(m[1] in out)) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const env = { ...readEnv(".env.local"), ...process.env };
const base = process.argv[2] || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Refusing: this script only targets a local dev server (http://localhost:PORT).");
  process.exit(1);
}
const text = process.argv[3] || "Hi, this is a local test message";
const from = (process.argv[4] || "910000000001").replace(/\D/g, "");
const secret = env.META_WEBHOOK_APP_SECRET || env.META_APP_SECRET;
const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
if (!secret || !phoneId || !wabaId) {
  console.error("Missing META_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_BUSINESS_ACCOUNT_ID in .env.local.");
  process.exit(1);
}

const body = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: wabaId,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "919068349540", phone_number_id: phoneId },
            contacts: [{ profile: { name: "Local Tester" }, wa_id: from }],
            messages: [
              {
                from,
                id: `wamid.LOCALTEST${randomBytes(8).toString("hex")}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: text },
              },
            ],
          },
        },
      ],
    },
  ],
});

const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const url = `${base}/api/meta/whatsapp/webhook`;

const good = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig }, body });
console.log("Signed message   →", good.status, await good.text());
const bad = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=bad" }, body });
console.log("Bad signature    →", bad.status, "(should be 401/403)");
const token = env.META_WEBHOOK_VERIFY_TOKEN || "";
const hs = await fetch(`${url}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=12345`);
console.log("Handshake        →", hs.status, await hs.text(), "(should be 200 12345)");
