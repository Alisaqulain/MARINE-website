// HTTP security & validation checks against a running server: npm run check:routes
// BASE_URL (default http://127.0.0.1:3000). Only requests the server must refuse are sent, so nothing is written,
// no message is sent and no call is placed. Optional: VERIFY_TOKEN / APP_SECRET / VAPI_SECRET / CRON_SECRET of the
// running server enable the positive checks (right token accepted, signed request parsed).
import { createHmac } from "node:crypto";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail });
  } catch (err) {
    results.push({ name, pass: false, detail: err instanceof Error ? err.message : String(err) });
  }
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const req = async (path, init = {}) => {
  const res = await fetch(BASE + path, { redirect: "manual", ...init });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get("location") };
};
const post = (path, body, headers = {}) => req(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

await check("/test redirects anonymous visitors to the admin login", async () => {
  const r = await req("/test");
  expect([302, 303, 307].includes(r.status) && r.location?.includes("/admin/login"), `status ${r.status} → ${r.location}`);
  return r.location;
});
await check("/api/health responds", async () => {
  const r = await req("/api/health");
  expect([200, 503].includes(r.status), `status ${r.status}`);
  return String(r.status);
});
await check("Chat rejects an invalid session", async () => {
  const r = await post("/api/ai/chat", { sessionId: "x", message: "hi" });
  expect([400, 503].includes(r.status), `status ${r.status}`);
  return String(r.status);
});
await check("Journey event rejects invalid input", async () => {
  const r = await post("/api/ai/event", { type: "nope" });
  expect(r.status === 400, `status ${r.status}`);
  return "400";
});
await check("Consent API validates input", async () => {
  const r = await post("/api/ai/consent", { channel: "email", address: "not-an-email", granted: true });
  expect(r.status === 400, `status ${r.status}`);
  return "400";
});
await check("Forged unsubscribe token rejected", async () => {
  const r = await req("/api/ai/consent?u=abc.def");
  expect(r.status === 400, `status ${r.status}`);
  return "400";
});
await check("Vapi webhook rejects unsigned requests", async () => {
  const r = await post("/api/ai/voice/webhook", { message: { type: "tool-calls" } });
  expect(r.status === 401, `status ${r.status}`);
  return "401";
});
await check("Vapi webhook rejects a wrong secret", async () => {
  const r = await post("/api/ai/voice/webhook", { message: { type: "tool-calls" } }, { "x-vapi-secret": "wrong-secret" });
  expect(r.status === 401, `status ${r.status}`);
  return "401";
});
await check("Exotel callback rejects a bad token", async () => {
  const r = await req("/api/ai/voice/webhook?provider=exotel&token=bad", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "CallSid=x&Status=no-answer" });
  expect(r.status === 401, `status ${r.status}`);
  return "401";
});
await check("WhatsApp verify handshake rejects a wrong token", async () => {
  const r = await req("/api/meta/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1");
  expect([403, 503].includes(r.status), `status ${r.status}`);
  return String(r.status);
});
await check("WhatsApp webhook rejects a forged signature", async () => {
  const r = await post("/api/meta/whatsapp/webhook", { object: "whatsapp_business_account", entry: [] }, { "x-hub-signature-256": "sha256=deadbeef" });
  expect([401, 503].includes(r.status), `status ${r.status}`);
  return String(r.status);
});
await check("Cron jobs reject a missing bearer", async () => {
  const r = await post("/api/ai/jobs", {});
  expect(r.status === 401, `status ${r.status}`);
  return "401";
});
await check("Cron jobs reject a wrong bearer", async () => {
  const r = await post("/api/ai/jobs", {}, { authorization: "Bearer wrong-secret" });
  expect(r.status === 401, `status ${r.status}`);
  return "401";
});
await check("Daily report rejects anonymous callers", async () => {
  const r = await req("/api/ai/report/daily");
  expect(r.status === 401, `status ${r.status}`);
  return "401";
});
for (const path of ["/api/admin/ai", "/api/meta/whatsapp/status"]) {
  await check(`${path} requires an admin`, async () => {
    const r = await req(path);
    expect(r.status === 401, `status ${r.status}`);
    return "401";
  });
}
for (const path of ["/api/admin/ai/actions", "/api/meta/whatsapp/coexistence", "/api/meta/whatsapp/signup/exchange"]) {
  await check(`POST ${path} requires an admin`, async () => {
    const r = await post(path, { action: "verify_number" });
    expect(r.status === 401, `status ${r.status}`);
    return "401";
  });
}

// Positive checks, only when the running server's test secrets are supplied.
if (process.env.VERIFY_TOKEN) {
  await check("WhatsApp verify handshake echoes the challenge with the right token", async () => {
    const r = await req(`/api/meta/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(process.env.VERIFY_TOKEN)}&hub.challenge=4242`);
    expect(r.status === 200 && r.text === "4242", `status ${r.status} ${r.text}`);
    return "200";
  });
}
if (process.env.APP_SECRET) {
  await check("Signed empty WhatsApp webhook is accepted and sends nothing", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const sig = `sha256=${createHmac("sha256", process.env.APP_SECRET).update(body).digest("hex")}`;
    const r = await post("/api/meta/whatsapp/webhook", body, { "x-hub-signature-256": sig });
    expect(r.status === 200 && JSON.parse(r.text).sent === 0, `status ${r.status} ${r.text.slice(0, 120)}`);
    return "200, sent 0";
  });
}
if (process.env.VAPI_SECRET) {
  await check("Vapi status-less message with the right secret is parsed (ignored type)", async () => {
    const r = await post("/api/ai/voice/webhook", { message: { type: "speech-update" } }, { "x-vapi-secret": process.env.VAPI_SECRET });
    expect(r.status === 200, `status ${r.status} ${r.text.slice(0, 120)}`);
    return "200";
  });
}

for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL ${results.length - failed} passed, ${failed} failed against ${BASE}`);
process.exit(failed ? 1 : 0);
