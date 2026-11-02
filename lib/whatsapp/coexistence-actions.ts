import { getDb } from "@/lib/mongodb";
import { requestJson } from "@/lib/ai/http";
import {
  coexistenceCallAllowed,
  decryptToken,
  graphVersion,
  numberDecision,
  onboardingSteps,
  SUPPLIED_APP_ID,
  type OnboardingStep,
  type StoredCoexistence,
} from "@/lib/whatsapp/coexistence";
import { clearCredentials, readCoexistenceState, updateOnboardingFields } from "@/lib/whatsapp/store";

/**
 * Post-signup coexistence steps, in Meta's order. Every Graph call passes `coexistenceCallAllowed`
 * (no register/deregister/messages/DELETE), every step must be "available" in `onboardingSteps`,
 * and every attempt is written to ai_audit. Nothing here runs from a webhook.
 */

type ActionResult = { ok: boolean; detail: string; calledMeta: boolean };

function graphBase() {
  return `https://graph.facebook.com/${graphVersion(process.env.META_GRAPH_API_VERSION)}`;
}

function storedToken(state: StoredCoexistence | null) {
  const secret = process.env.AUTH_SECRET?.trim() || "";
  if (state?.mode !== "stored" || !state.tokenCiphertext || !secret) return "";
  try {
    return decryptToken(state.tokenCiphertext, secret);
  } catch {
    return "";
  }
}

async function graph<T>(method: "GET" | "POST", path: string, token: string, body?: Record<string, unknown>) {
  const url = `${graphBase()}${path}`;
  const raw = body ? JSON.stringify(body) : "";
  const allowed = coexistenceCallAllowed(method, url, raw);
  if (!allowed.ok) return { ok: false as const, reached: false, status: 0, data: null, error: allowed.reason };
  const res = await requestJson<T>(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: raw } : {}),
    timeoutMs: 15_000,
    // POSTs here are one-time actions at Meta: never retried automatically.
    retries: method === "GET" ? 1 : 0,
    secrets: [token, process.env.META_APP_SECRET],
  });
  return res;
}

async function audit(action: string, actor: string, result: ActionResult) {
  try {
    const db = await getDb();
    await db.collection("ai_audit").insertOne({ at: new Date().toISOString(), action: `wa_coexistence_${action}`, actor, ok: result.ok, calledMeta: result.calledMeta, detail: result.detail.slice(0, 300) });
  } catch {
    /* audit is best-effort */
  }
}

function step(state: StoredCoexistence | null, id: OnboardingStep["id"]) {
  return onboardingSteps(state, process.env).find((s) => s.id === id)!;
}

/**
 * Read-only: finds the phone number on the onboarded WABA (Meta's coexistence finish may omit it),
 * reads display number, name, is_on_biz_app and platform_type, and applies the test/live-number rules.
 * A number that is not allowed has its credentials removed immediately.
 */
export async function verifyOnboardedNumber(actor: string): Promise<ActionResult> {
  const state = await readCoexistenceState();
  const token = storedToken(state);
  if (!token || !state?.wabaId) return done("verify_number", actor, { ok: false, calledMeta: false, detail: "No stored credentials from a real signup." });

  let phoneNumberId = state.phoneNumberId || "";
  if (!phoneNumberId) {
    const list = await graph<{ data?: { id?: string; display_phone_number?: string }[] }>(
      "GET",
      `/${encodeURIComponent(state.wabaId)}/phone_numbers?fields=id,display_phone_number`,
      token
    );
    if (!list.ok) return done("verify_number", actor, { ok: false, calledMeta: list.reached, detail: `Could not list the account's numbers: ${list.error}` });
    const numbers = list.data?.data || [];
    if (numbers.length !== 1 || !numbers[0].id) {
      return done("verify_number", actor, { ok: false, calledMeta: true, detail: `Expected exactly one phone number on the business account, found ${numbers.length}.` });
    }
    phoneNumberId = String(numbers[0].id);
  }

  const info = await graph<{ display_phone_number?: string; verified_name?: string; is_on_biz_app?: boolean; platform_type?: string }>(
    "GET",
    `/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`,
    token
  );
  if (!info.ok) return done("verify_number", actor, { ok: false, calledMeta: info.reached, detail: `Number lookup failed: ${info.error}` });
  const decision = numberDecision(info.data?.display_phone_number, process.env);
  if (!decision.ok) {
    await clearCredentials({ at: new Date().toISOString(), outcome: "blocked", detail: `${decision.reason} Stored credentials were removed.` });
    return done("verify_number", actor, { ok: false, calledMeta: true, detail: `${decision.reason} The stored token was deleted; nothing was subscribed or synced.` });
  }
  const now = new Date().toISOString();
  await updateOnboardingFields({
    phoneNumberId,
    displayNumber: (info.data?.display_phone_number || "").replace(/\D/g, ""),
    verifiedName: info.data?.verified_name?.slice(0, 120),
    isOnBizApp: info.data?.is_on_biz_app === true,
    platformType: info.data?.platform_type || "",
    numberCheckedAt: now,
    isTestNumber: decision.isTestNumber,
  });
  const coexists = info.data?.is_on_biz_app === true && info.data?.platform_type === "CLOUD_API";
  return done("verify_number", actor, {
    ok: coexists,
    calledMeta: true,
    detail: coexists
      ? `${decision.reason} The number is on the WhatsApp Business app and Cloud API (coexistence).`
      : `${decision.reason} But is_on_biz_app=${String(info.data?.is_on_biz_app)} and platform_type=${info.data?.platform_type || "unknown"}, so coexistence is not active.`,
  });
}

/** POST /{waba}/subscribed_apps — lets Meta deliver this business account's webhooks to the app. */
export async function subscribeApp(actor: string): Promise<ActionResult> {
  const state = await readCoexistenceState();
  const s = step(state, "subscribe_webhooks");
  if (s.state !== "available") return done("subscribe_webhooks", actor, { ok: false, calledMeta: false, detail: s.detail });
  const res = await graph<{ success?: boolean }>("POST", `/${encodeURIComponent(state!.wabaId!)}/subscribed_apps`, storedToken(state));
  if (!res.ok || res.data?.success !== true) {
    return done("subscribe_webhooks", actor, { ok: false, calledMeta: res.reached, detail: `Meta did not confirm the subscription: ${res.error || "no success flag"}` });
  }
  await updateOnboardingFields({ subscribedAt: new Date().toISOString() });
  return done("subscribe_webhooks", actor, { ok: true, calledMeta: true, detail: "App subscribed to the business account's webhooks." });
}

/** POST /{phone-number-id}/smb_app_data — contacts or history. Meta allows each only once, within 24 hours. */
export async function requestSync(kind: "contacts" | "history", actor: string): Promise<ActionResult> {
  const id = kind === "contacts" ? "sync_contacts" : "sync_history";
  const state = await readCoexistenceState();
  const s = step(state, id);
  if (s.state !== "available") return done(id, actor, { ok: false, calledMeta: false, detail: s.detail });
  const res = await graph<{ request_id?: string }>("POST", `/${encodeURIComponent(state!.phoneNumberId!)}/smb_app_data`, storedToken(state), {
    messaging_product: "whatsapp",
    sync_type: kind === "contacts" ? "smb_app_state_sync" : "history",
  });
  // Once Meta has been reached the request may have been used up, so it is never offered again automatically.
  if (res.reached) {
    await updateOnboardingFields(kind === "contacts" ? { contactsSyncRequestedAt: new Date().toISOString() } : { historySyncRequestedAt: new Date().toISOString() });
  }
  if (!res.ok) return done(id, actor, { ok: false, calledMeta: res.reached, detail: `Meta rejected the ${kind} sync: ${res.error}` });
  return done(id, actor, {
    ok: true,
    calledMeta: true,
    detail: `${kind === "contacts" ? "Contacts" : "History"} sync requested (request ${res.data?.request_id ? "accepted" : "sent"}). Results arrive as ${kind === "contacts" ? "smb_app_state_sync" : "history"} webhooks.`,
  });
}

async function done(action: string, actor: string, result: ActionResult) {
  await audit(action, actor, result);
  return result;
}

/**
 * Read-only: which WhatsApp webhook fields the Meta app is subscribed to (GET /{app-id}/subscriptions with the
 * app token). Used by /test to verify history, smb_app_state_sync and smb_message_echoes are subscribed.
 */
export async function appWebhookFields(): Promise<{ ok: boolean; fields: string[]; callbackUrl: string; detail: string }> {
  const appId = process.env.META_APP_ID?.trim() || SUPPLIED_APP_ID;
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return { ok: false, fields: [], callbackUrl: "", detail: "META_APP_SECRET is not set." };
  const res = await graph<{ data?: { object?: string; callback_url?: string; active?: boolean; fields?: { name?: string }[] }[] }>(
    "GET",
    `/${encodeURIComponent(appId)}/subscriptions`,
    `${appId}|${secret}`
  );
  if (!res.ok) return { ok: false, fields: [], callbackUrl: "", detail: `Could not read the app's webhook subscriptions: ${res.error}` };
  const waba = (res.data?.data || []).find((row) => row.object === "whatsapp_business_account");
  if (!waba) return { ok: true, fields: [], callbackUrl: "", detail: "The app has no WhatsApp Business Account webhook subscription." };
  return {
    ok: true,
    fields: (waba.fields || []).map((f) => String(f.name || "")).filter(Boolean),
    callbackUrl: waba.callback_url || "",
    detail: waba.active === false ? "Subscription exists but is inactive." : "Subscription is active.",
  };
}
