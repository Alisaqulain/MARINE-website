// @ts-nocheck
import { createHmac } from "crypto";
import fs from "fs";
import {
  BLOCKED_LIVE_NUMBER,
  acceptSignupPost,
  accountStateFor,
  decryptToken,
  embeddedSignupLaunch,
  encryptToken,
  exchangeAuthorizationCode,
  graphCallAllowed,
  maskId,
  normaliseWebhook,
  planEvents,
  publicStatus,
  redact,
  rememberAuthorizationCode,
  shouldSendWhatsApp,
  signupActorAllowed,
  syncSmbAppData,
  uiApprovalDecision,
  verifyHandshake,
  verifySignature,
  webhookSummary,
} from "../lib/whatsapp/coexistence.ts";

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

const envOff = {
  META_APP_SECRET: "",
  WHATSAPP_COEXISTENCE_ENABLED: "false",
  WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "false",
  WHATSAPP_OUTBOUND_ENABLED: "false",
};
const status = publicStatus(envOff, null);
check("production signup stays disabled", status.signupAllowed === false && status.liveNumberTouched === false, "disabled");
check("webhook subscription is not claimed", status.webhookSubscription === "not verified" && status.coexistenceVerified === "not verified", status.webhookSubscription);
check("v4 launch omits featureType", status.featureTypeIncluded === false && JSON.stringify(embeddedSignupLaunch("1760993601871515").extras) === "{}", "empty extras");
check("outbound flag cannot send by itself", shouldSendWhatsApp({ WHATSAPP_OUTBOUND_ENABLED: "true" }) === false, "needs all flags");
check("ui approval cannot be granted", uiApprovalDecision().approved === false && uiApprovalDecision().status === 403, "403");

const launch = embeddedSignupLaunch("1760993601871515");
check("launch uses the code flow", launch.response_type === "code" && launch.override_default_response_type === true && launch.config_id === "1760993601871515", "code");

const blocked = acceptSignupPost(
  {
    code: "realCodeShouldNotBeSent123",
    session: {
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      data: { waba_id: "102290129340398", phone_number_id: "106540352242922" },
    },
  },
  envOff
);
check("unapproved signup does not call Meta", blocked.calledMeta === false && blocked.status === 403 && blocked.code === undefined, blocked.detail);
check("blocked detail hides the authorization code", !blocked.detail.includes("realCodeShouldNotBeSent123"), "redacted");

const cancelled = acceptSignupPost({ loginStatus: "unknown" }, envOff);
check("cancellation is recorded without Meta", cancelled.outcome === "cancelled" && cancelled.calledMeta === false, cancelled.outcome);
const denied = acceptSignupPost({ loginStatus: "not_authorized" }, envOff);
check("denied permissions do not call Meta", denied.outcome === "denied" && denied.calledMeta === false, denied.outcome);

const dry = acceptSignupPost(
  {
    dryRun: true,
    code: "ignoredCode12345",
    session: {
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      data: { waba_id: "102290129340398", phone_number_id: "106540352242922", business_id: "2729063490586005" },
    },
  },
  { ...envOff, WHATSAPP_COEXISTENCE_ENABLED: "true", WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "true", META_APP_SECRET: "secret-value", AUTH_SECRET: "auth-secret-value" }
);
check("dry run ignores a real-looking code", dry.outcome === "simulated" && dry.calledMeta === false && dry.code === undefined, dry.outcome);
check("dry run keeps sample ids", dry.wabaId === "102290129340398" && dry.phoneNumberId === "106540352242922", "ids");

const missing = acceptSignupPost(
  { dryRun: true, session: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: {} } },
  envOff
);
check("missing ids are rejected", missing.status === 400 && missing.store === "none", missing.detail);

const standardFinish = acceptSignupPost(
  { session: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "102290129340398", phone_number_id: "106540352242922" } } },
  envOff
);
check("standard finish does not register the number", standardFinish.status === 409 && standardFinish.detail.toLowerCase().includes("not registered"), standardFinish.detail);

const live = acceptSignupPost(
  {
    dryRun: true,
    session: {
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      data: { waba_id: "102290129340398", phone_number_id: BLOCKED_LIVE_NUMBER },
    },
  },
  envOff
);
check("live number is rejected", live.status === 400 && live.calledMeta === false, live.detail);

const calls = [];
const exchanged = await exchangeAuthorizationCode({
  code: "validcode123",
  appId: "1588276335845243",
  appSecret: "app-secret-value",
  version: "v26.0",
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), body: String(init?.body || "") });
    return { ok: true, status: 200, json: async () => ({ access_token: "EAAsecretTokenValue" }) };
  },
});
check("exchange hits only the code endpoint", calls.length === 1 && calls[0].url.endsWith("/oauth/access_token") && !calls[0].url.includes("app-secret-value"), calls[0]?.url || "none");
check("exchange body is form encoded", calls[0].body.includes("grant_type=authorization_code") && calls[0].body.includes("code=validcode123"), "form");
check("mock token is not the success flag itself", exchanged.ok === true && exchanged.token === "EAAsecretTokenValue", "token returned only to the server caller");

const failed = await exchangeAuthorizationCode({
  code: "validcode123",
  appId: "1588276335845243",
  appSecret: "app-secret-value",
  version: "v26.0",
  fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid code validcode123 for secret app-secret-value" } }) }),
});
check("exchange failure redacts the code and secret", failed.ok === false && failed.calledMeta === true && !failed.error.includes("validcode123") && !failed.error.includes("app-secret-value"), failed.error);

check("register endpoint is blocked", graphCallAllowed("https://graph.facebook.com/v26.0/123/register").ok === false, "register");
check("deregister endpoint is blocked", graphCallAllowed("https://graph.facebook.com/v26.0/123/deregister").ok === false, "deregister");
check("history sync endpoint is blocked", graphCallAllowed("https://graph.facebook.com/v26.0/123/smb_app_data").ok === false, "sync");
check("send endpoint is blocked", graphCallAllowed("https://graph.facebook.com/v26.0/123/messages").ok === false, "messages");
check("live number in a Graph call is blocked", graphCallAllowed("https://graph.facebook.com/v26.0/oauth/access_token", BLOCKED_LIVE_NUMBER).ok === false, "number");

const secret = "webhook-secret";
const history = {
  object: "whatsapp_business_account",
  entry: [{
    id: "102290129340398",
    changes: [{
      field: "history",
      value: {
        metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
        history: [{ metadata: { phase: 0, chunk_order: 1, progress: 55 }, threads: [{ messages: [{ id: "wamid.HISTORY", text: { body: "please reply now" } }] }] }],
      },
    }],
  }],
};
const sync = {
  object: "whatsapp_business_account",
  entry: [{
    id: "102290129340398",
    changes: [{
      field: "smb_app_state_sync",
      value: {
        metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
        state_sync: [{ type: "contact", contact: { phone_number: "16505551234", full_name: "Test Contact" }, action: "add", metadata: { timestamp: "1738346006" } }],
      },
    }],
  }],
};
const echo = {
  object: "whatsapp_business_account",
  entry: [{
    id: "102290129340398",
    changes: [{
      field: "smb_message_echoes",
      value: {
        metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
        message_echoes: [{ from: "15550783881", to: "16505551234", id: "wamid.ECHO", timestamp: "1700255121", type: "text", text: { body: "sent from the phone" } }],
      },
    }],
  }],
};
const inbound = {
  object: "whatsapp_business_account",
  entry: [{
    id: "102290129340398",
    changes: [{
      field: "messages",
      value: {
        metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
        messages: [{ from: "16505551234", id: "wamid.INBOUND", timestamp: "1700255121", type: "text", text: { body: "What is the compass price?" } }],
      },
    }],
  }],
};

const seen = new Set();
const store = { has: (key) => seen.has(key), add: (key) => seen.add(key) };
const historyPlan = planEvents(normaliseWebhook(history), store)[0];
const syncPlan = planEvents(normaliseWebhook(sync), store)[0];
const echoPlan = planEvents(normaliseWebhook(echo), store)[0];
const inboundPlan = planEvents(normaliseWebhook(inbound), store)[0];
const duplicatePlan = planEvents(normaliseWebhook(inbound), store)[0];
check("history is not answered", historyPlan.action === "ignore" && historyPlan.text === null && historyPlan.send === false, historyPlan.reason);
check("contact sync is not answered", syncPlan.kind === "state_sync" && syncPlan.action === "ignore" && syncPlan.send === false, syncPlan.reason);
check("business-app echo is not answered", echoPlan.kind === "echo" && echoPlan.action === "ignore" && echoPlan.text === null, echoPlan.reason);
check("new customer text is drafted and not sent", inboundPlan.action === "draft" && inboundPlan.send === false && inboundPlan.text.includes("compass"), inboundPlan.reason);
check("duplicate delivery is ignored", duplicatePlan.action === "ignore" && duplicatePlan.reason === "duplicate", duplicatePlan.reason);
check("summary never reports a sent message", webhookSummary([historyPlan, syncPlan, echoPlan, inboundPlan]).sent === 0, "sent 0");

const raw = JSON.stringify(inbound);
const good = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
check("valid signature passes", verifySignature(raw, good, secret).ok === true, "ok");
check("invalid signature is rejected", verifySignature(raw, "sha256=deadbeef", secret).ok === false, "rejected");
check("missing webhook secret is rejected", verifySignature(raw, good, "").status === 503, "503");
const handshake = verifyHandshake({ mode: "subscribe", token: "verify-token", challenge: "12345", expected: "verify-token" });
check("handshake returns the challenge", handshake.ok === true && handshake.challenge === "12345", "challenge");
check("bad handshake is rejected", verifyHandshake({ mode: "subscribe", token: "nope", challenge: "12345", expected: "verify-token" }).ok === false, "bad");

const cipher = encryptToken("EAAsecretTokenValue", "auth-secret-value");
check("stored token is encrypted", !cipher.includes("EAAsecretTokenValue") && decryptToken(cipher, "auth-secret-value") === "EAAsecretTokenValue", "round trip");
check("ids are masked", maskId("106540352242922") === "1065…2922", maskId("106540352242922"));
check("secrets are redacted", redact("code=validcode123 access_token=EAAsecretTokenValue", ["app-secret-value"]).includes("[redacted]"), "redacted");

const company = fs.readFileSync("lib/company.ts", "utf8");
const webhookRoute = fs.readFileSync("app/api/meta/whatsapp/webhook/route.ts", "utf8");
const inboundRoute = fs.readFileSync("lib/whatsapp/inbound.ts", "utf8");
check("guard matches the website number", company.includes(`whatsapp: "${BLOCKED_LIVE_NUMBER}"`), BLOCKED_LIVE_NUMBER);
check("webhook route does not call Graph", !webhookRoute.includes("graph.facebook.com") && !inboundRoute.includes("graph.facebook.com"), "no graph");
check("example env keeps flags false", fs.readFileSync(".env.example", "utf8").includes("WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=false"), "example");

const closed = await exchangeAuthorizationCode({
  code: "validcode123",
  appId: "1588276335845243",
  appSecret: "app-secret-value",
  version: "v26.0",
});
check("exchange without an explicit mock does not call Meta", closed.calledMeta === false && closed.ok === false, closed.error);

const timed = await exchangeAuthorizationCode({
  code: "validcode123",
  appId: "1588276335845243",
  appSecret: "app-secret-value",
  version: "v26.0",
  fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: "EAAsecretTokenValue", expires_in: 3600 }) }),
});
check("mocked expiry is kept off the public token", Boolean(timed.tokenExpiresAt) && !String(timed.tokenExpiresAt).includes("EAA"), timed.tokenExpiresAt || "missing");

const firstCode = rememberAuthorizationCode([], "validcode123");
const secondCode = rememberAuthorizationCode(firstCode.hashes, "validcode123");
check("authorization code replay is rejected", firstCode.replay === false && secondCode.replay === true && !firstCode.hash.includes("validcode123"), "replay");

const missingPhone = acceptSignupPost(
  { session: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: { waba_id: "102290129340398" } } },
  envOff
);
check("missing phone-number id does not call Meta", missingPhone.status === 400 && missingPhone.calledMeta === false, missingPhone.detail);

const simulated = publicStatus(envOff, { mode: "simulated", wabaId: "102290129340398", phoneNumberId: "106540352242922" });
check("dry run is not a connected account", simulated.accountState === "simulated" && simulated.credentialsStored === false && simulated.liveNumberConnected === false && simulated.coexistenceVerified === "not verified", simulated.accountState);

const stored = publicStatus(envOff, {
  mode: "stored",
  tokenCiphertext: "iv.tag.cipher",
  tokenExpiresAt: "2000-01-01T00:00:00.000Z",
  wabaId: "102290129340398",
  phoneNumberId: "106540352242922",
});
check("stored credentials are not marked verified", stored.accountState === "credentials_stored" && stored.tokenExpiry === "expired" && stored.coexistenceVerified === "not verified" && stored.liveNumberConnected === false, stored.accountState);
check("sync and subscription stay off", syncSmbAppData().calledMeta === false && stored.syncCallsEnabled === false && stored.subscriptionChanged === false, "disabled");
check("only the main admin can exchange a code", signupActorAllowed("admin") === true && signupActorAllowed("staff") === false, "admin");
check("failed attempt is not connected", accountStateFor({ mode: "none", lastAttempt: { at: "2026-01-01T00:00:00.000Z", outcome: "blocked", detail: "closed" } }) === "failed", "failed");

const exchangeRoute = fs.readFileSync("app/api/meta/whatsapp/signup/exchange/route.ts", "utf8");
check("live exchange is explicitly gated", exchangeRoute.includes("allowNetwork: true") && !exchangeRoute.includes("smb_app_data") && !exchangeRoute.includes("/register"), "gated");

const failedCount = results.filter((item) => !item.pass).length;
for (const item of results) console.log(`${item.pass ? "ok" : "FAIL"} ${item.name}${item.pass ? "" : ` — ${item.detail}`}`);
console.log(`${results.length - failedCount} passed, ${failedCount} failed`);
if (failedCount) process.exit(1);
