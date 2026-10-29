import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Digits for the live Marina Muse WhatsApp Business app number. Graph calls that include it are refused. */
export const BLOCKED_LIVE_NUMBER = "917457099540";

/** Embedded Signup implementation guide names v26.0 as the latest Graph API version to pass to FB.init. */
export const DEFAULT_GRAPH_API_VERSION = "v26.0";

export const SUPPLIED_APP_ID = "1588276335845243";
export const SUPPLIED_CONFIG_ID = "1760993601871515";

const BLOCKED_GRAPH_PATHS = ["/register", "/deregister", "/smb_app_data", "/messages", "/subscribed_apps"];

export type FlagState = {
  coexistenceEnabled: boolean;
  productionOnboardingApproved: boolean;
  outboundEnabled: boolean;
};

export type AccountState = "not_connected" | "simulated" | "credentials_stored" | "failed";

export type StoredCoexistence = {
  mode: "none" | "simulated" | "stored";
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  tokenCiphertext?: string;
  tokenExpiresAt?: string;
  usedCodeHashes?: string[];
  webhookHandshakeAt?: string;
  lastAttempt?: {
    at: string;
    outcome: "cancelled" | "denied" | "invalid" | "simulated" | "exchanged" | "exchange_failed" | "blocked";
    event?: string;
    detail: string;
  };
};

export type PublicWhatsAppStatus = {
  appId: string;
  configId: string;
  graphVersion: string;
  embeddedSignupVersion: "v4";
  featureTypeIncluded: false;
  featureTypeNote: string;
  permissions: ["whatsapp_business_messaging", "whatsapp_business_management"];
  appSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  verifyTokenConfigured: boolean;
  flags: FlagState;
  signupAllowed: boolean;
  outboundDeliveryWired: false;
  credentialsStored: boolean;
  credentialMode: StoredCoexistence["mode"];
  accountState: AccountState;
  idSource: "none" | "dry_run" | "signup";
  wabaIdMasked: string | null;
  phoneNumberIdMasked: string | null;
  businessIdMasked: string | null;
  tokenExpiry: string;
  webhookHandshake: "not seen" | "token matched";
  webhookSubscription: "not verified";
  coexistenceVerified: "not verified";
  liveNumberConnected: false;
  liveNumberTouched: false;
  syncCallsEnabled: false;
  subscriptionChanged: false;
  lastAttempt: StoredCoexistence["lastAttempt"] | null;
  launch: ReturnType<typeof embeddedSignupLaunch>;
  checklist: { id: string; label: string; done: boolean; note: string }[];
  blockers: string[];
};

export function flagOn(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function readFlags(env: NodeJS.ProcessEnv): FlagState {
  return {
    coexistenceEnabled: flagOn(env.WHATSAPP_COEXISTENCE_ENABLED),
    productionOnboardingApproved: flagOn(env.WHATSAPP_PRODUCTION_ONBOARDING_APPROVED),
    outboundEnabled: flagOn(env.WHATSAPP_OUTBOUND_ENABLED),
  };
}

export function graphVersion(raw: string | undefined) {
  const value = raw?.trim() || DEFAULT_GRAPH_API_VERSION;
  return /^v\d+\.\d+$/.test(value) ? value : DEFAULT_GRAPH_API_VERSION;
}

export function embeddedSignupLaunch(configId: string) {
  return {
    config_id: configId,
    response_type: "code" as const,
    override_default_response_type: true,
    extras: {} as Record<string, never>,
  };
}

export function maskId(value: string | undefined | null) {
  const id = value?.trim() || "";
  if (!/^\d{6,20}$/.test(id)) return null;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function cleanMetaId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^\d{6,20}$/.test(id)) return null;
  if (id === BLOCKED_LIVE_NUMBER || id.endsWith(BLOCKED_LIVE_NUMBER)) return null;
  return id;
}

export function redact(value: string, secrets: string[] = []) {
  let out = value;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join("[redacted]");
  }
  return out
    .replace(/EAA[A-Za-z0-9]+/g, "[redacted-token]")
    .replace(/(code|access_token|client_secret)=([^&\s]+)/gi, "$1=[redacted]");
}

export function encryptToken(token: string, secret: string) {
  const key = scryptSync(secret, "marina-wa-coexistence", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(payload: string, secret: string) {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Token payload is incomplete.");
  const key = scryptSync(secret, "marina-wa-coexistence", 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export function graphCallAllowed(url: string, body = "") {
  const haystack = `${url}\n${body}`;
  if (haystack.includes(BLOCKED_LIVE_NUMBER)) {
    return { ok: false as const, reason: "The client's live WhatsApp number is blocked." };
  }
  const path = url.split("?")[0].toLowerCase();
  for (const blocked of BLOCKED_GRAPH_PATHS) {
    if (path.includes(blocked)) return { ok: false as const, reason: `Blocked Graph path ${blocked}.` };
  }
  if (!/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/oauth\/access_token$/.test(path)) {
    return { ok: false as const, reason: "Only the authorization-code exchange endpoint is allowed." };
  }
  return { ok: true as const };
}

export function productionSignupAllowed(env: NodeJS.ProcessEnv) {
  const flags = readFlags(env);
  return Boolean(
    flags.coexistenceEnabled &&
      flags.productionOnboardingApproved &&
      env.META_APP_SECRET?.trim() &&
      env.AUTH_SECRET?.trim()
  );
}

export type SignupBody = {
  dryRun?: boolean;
  code?: string;
  loginStatus?: string;
  session?: {
    type?: string;
    event?: string;
    data?: {
      waba_id?: unknown;
      phone_number_id?: unknown;
      business_id?: unknown;
      current_step?: unknown;
      error_message?: unknown;
    };
  };
};

export type SignupDecision = {
  status: number;
  outcome: NonNullable<StoredCoexistence["lastAttempt"]>["outcome"];
  calledMeta: false;
  store: "none" | "simulated";
  detail: string;
  event?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  code?: string;
};

export function acceptSignupPost(body: SignupBody, env: NodeJS.ProcessEnv): SignupDecision {
  const event = String(body.session?.event || "");
  const wabaId = cleanMetaId(body.session?.data?.waba_id);
  const phoneNumberId = cleanMetaId(body.session?.data?.phone_number_id);
  const businessId = cleanMetaId(body.session?.data?.business_id);
  const liveBlocked =
    String(body.session?.data?.waba_id || "") === BLOCKED_LIVE_NUMBER ||
    String(body.session?.data?.phone_number_id || "") === BLOCKED_LIVE_NUMBER;

  if (liveBlocked) {
    return {
      status: 400,
      outcome: "invalid",
      calledMeta: false,
      store: "none",
      event,
      detail: "The client's live number cannot be used in this flow.",
    };
  }
  if (event && body.session?.type !== "WA_EMBEDDED_SIGNUP") {
    return {
      status: 400,
      outcome: "invalid",
      calledMeta: false,
      store: "none",
      event,
      detail: "Signup session was not a WhatsApp Embedded Signup event. Meta was not called.",
    };
  }
  if (event === "CANCEL" || body.loginStatus === "unknown") {
    return { status: 200, outcome: "cancelled", calledMeta: false, store: "none", event, detail: "Signup was cancelled before Meta was called." };
  }
  if (event === "ERROR" || body.loginStatus === "not_authorized") {
    return {
      status: 200,
      outcome: "denied",
      calledMeta: false,
      store: "none",
      event,
      detail: "Signup did not grant the requested permissions. Meta was not called.",
    };
  }
  if (body.dryRun === true) {
    if (event !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" || !wabaId || !phoneNumberId) {
      return {
        status: 400,
        outcome: "invalid",
        calledMeta: false,
        store: "none",
        event,
        detail: "Dry run needs a coexistence finish event with a WABA id and phone-number id.",
      };
    }
    return {
      status: 200,
      outcome: "simulated",
      calledMeta: false,
      store: "simulated",
      event,
      wabaId,
      phoneNumberId,
      businessId: businessId || undefined,
      detail: "Simulated coexistence finish. No Meta request was made and no token was stored.",
    };
  }
  if (event === "FINISH") {
    return {
      status: 409,
      outcome: "invalid",
      calledMeta: false,
      store: "none",
      event,
      detail: "Standard Cloud API finish is not coexistence. The phone number was not registered.",
    };
  }
  if (event !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" || !wabaId || !phoneNumberId) {
    return {
      status: 400,
      outcome: "invalid",
      calledMeta: false,
      store: "none",
      event,
      detail: "Coexistence signup did not return a WABA id and phone-number id. Nothing was registered.",
    };
  }
  if (!productionSignupAllowed(env)) {
    return {
      status: 403,
      outcome: "blocked",
      calledMeta: false,
      store: "none",
      event,
      detail: "Live onboarding is not approved. The authorization code was not sent to Meta.",
    };
  }
  const code = String(body.code || "").trim();
  if (!/^[A-Za-z0-9_-]{8,512}$/.test(code)) {
    return {
      status: 400,
      outcome: "invalid",
      calledMeta: false,
      store: "none",
      event,
      detail: "Authorization code was missing or expired. Meta was not called.",
    };
  }
  return {
    status: 200,
    outcome: "exchanged",
    calledMeta: false,
    store: "none",
    event,
    wabaId,
    phoneNumberId: phoneNumberId || undefined,
    businessId: businessId || undefined,
    code,
    detail: "Authorization code accepted for a server-side exchange.",
  };
}

export function rememberAuthorizationCode(hashes: string[] | undefined, code: string) {
  const hash = createHash("sha256").update(code).digest("hex");
  const existing = hashes || [];
  if (existing.includes(hash)) return { replay: true as const, hashes: existing, hash };
  return { replay: false as const, hashes: [...existing, hash].slice(-30), hash };
}

export function signupActorAllowed(role: string | undefined) {
  return role === "admin";
}

export function syncSmbAppData() {
  return {
    ok: false as const,
    calledMeta: false as const,
    reason: "Contact sync and history sync stay disabled until a separate written approval.",
  };
}

export function accountStateFor(stored: StoredCoexistence | null): AccountState {
  if (stored?.mode === "stored" && stored.tokenCiphertext) return "credentials_stored";
  if (stored?.mode === "simulated") return "simulated";
  const outcome = stored?.lastAttempt?.outcome;
  if (outcome === "denied" || outcome === "invalid" || outcome === "exchange_failed" || outcome === "blocked") return "failed";
  return "not_connected";
}

export function tokenExpiryLabel(iso: string | undefined, now = Date.now()) {
  if (!iso) return "not provided" as const;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "not provided" as const;
  if (time <= now) return "expired" as const;
  return `expires ${iso.slice(0, 10)}` as const;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  appId: string;
  appSecret: string;
  version: string;
  fetchImpl?: typeof fetch;
  allowNetwork?: boolean;
}) {
  const version = graphVersion(input.version);
  const url = `https://graph.facebook.com/${version}/oauth/access_token`;
  const params = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    code: input.code,
    grant_type: "authorization_code",
  });
  const allowed = graphCallAllowed(url, params.toString());
  if (!allowed.ok) {
    return { ok: false as const, status: 403, calledMeta: false, error: allowed.reason };
  }
  if (!input.fetchImpl && input.allowNetwork !== true) {
    return {
      ok: false as const,
      status: 403,
      calledMeta: false,
      error: "Live Meta exchange is closed unless this call is explicitly allowed.",
    };
  }
  const fetchImpl = input.fetchImpl || fetch;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  } | null;
  if (!res.ok || !data?.access_token) {
    const message = redact(data?.error?.message || "Meta did not return a token.", [input.appSecret, input.code]);
    return { ok: false as const, status: 502, calledMeta: true, error: message.slice(0, 180) };
  }
  const expiresIn = Number(data.expires_in);
  const tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
  return { ok: true as const, status: 200, calledMeta: true, token: data.access_token, tokenExpiresAt };
}

export function uiApprovalDecision() {
  return {
    approved: false as const,
    status: 403,
    error: "Production onboarding cannot be approved from the website. Change the environment flags only after written approval, then restart the server.",
  };
}

export function verifyHandshake(input: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expected: string | undefined;
}) {
  const expected = input.expected?.trim() || "";
  if (!expected) return { ok: false as const, status: 503, error: "Webhook verify token is not configured." };
  const given = input.token || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (input.mode !== "subscribe" || !match || !input.challenge) {
    return { ok: false as const, status: 403, error: "Webhook verification was rejected." };
  }
  return { ok: true as const, challenge: input.challenge };
}

export function verifySignature(raw: string, header: string | null, secret: string | undefined) {
  const key = secret?.trim() || "";
  if (!key) return { ok: false as const, status: 503, error: "Webhook secret is not configured." };
  if (!header?.startsWith("sha256=")) return { ok: false as const, status: 401, error: "Webhook signature was rejected." };
  const digest = createHmac("sha256", key).update(raw).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const got = Buffer.from(header);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false as const, status: 401, error: "Webhook signature was rejected." };
  }
  return { ok: true as const };
}

export type WaEvent = {
  key: string;
  field: string;
  wabaId: string;
  phoneNumberId: string | null;
  messageId: string | null;
  kind: "history" | "state_sync" | "echo" | "inbound" | "account" | "other";
  text: string | null;
  fromBusiness: boolean;
};

export type WaPlan = WaEvent & { action: "ignore" | "draft"; reason: string; send: false };

type Change = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    messages?: { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }[];
    message_echoes?: { id?: string; from?: string; to?: string; timestamp?: string; type?: string; text?: { body?: string } }[];
    state_sync?: { action?: string; contact?: { phone_number?: string }; metadata?: { timestamp?: string } }[];
    history?: { metadata?: { phase?: number; chunk_order?: number; progress?: number }; errors?: { code?: number }[]; threads?: unknown[] }[];
    event?: string;
  };
};

function digits(value: string | undefined) {
  return (value || "").replace(/\D/g, "");
}

function samePhone(a: string | undefined, b: string | undefined) {
  const left = digits(a);
  const right = digits(b);
  return Boolean(left && right && (left === right || left.endsWith(right) || right.endsWith(left)));
}

export function normaliseWebhook(body: unknown): WaEvent[] {
  const root = body as { object?: string; entry?: { id?: string; changes?: Change[] }[] };
  if (root?.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];
  const events: WaEvent[] = [];
  for (const entry of root.entry) {
    const wabaId = String(entry?.id || "");
    for (const change of entry?.changes || []) {
      const field = String(change?.field || "unknown");
      const value = change?.value || {};
      const phoneNumberId = cleanMetaId(value.metadata?.phone_number_id);
      const display = value.metadata?.display_phone_number;
      if (field === "history") {
        const phase = value.history?.[0]?.metadata?.phase ?? "na";
        const chunk = value.history?.[0]?.metadata?.chunk_order ?? "na";
        const declined = value.history?.some((row) => row.errors?.some((error) => error.code === 2593109));
        events.push({
          key: `history:${wabaId}:${declined ? "declined" : `${phase}:${chunk}`}`,
          field,
          wabaId,
          phoneNumberId,
          messageId: null,
          kind: "history",
          text: null,
          fromBusiness: false,
        });
        continue;
      }
      if (field === "smb_app_state_sync") {
        const rows = value.state_sync?.length ? value.state_sync : [{}];
        for (const row of rows) {
          const phone = digits(row.contact?.phone_number).slice(-8) || "unknown";
          const stamp = row.metadata?.timestamp || "0";
          events.push({
            key: `sync:${wabaId}:${phone}:${row.action || "unknown"}:${stamp}`,
            field,
            wabaId,
            phoneNumberId,
            messageId: null,
            kind: "state_sync",
            text: null,
            fromBusiness: false,
          });
        }
        continue;
      }
      if (field === "smb_message_echoes") {
        for (const echo of value.message_echoes || []) {
          events.push({
            key: `echo:${echo.id || `${wabaId}:${echo.timestamp || "0"}`}`,
            field,
            wabaId,
            phoneNumberId,
            messageId: echo.id || null,
            kind: "echo",
            text: null,
            fromBusiness: true,
          });
        }
        continue;
      }
      if (field === "messages") {
        for (const message of value.messages || []) {
          const text = message.type === "text" ? String(message.text?.body || "").trim().slice(0, 2000) : null;
          events.push({
            key: message.id ? `msg:${message.id}` : `msg:${wabaId}:${digits(message.from)}:${message.timestamp || "0"}`,
            field,
            wabaId,
            phoneNumberId,
            messageId: message.id || null,
            kind: "inbound",
            text,
            fromBusiness: samePhone(message.from, display),
          });
        }
        continue;
      }
      if (field === "account_update") {
        events.push({
          key: `account:${wabaId}:${value.event || "update"}`,
          field,
          wabaId,
          phoneNumberId,
          messageId: null,
          kind: "account",
          text: null,
          fromBusiness: false,
        });
        continue;
      }
      events.push({
        key: `other:${wabaId}:${field}`,
        field,
        wabaId,
        phoneNumberId,
        messageId: null,
        kind: "other",
        text: null,
        fromBusiness: false,
      });
    }
  }
  return events;
}

export type Seen = { has(key: string): boolean; add(key: string): void };

export function planEvents(events: WaEvent[], seen: Seen): WaPlan[] {
  return events.map((event) => {
    if (seen.has(event.key)) {
      return { ...event, action: "ignore" as const, reason: "duplicate", send: false as const };
    }
    seen.add(event.key);
    if (event.kind === "history") {
      return { ...event, action: "ignore" as const, reason: "historical sync does not get a reply", send: false as const };
    }
    if (event.kind === "state_sync") {
      return { ...event, action: "ignore" as const, reason: "contact sync does not get a reply", send: false as const };
    }
    if (event.kind === "echo") {
      return { ...event, action: "ignore" as const, reason: "business-app echo does not get a reply", send: false as const };
    }
    if (event.kind === "account" || event.kind === "other") {
      return { ...event, action: "ignore" as const, reason: "lifecycle event does not get a reply", send: false as const };
    }
    if (!event.messageId) {
      return { ...event, action: "ignore" as const, reason: "inbound message has no id", send: false as const };
    }
    if (event.fromBusiness || !event.text) {
      return { ...event, action: "ignore" as const, reason: "inbound message is not a new customer text", send: false as const };
    }
    return { ...event, action: "draft" as const, reason: "new customer text can be drafted and withheld", send: false as const };
  });
}

export function webhookSummary(plans: WaPlan[]) {
  return {
    ok: true as const,
    received: plans.length,
    draftsWithheld: plans.filter((plan) => plan.action === "draft").length,
    sent: 0 as const,
  };
}

export function shouldSendWhatsApp(env: NodeJS.ProcessEnv) {
  const flags = readFlags(env);
  return flags.coexistenceEnabled && flags.productionOnboardingApproved && flags.outboundEnabled;
}

export function publicStatus(env: NodeJS.ProcessEnv, stored: StoredCoexistence | null): PublicWhatsAppStatus {
  const flags = readFlags(env);
  const appId = env.META_APP_ID?.trim() || SUPPLIED_APP_ID;
  const configId = env.META_CONFIG_ID?.trim() || SUPPLIED_CONFIG_ID;
  const version = graphVersion(env.META_GRAPH_API_VERSION);
  const signupAllowed = productionSignupAllowed(env);
  const mode = stored?.mode || "none";
  const credentialsStored = mode === "stored" && Boolean(stored?.tokenCiphertext);
  const state = accountStateFor(stored);
  const blockers = [
    "This app cannot see Meta app 1588276335845243. Configuration 1760993601871515 is not confirmed as coexistence-enabled.",
    "Embedded Signup v4 uses an empty extras object. The Facebook Login configuration must be the place coexistence is selected.",
    "Webhook subscription is not verified with Meta.",
    "is_on_biz_app has not been checked. Coexistence is not verified.",
    "Contact sync and history sync are not started. Each can be called only once after a real onboarding.",
    "A separate test business number has not completed this flow.",
  ];
  return {
    appId,
    configId,
    graphVersion: version,
    embeddedSignupVersion: "v4",
    featureTypeIncluded: false,
    featureTypeNote:
      "Meta's Embedded Signup versions guide (24 July 2026) says the v4 extras object is purposely empty and that products are chosen in the Facebook Login for Business configuration. The older Business-app onboarding guide still shows featureType whatsapp_business_app_onboarding. This build follows the newer v4 rule and does not send featureType.",
    permissions: ["whatsapp_business_messaging", "whatsapp_business_management"],
    appSecretConfigured: Boolean(env.META_APP_SECRET?.trim()),
    webhookSecretConfigured: Boolean(env.META_WEBHOOK_APP_SECRET?.trim() || env.META_APP_SECRET?.trim()),
    verifyTokenConfigured: Boolean(env.META_WEBHOOK_VERIFY_TOKEN?.trim()),
    flags,
    signupAllowed,
    outboundDeliveryWired: false,
    credentialsStored,
    credentialMode: credentialsStored ? "stored" : mode === "simulated" ? "simulated" : "none",
    accountState: state,
    idSource: credentialsStored ? "signup" : mode === "simulated" ? "dry_run" : "none",
    wabaIdMasked: maskId(stored?.wabaId),
    phoneNumberIdMasked: maskId(stored?.phoneNumberId),
    businessIdMasked: maskId(stored?.businessId),
    tokenExpiry: credentialsStored ? tokenExpiryLabel(stored?.tokenExpiresAt) : "not stored",
    webhookHandshake: stored?.webhookHandshakeAt ? "token matched" : "not seen",
    webhookSubscription: "not verified",
    coexistenceVerified: "not verified",
    liveNumberConnected: false,
    liveNumberTouched: false,
    syncCallsEnabled: false,
    subscriptionChanged: false,
    lastAttempt: stored?.lastAttempt || null,
    launch: embeddedSignupLaunch(configId),
    blockers,
    checklist: [
      { id: "flags", label: "Production flags are off", done: !flags.coexistenceEnabled && !flags.productionOnboardingApproved && !flags.outboundEnabled, note: "WHATSAPP_COEXISTENCE_ENABLED, WHATSAPP_PRODUCTION_ONBOARDING_APPROVED, and WHATSAPP_OUTBOUND_ENABLED must stay false until written approval." },
      { id: "config", label: "Meta app and coexistence configuration verified", done: false, note: "Confirm in the Meta dashboard that the login configuration is Embedded Signup v4 and offers the existing WhatsApp Business account." },
      { id: "eligibility", label: "Coexistence eligibility confirmed", done: false, note: "The business must be a Tech Provider or Solution Partner, and the phone must use WhatsApp Business app 2.24.17 or newer." },
      { id: "permissions", label: "Required permissions approved", done: false, note: "whatsapp_business_messaging and whatsapp_business_management were supplied as approved. Advanced access and business verification still need a dashboard check." },
      { id: "exchange", label: "Authorization-code exchange tested against Meta", done: false, note: "Local tests mock Meta. A real exchange waits for production approval." },
      { id: "storage", label: "Secure credential storage verified", done: false, note: "Simulated runs do not store a token. A real token is encrypted and is never returned to the browser." },
      { id: "webhooks", label: "Webhook subscription verified", done: false, note: "history, smb_app_state_sync, smb_message_echoes, and account_update must be subscribed on a public HTTPS callback. A local handshake is not a subscription." },
      { id: "separate-number", label: "Separate-number test completed", done: false, note: "Use a different eligible WhatsApp Business app number. The Cloud API test number does not reproduce coexistence." },
      { id: "loops", label: "Echo and duplicate protection tested", done: true, note: "Automated tests cover history, echoes, duplicates, and withheld drafts. This does not mark the live number ready." },
      { id: "approval", label: "Written approval for live onboarding", done: false, note: "The admin screen cannot turn this on." },
    ],
  };
}

export function originMatches(origin: string | null, host: string | null) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
