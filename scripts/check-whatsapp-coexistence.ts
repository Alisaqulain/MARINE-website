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
  coexistenceCallAllowed,
  coexistenceMode,
  coexistenceUpdates,
  normalizePhone,
  numberDecision,
  onboardingSteps,
  outboundAllowed,
  signupMode,
  testNumber,
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
const extras = embeddedSignupLaunch("1760993601871515").extras;
check("v4 launch sends the coexistence featureType", status.featureTypeIncluded === true && extras.featureType === "whatsapp_business_app_onboarding" && JSON.stringify(extras.setup) === "{}" && extras.sessionInfoVersion === "3", JSON.stringify(extras));
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

// Meta's coexistence finish event may carry only waba_id: it is valid, but still closed without approval or a test number.
const wabaOnly = { code: "validcode12345", session: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: { waba_id: "102290129340398" } } };
const missingPhone = acceptSignupPost(wabaOnly, envOff);
check("waba-only finish is blocked while onboarding is closed", missingPhone.status === 403 && missingPhone.calledMeta === false && missingPhone.code === undefined, missingPhone.detail);
const envTest = { ...envOff, META_APP_SECRET: "secret-value", AUTH_SECRET: "auth-secret-value", WHATSAPP_COEXISTENCE_ENABLED: "true", WHATSAPP_COEXISTENCE_TEST_NUMBER: "9027497288" };
const testFinish = acceptSignupPost(wabaOnly, envTest);
check("waba-only finish is accepted in test mode (phone id looked up later)", testFinish.outcome === "exchanged" && testFinish.wabaId === "102290129340398" && testFinish.phoneNumberId === undefined, testFinish.detail);

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
check("sync and subscription stay off before verification", stored.syncCallsEnabled === false && stored.subscriptionChanged === false && stored.steps.every((step) => step.state !== "available" || step.id === "verify_number"), JSON.stringify(stored.steps.map((x) => x.state)));
check("only the main admin can exchange a code", signupActorAllowed("admin") === true && signupActorAllowed("staff") === false, "admin");
check("failed attempt is not connected", accountStateFor({ mode: "none", lastAttempt: { at: "2026-01-01T00:00:00.000Z", outcome: "blocked", detail: "closed" } }) === "failed", "failed");

const exchangeRoute = fs.readFileSync("app/api/meta/whatsapp/signup/exchange/route.ts", "utf8");
check("live exchange is explicitly gated", exchangeRoute.includes("allowNetwork: true") && !exchangeRoute.includes("smb_app_data") && !exchangeRoute.includes("/register"), "gated");

// ── Test-number gating (test phone 9027497288) ──
check("10-digit Indian number gets +91", normalizePhone("9027497288") === "919027497288" && normalizePhone("+91 90274 97288") === "919027497288", normalizePhone("9027497288"));
check("test number is read from the env", testNumber(envTest) === "919027497288" && testNumber(envOff) === "", testNumber(envTest));
check("the live number can never be the test number", testNumber({ WHATSAPP_COEXISTENCE_TEST_NUMBER: BLOCKED_LIVE_NUMBER }) === "", "blocked");
const envProd = { ...envTest, WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "true" };
check("signup modes: closed / test / production", signupMode(envOff) === "closed" && signupMode(envTest) === "test" && signupMode(envProd) === "production" && signupMode({ ...envTest, WHATSAPP_COEXISTENCE_TEST_NUMBER: "" }) === "closed", [signupMode(envOff), signupMode(envTest), signupMode(envProd)].join(","));
check("test mode accepts the test number", numberDecision("+91 90274 97288", envTest).ok === true && numberDecision("+91 90274 97288", envTest).isTestNumber === true, numberDecision("+91 90274 97288", envTest).reason);
check("test mode refuses any other number", numberDecision("+1 555 078 3881", envTest).ok === false, numberDecision("+1 555 078 3881", envTest).reason);
check("test mode refuses the client's live number", numberDecision(BLOCKED_LIVE_NUMBER, envTest).ok === false, numberDecision(BLOCKED_LIVE_NUMBER, envTest).reason);
check("live number needs written production approval", numberDecision(BLOCKED_LIVE_NUMBER, envProd).ok === true, "production");
check("closed mode refuses every number", numberDecision("919027497288", envOff).ok === false, "closed");

// ── Graph allow-list for post-signup steps ──
const g = "https://graph.facebook.com/v26.0";
check("register is never allowed", coexistenceCallAllowed("POST", `${g}/106540352242922/register`, JSON.stringify({ messaging_product: "whatsapp", pin: "123456" })).ok === false, "register");
check("deregister is never allowed", coexistenceCallAllowed("POST", `${g}/106540352242922/deregister`).ok === false, "deregister");
check("messages are not sent through onboarding", coexistenceCallAllowed("POST", `${g}/106540352242922/messages`, "{}").ok === false, "messages");
check("DELETE is never allowed", coexistenceCallAllowed("DELETE", `${g}/102290129340398/subscribed_apps`).ok === false, "delete");
check("read-only number lookup is allowed", coexistenceCallAllowed("GET", `${g}/106540352242922?fields=display_phone_number,is_on_biz_app,platform_type`).ok === true, "get");
check("listing the WABA's numbers is allowed", coexistenceCallAllowed("GET", `${g}/102290129340398/phone_numbers?fields=id`).ok === true, "list");
check("subscribing the app to the WABA is allowed", coexistenceCallAllowed("POST", `${g}/102290129340398/subscribed_apps`).ok === true, "subscribe");
check("contacts and history sync are allowed", coexistenceCallAllowed("POST", `${g}/106540352242922/smb_app_data`, JSON.stringify({ messaging_product: "whatsapp", sync_type: "history" })).ok === true && coexistenceCallAllowed("POST", `${g}/106540352242922/smb_app_data`, JSON.stringify({ messaging_product: "whatsapp", sync_type: "smb_app_state_sync" })).ok === true, "sync");
check("unknown sync types are refused", coexistenceCallAllowed("POST", `${g}/106540352242922/smb_app_data`, JSON.stringify({ sync_type: "everything" })).ok === false, "bad sync");
check("the live number in any call is refused", coexistenceCallAllowed("GET", `${g}/${BLOCKED_LIVE_NUMBER}`).ok === false, "live");
check("other POSTs are refused", coexistenceCallAllowed("POST", `${g}/102290129340398/assigned_users`).ok === false && coexistenceCallAllowed("POST", "https://evil.example.com/v26.0/1/subscribed_apps").ok === false, "other");

// ── One-time steps within 24 hours ──
const onboardedAt = "2026-11-02T10:00:00.000Z";
const t0 = Date.parse(onboardedAt);
const base = { mode: "stored", tokenCiphertext: "iv.tag.cipher", wabaId: "102290129340398", phoneNumberId: "106540352242922", onboardedAt };
const st = (state, now = t0 + 3_600_000) => Object.fromEntries(onboardingSteps(state, envTest, now).map((x) => [x.id, x.state]));
check("no token → nothing can run", JSON.stringify(st(null)) === JSON.stringify({ verify_number: "blocked", subscribe_webhooks: "blocked", sync_contacts: "blocked", sync_history: "blocked" }), JSON.stringify(st(null)));
check("with a token → only the read-only number check", st(base).verify_number === "available" && st(base).subscribe_webhooks === "blocked" && st(base).sync_history === "blocked", JSON.stringify(st(base)));
const verified = { ...base, numberCheckedAt: onboardedAt, displayNumber: "919027497288", isOnBizApp: true, platformType: "CLOUD_API", isTestNumber: true };
check("verified test number → subscribe available, syncs wait", st(verified).verify_number === "done" && st(verified).subscribe_webhooks === "available" && st(verified).sync_contacts === "blocked", JSON.stringify(st(verified)));
const notOnApp = { ...verified, isOnBizApp: false };
check("number not on the Business app → cannot subscribe or sync", st(notOnApp).subscribe_webhooks === "blocked" && st(notOnApp).sync_history === "blocked", JSON.stringify(st(notOnApp)));
const subscribed = { ...verified, subscribedAt: onboardedAt };
check("subscribed within 24 h → both syncs available", st(subscribed).sync_contacts === "available" && st(subscribed).sync_history === "available", JSON.stringify(st(subscribed)));
check("after 24 h → syncs expired", st(subscribed, t0 + 25 * 3_600_000).sync_history === "expired", JSON.stringify(st(subscribed, t0 + 25 * 3_600_000)));
check("each sync runs only once", st({ ...subscribed, historySyncRequestedAt: onboardedAt }).sync_history === "done" && st({ ...subscribed, historySyncRequestedAt: onboardedAt }).sync_contacts === "available", "once");
const otherNumber = { ...verified, displayNumber: "15550783881", isTestNumber: false };
check("a non-test number stays blocked in test mode", st(otherNumber).verify_number === "blocked" && st(otherNumber).subscribe_webhooks === "blocked", JSON.stringify(st(otherNumber)));

// ── Coexistence webhooks: history, contact sync, Business-app echoes ──
const fullHistory = {
  object: "whatsapp_business_account",
  entry: [{
    id: "102290129340398",
    changes: [{
      field: "history",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "919027497288", phone_number_id: "106540352242922" },
        history: [{
          metadata: { phase: 1, chunk_order: 2, progress: 40 },
          threads: [{
            id: "16505551234",
            messages: [
              { from: "16505551234", id: "wamid.H1", timestamp: "1738346006", type: "text", text: { body: "Do you ship to Dubai?" }, history_context: { status: "READ" } },
              { from: "919027497288", to: "16505551234", id: "wamid.H2", timestamp: "1738346106", type: "text", text: { body: "Yes we do" }, history_context: { status: "DELIVERED" } },
            ],
          }],
        }],
      },
    }],
  }],
};
const updates = coexistenceUpdates(fullHistory);
const h = updates.history[0];
check("history chunk: phase, progress and both sides of the chat", h.phase === 1 && h.chunk === 2 && h.progress === 40 && h.messages.length === 2 && h.messages[0].fromBusiness === false && h.messages[1].fromBusiness === true && h.messages.every((m) => m.customer === "16505551234"), JSON.stringify(h));
check("history key matches the duplicate store key", h.key === normaliseWebhook(fullHistory)[0].key, h.key);
const declinedBody = {
  object: "whatsapp_business_account",
  entry: [{ id: "102290129340398", changes: [{ field: "history", value: { history: [{ errors: [{ code: 2593109, title: "History sync is turned off by the business from the WhatsApp Business App" }] }] } }] }],
};
check("declined history sharing is detected", coexistenceUpdates(declinedBody).history[0].declined === true && coexistenceUpdates(declinedBody).history[0].messages.length === 0, "2593109");
const contacts = coexistenceUpdates(sync).contacts;
check("contact sync parsed with name and key", contacts.length === 1 && contacts[0].phone === "16505551234" && contacts[0].fullName === "Test Contact" && contacts[0].action === "add" && contacts[0].key === normaliseWebhook(sync)[0].key, JSON.stringify(contacts));
const echoes = coexistenceUpdates(echo).echoes;
check("Business-app echo parsed as a reply to the customer", echoes.length === 1 && echoes[0].customer === "16505551234" && echoes[0].text === "sent from the phone" && echoes[0].key === normaliseWebhook(echo)[0].key, JSON.stringify(echoes));
const revoke = coexistenceUpdates({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "smb_message_echoes", value: { message_echoes: [{ id: "wamid.R", to: "16505551234", type: "revoke", revoke: { original_message_id: "wamid.ECHO" } }] } }] }] }).echoes[0];
check("deleted Business-app message is tracked", revoke.revokeOf === "wamid.ECHO", JSON.stringify(revoke));
check("non-WhatsApp bodies yield nothing", JSON.stringify(coexistenceUpdates({ object: "page" })) === JSON.stringify({ history: [], contacts: [], echoes: [] }), "empty");
const seenTwice = new Set();
const dupStore = { has: (k) => seenTwice.has(k), add: (k) => seenTwice.add(k) };
const firstHistory = planEvents(normaliseWebhook(fullHistory), dupStore)[0];
const secondHistory = planEvents(normaliseWebhook(fullHistory), dupStore)[0];
check("repeated history chunk is a duplicate", firstHistory.reason !== "duplicate" && secondHistory.reason === "duplicate", secondHistory.reason);

// ── Automatic replies ──
const envTestOut = { ...envTest, WHATSAPP_OUTBOUND_ENABLED: "true" };
check("test replies only from the verified test number", outboundAllowed(envTestOut, "919027497288") === true && outboundAllowed(envTestOut, "15550783881") === false && outboundAllowed(envTestOut, BLOCKED_LIVE_NUMBER) === false, "test");
check("no replies without the outbound flag", outboundAllowed(envTest, "919027497288") === false, "flag");
check("production replies need all three flags", outboundAllowed({ ...envProd, WHATSAPP_OUTBOUND_ENABLED: "true" }, BLOCKED_LIVE_NUMBER) === true && outboundAllowed(envProd, BLOCKED_LIVE_NUMBER) === false, "prod");

// ── Status modes ──
const envReady = { ...envTest, META_WEBHOOK_VERIFY_TOKEN: "verify-token" };
check("mode: not configured without secrets", coexistenceMode(envOff, null) === "not_configured", coexistenceMode(envOff, null));
check("mode: test with a test number", coexistenceMode(envReady, null) === "test" && coexistenceMode(envReady, subscribed) === "test", coexistenceMode(envReady, subscribed));
const envReadyProd = { ...envReady, WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "true" };
check("mode: ready for onboarding after approval", coexistenceMode(envReadyProd, null) === "ready_for_onboarding", coexistenceMode(envReadyProd, null));
const liveState = { ...subscribed, displayNumber: BLOCKED_LIVE_NUMBER, isTestNumber: false };
check("mode: live only for a verified, subscribed production number", coexistenceMode(envReadyProd, liveState) === "live" && coexistenceMode(envReadyProd, { ...liveState, subscribedAt: undefined }) === "ready_for_onboarding", coexistenceMode(envReadyProd, liveState));
const shown = JSON.stringify(publicStatus(envReady, { ...subscribed, tokenCiphertext: "iv.tag.SECRETCIPHER" }));
check("status never exposes the token or the full test number", !shown.includes("SECRETCIPHER") && !shown.includes("9027497288") && shown.includes("…7288"), "masked");
const coexRoute = fs.readFileSync("app/api/meta/whatsapp/coexistence/route.ts", "utf8");
check("onboarding steps need the main admin, same origin and confirmation", coexRoute.includes("signupActorAllowed") && coexRoute.includes("originMatches") && coexRoute.includes("confirm !== true"), "route");
const exchangeSrc = fs.readFileSync("app/api/meta/whatsapp/signup/exchange/route.ts", "utf8");
check("exchange checks the onboarded number right away", exchangeSrc.includes("verifyOnboardedNumber") && exchangeSrc.includes("startOnboarding"), "verify");

const failedCount = results.filter((item) => !item.pass).length;
for (const item of results) console.log(`${item.pass ? "ok" : "FAIL"} ${item.name}${item.pass ? "" : ` — ${item.detail}`}`);
console.log(`${results.length - failedCount} passed, ${failedCount} failed`);
if (failedCount) process.exit(1);
