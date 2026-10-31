/**
 * Meta WhatsApp Cloud API for Agent 4: credentials, read-only health checks, gated sending and status updates.
 * Sending stays behind the existing approval flags (`shouldSendWhatsApp`) and never targets the client's live number.
 * Relative imports only, so the pure parts run under `npm run check:phase2`.
 */
import { BLOCKED_LIVE_NUMBER, decryptToken, graphVersion, shouldSendWhatsApp, type StoredCoexistence } from "./coexistence.ts";
import { env, requestJson } from "../ai/http.ts";

export type WaCredentials = { token: string; phoneNumberId: string; wabaId: string; source: "env" | "signup" | "none" };

/** WHATSAPP_* env first, then the encrypted token stored by Embedded Signup. */
export function resolveCredentials(stored: StoredCoexistence | null): WaCredentials {
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID") || stored?.phoneNumberId || "";
  const wabaId = env("WHATSAPP_BUSINESS_ACCOUNT_ID") || stored?.wabaId || "";
  if (token) return { token, phoneNumberId, wabaId, source: "env" };
  if (stored?.mode === "stored" && stored.tokenCiphertext && env("AUTH_SECRET")) {
    try {
      return { token: decryptToken(stored.tokenCiphertext, env("AUTH_SECRET")), phoneNumberId, wabaId, source: "signup" };
    } catch {
      /* fall through: token cannot be read with this AUTH_SECRET */
    }
  }
  return { token: "", phoneNumberId, wabaId, source: "none" };
}

function graphUrl(path: string) {
  return `https://graph.facebook.com/${graphVersion(env("META_GRAPH_API_VERSION"))}${path}`;
}

async function graphGet<T>(creds: WaCredentials, path: string) {
  return requestJson<T>(graphUrl(path), {
    headers: { Authorization: `Bearer ${creds.token}` },
    timeoutMs: 10_000,
    secrets: [creds.token],
  });
}

export type WaCheck = { label: string; ok: boolean | null; detail: string; live: boolean };

/** Token, phone number, WABA, app subscription, templates and webhook config. Sends nothing. */
export async function pingWhatsAppCloud(creds: WaCredentials, webhook: { handshakeAt?: string }) {
  const checks: WaCheck[] = [];
  const verifyToken = Boolean(env("META_WEBHOOK_VERIFY_TOKEN"));
  const appSecret = Boolean(env("META_WEBHOOK_APP_SECRET") || env("META_APP_SECRET"));
  checks.push({
    label: "Webhook verify token and app secret set",
    ok: verifyToken && appSecret,
    live: false,
    detail: `Verify token ${verifyToken ? "set" : "missing (META_WEBHOOK_VERIFY_TOKEN)"} · signature secret ${appSecret ? "set" : "missing (META_WEBHOOK_APP_SECRET or META_APP_SECRET)"}. Callback: /api/meta/whatsapp/webhook.`,
  });
  checks.push({
    label: "Meta verified the webhook callback",
    ok: webhook.handshakeAt ? true : null,
    live: false,
    detail: webhook.handshakeAt
      ? `Meta's verification handshake succeeded at ${webhook.handshakeAt.slice(0, 16)}.`
      : "Meta has not called the verification handshake yet. In the Meta app → WhatsApp → Configuration, set the callback URL and verify token.",
  });
  if (!creds.token || !creds.phoneNumberId) return { configured: false, checks, displayNumber: "" };

  const phone = await graphGet<{
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
    name_status?: string;
  }>(creds, `/${encodeURIComponent(creds.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status`);
  checks.push({
    label: "Access token and phone number ID accepted",
    ok: phone.ok,
    live: true,
    detail: phone.ok
      ? `${phone.data?.verified_name || "Business"} · number …${(phone.data?.display_phone_number || "").replace(/\D/g, "").slice(-4)} · quality ${phone.data?.quality_rating || "unknown"} · name ${phone.data?.name_status || "unknown"}. Token source: ${creds.source}.`
      : phone.status === 401 || /OAuth|token/i.test(phone.error || "")
        ? `Meta rejected the access token (${phone.error}). Generate a System User permanent token with whatsapp_business_messaging and whatsapp_business_management.`
        : `Phone number lookup failed: ${phone.error}. Check WHATSAPP_PHONE_NUMBER_ID.`,
  });
  const displayNumber = (phone.data?.display_phone_number || "").replace(/\D/g, "");
  if (!phone.ok) return { configured: true, checks, displayNumber };

  if (!creds.wabaId) {
    checks.push({ label: "WhatsApp Business Account", ok: false, live: false, detail: "Set WHATSAPP_BUSINESS_ACCOUNT_ID to read subscription and template status." });
  } else {
    const waba = encodeURIComponent(creds.wabaId);
    const [account, subscribed, templates] = await Promise.all([
      graphGet<{ name?: string; account_review_status?: string }>(creds, `/${waba}?fields=name,account_review_status`),
      graphGet<{ data?: unknown[] }>(creds, `/${waba}/subscribed_apps`),
      graphGet<{ data?: { name?: string; status?: string }[] }>(creds, `/${waba}/message_templates?fields=name,status,language&limit=100`),
    ]);
    checks.push({
      label: "Business account readable",
      ok: account.ok,
      live: true,
      detail: account.ok ? `${account.data?.name || "WABA"} · review ${account.data?.account_review_status || "unknown"}.` : `WABA lookup failed: ${account.error}`,
    });
    const subCount = subscribed.data?.data?.length ?? 0;
    checks.push({
      label: "App subscribed to the business account's webhooks",
      ok: subscribed.ok && subCount > 0,
      live: true,
      detail: !subscribed.ok
        ? `Could not read subscriptions: ${subscribed.error}`
        : subCount
          ? `${subCount} app(s) subscribed — Meta will deliver message and status webhooks.`
          : "No app is subscribed to this WABA, so no messages will reach the webhook. Subscribe the app in the Meta dashboard.",
    });
    const approved = (templates.data?.data || []).filter((t) => t.status === "APPROVED").map((t) => t.name || "");
    const wanted = env("WHATSAPP_FOLLOWUP_TEMPLATE");
    checks.push({
      label: "Follow-up template approved",
      ok: templates.ok ? (wanted ? approved.includes(wanted) : null) : false,
      live: true,
      detail: !templates.ok
        ? `Could not read templates: ${templates.error}`
        : wanted
          ? approved.includes(wanted)
            ? `Template "${wanted}" is approved (${approved.length} approved in total).`
            : `Template "${wanted}" is not approved. Approved: ${approved.slice(0, 8).join(", ") || "none"}.`
          : `${approved.length} approved template(s). Set WHATSAPP_FOLLOWUP_TEMPLATE to enable consented follow-ups outside the 24-hour window.`,
    });
  }
  return { configured: true, checks, displayNumber };
}

export type SendGate = { allowed: boolean; reason: string };

/** Every rule a message must pass before it is sent. */
export function sendGate(input: { to: string; suppressed: boolean; template: boolean; windowOpen: boolean; consent: boolean; creds: WaCredentials }): SendGate {
  const to = input.to.replace(/\D/g, "");
  if (!shouldSendWhatsApp(process.env)) return { allowed: false, reason: "WhatsApp sending is off until WHATSAPP_COEXISTENCE_ENABLED, WHATSAPP_PRODUCTION_ONBOARDING_APPROVED and WHATSAPP_OUTBOUND_ENABLED are all true." };
  if (!input.creds.token || !input.creds.phoneNumberId) return { allowed: false, reason: "WhatsApp Cloud API credentials are missing." };
  if (!/^\d{8,15}$/.test(to)) return { allowed: false, reason: "Recipient is not a valid number." };
  if (to === BLOCKED_LIVE_NUMBER) return { allowed: false, reason: "The business's own number cannot be messaged." };
  if (input.suppressed) return { allowed: false, reason: "Recipient opted out." };
  if (!input.template && !input.windowOpen) return { allowed: false, reason: "Free-form replies are only allowed within 24 hours of the customer's last message." };
  if (input.template && !input.consent) return { allowed: false, reason: "Template follow-ups need recorded opt-in consent." };
  return { allowed: true, reason: "ok" };
}

export async function postMessage(creds: WaCredentials, payload: Record<string, unknown>) {
  const res = await requestJson<{ messages?: { id?: string }[] }>(graphUrl(`/${encodeURIComponent(creds.phoneNumberId)}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    timeoutMs: 12_000,
    retries: 1,
    secrets: [creds.token],
  });
  return res.ok ? { ok: true as const, wamid: res.data?.messages?.[0]?.id || "" } : { ok: false as const, error: res.error || "Meta did not accept the message." };
}

export function textPayload(to: string, body: string) {
  return { to: to.replace(/\D/g, ""), type: "text", text: { body: body.slice(0, 4096), preview_url: true } };
}

export function templatePayload(to: string, name: string, language: string, params: string[]) {
  return {
    to: to.replace(/\D/g, ""),
    type: "template",
    template: {
      name,
      language: { code: language || "en" },
      ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.slice(0, 200) })) }] } : {}),
    },
  };
}

export type WaStatusUpdate = { wamid: string; status: string; recipient: string; at: string; error?: string };

/** `statuses[]` from Cloud API webhooks: sent → delivered → read, or failed with an error. */
export function statusUpdatesFromWebhook(body: unknown): WaStatusUpdate[] {
  const root = body as { object?: string; entry?: { changes?: { field?: string; value?: { statuses?: Record<string, unknown>[] } }[] }[] };
  if (root?.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];
  const out: WaStatusUpdate[] = [];
  for (const entry of root.entry) {
    for (const change of entry?.changes || []) {
      if (change?.field !== "messages") continue;
      for (const row of change.value?.statuses || []) {
        const wamid = String(row.id || "");
        if (!wamid) continue;
        const ts = Number(row.timestamp);
        const errors = Array.isArray(row.errors) ? (row.errors as { code?: number; title?: string }[]) : [];
        out.push({
          wamid,
          status: String(row.status || "unknown"),
          recipient: String(row.recipient_id || "").replace(/\D/g, ""),
          at: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
          ...(errors.length ? { error: `${errors[0].code ?? ""} ${errors[0].title ?? ""}`.trim() } : {}),
        });
      }
    }
  }
  return out;
}

/** "STOP", "unsubscribe" and similar end all follow-ups to that number. */
export function isOptOut(text: string) {
  return /^\s*(stop|unsubscribe|opt[ -]?out|cancel|remove me|no more messages)\s*[.!]?\s*$/i.test(text);
}
