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
  /** When the real signup finished; the contacts/history syncs must run within 24 hours of this. */
  onboardedAt?: string;
  /** Verified with GET /{phone-number-id}: business number digits, name, coexistence flags. */
  displayNumber?: string;
  verifiedName?: string;
  isOnBizApp?: boolean;
  platformType?: string;
  numberCheckedAt?: string;
  isTestNumber?: boolean;
  /** POST /{waba}/subscribed_apps succeeded. */
  subscribedAt?: string;
  /** POST /{phone-number-id}/smb_app_data — each may be called only once. */
  contactsSyncRequestedAt?: string;
  historySyncRequestedAt?: string;
  historyStatus?: { phase: number | null; progress: number | null; declined: boolean; updatedAt: string };
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
  featureTypeIncluded: true;
  featureTypeNote: string;
  permissions: ["whatsapp_business_messaging", "whatsapp_business_management"];
  appSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  verifyTokenConfigured: boolean;
  flags: FlagState;
  signupAllowed: boolean;
  signupMode: SignupMode;
  /** Last 4 digits of the approved test number, never the whole number. */
  testNumberHint: string | null;
  mode: CoexistenceMode;
  outboundDeliveryWired: true;
  outboundAllowed: boolean;
  credentialsStored: boolean;
  credentialMode: StoredCoexistence["mode"];
  accountState: AccountState;
  idSource: "none" | "dry_run" | "signup";
  wabaIdMasked: string | null;
  phoneNumberIdMasked: string | null;
  businessIdMasked: string | null;
  displayNumberHint: string | null;
  isTestNumber: boolean;
  tokenExpiry: string;
  webhookHandshake: "not seen" | "token matched";
  webhookSubscription: "subscribed" | "not verified";
  coexistenceVerified: "verified" | "not verified";
  liveNumberConnected: boolean;
  liveNumberTouched: false;
  syncCallsEnabled: boolean;
  subscriptionChanged: boolean;
  historySync: string;
  steps: OnboardingStep[];
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

/** Meta: on Embedded Signup v4, Business-app (coexistence) onboarding "continues to be supported through the featureType parameter". */
export const COEXISTENCE_FEATURE_TYPE = "whatsapp_business_app_onboarding";

/**
 * FB.login options. Code flow only (the token is exchanged on the server). Extras follow Meta's
 * "Onboarding WhatsApp Business app users" sample: setup {}, featureType, sessionInfoVersion "3".
 */
export function embeddedSignupLaunch(configId: string) {
  return {
    config_id: configId,
    response_type: "code" as const,
    override_default_response_type: true,
    extras: { setup: {} as Record<string, never>, featureType: COEXISTENCE_FEATURE_TYPE, sessionInfoVersion: "3" },
  };
}

/** Phone digits with country code. A bare 10-digit number is treated as Indian (+91), e.g. 9027497288 → 919027497288. */
export function normalizePhone(value: string | undefined | null) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** WHATSAPP_COEXISTENCE_TEST_NUMBER: the only number that may be onboarded before written production approval. */
export function testNumber(env: NodeJS.ProcessEnv) {
  const n = normalizePhone(env.WHATSAPP_COEXISTENCE_TEST_NUMBER);
  return /^\d{10,15}$/.test(n) && n !== BLOCKED_LIVE_NUMBER ? n : "";
}

export type SignupMode = "closed" | "test" | "production";

/** closed = nothing can be exchanged · test = only the test number · production = written approval given. */
export function signupMode(env: NodeJS.ProcessEnv): SignupMode {
  const flags = readFlags(env);
  if (!flags.coexistenceEnabled || !env.META_APP_SECRET?.trim() || !env.AUTH_SECRET?.trim()) return "closed";
  if (flags.productionOnboardingApproved) return "production";
  return testNumber(env) ? "test" : "closed";
}

/**
 * Which onboarded business numbers are accepted. The client's live number needs production approval;
 * before that, only the configured test number is accepted.
 */
export function numberDecision(displayNumber: string | undefined, env: NodeJS.ProcessEnv): { ok: boolean; reason: string; isTestNumber: boolean } {
  const digits = normalizePhone(displayNumber);
  const mode = signupMode(env);
  const isTestNumber = Boolean(digits) && digits === testNumber(env);
  if (!digits) return { ok: false, reason: "Meta did not return the business phone number.", isTestNumber };
  if (mode === "closed") return { ok: false, reason: "Coexistence onboarding is closed.", isTestNumber };
  if (digits === BLOCKED_LIVE_NUMBER && mode !== "production") {
    return { ok: false, reason: "This is the client's live WhatsApp number. It needs written production approval first.", isTestNumber };
  }
  if (mode === "test" && !isTestNumber) {
    return { ok: false, reason: `Only the test number ending ${testNumber(env).slice(-4)} may be onboarded before production approval.`, isTestNumber };
  }
  return { ok: true, reason: isTestNumber ? "Approved test number." : "Production onboarding approved.", isTestNumber };
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

/**
 * A real code exchange is allowed in test mode (only the test number is then accepted after the exchange)
 * or after written production approval. Closed otherwise.
 */
export function productionSignupAllowed(env: NodeJS.ProcessEnv) {
  return signupMode(env) !== "closed";
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
    if (event !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" || !wabaId) {
      return {
        status: 400,
        outcome: "invalid",
        calledMeta: false,
        store: "none",
        event,
        detail: "Dry run needs a coexistence finish event with a WABA id.",
      };
    }
    return {
      status: 200,
      outcome: "simulated",
      calledMeta: false,
      store: "simulated",
      event,
      wabaId,
      phoneNumberId: phoneNumberId || undefined,
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
  // Meta's coexistence finish event carries waba_id; phone_number_id may be absent and is looked up after the exchange.
  if (event !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" || !wabaId) {
    return {
      status: 400,
      outcome: "invalid",
      calledMeta: false,
      store: "none",
      event,
      detail: "Coexistence signup did not return a WABA id. Nothing was registered.",
    };
  }
  if (!productionSignupAllowed(env)) {
    return {
      status: 403,
      outcome: "blocked",
      calledMeta: false,
      store: "none",
      event,
      detail: "Coexistence onboarding is closed (needs WHATSAPP_COEXISTENCE_ENABLED and either a test number or production approval). The authorization code was not sent to Meta.",
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

/**
 * Graph calls the coexistence onboarding may make after signup, and nothing else:
 * read-only lookups, subscribing the app to the WABA, and the two one-time smb_app_data syncs.
 * Number registration/deregistration is never allowed — a coexistence number is already registered by the Business app.
 */
export function coexistenceCallAllowed(method: "GET" | "POST" | "DELETE", url: string, body = "") {
  if (`${url}\n${body}`.includes(BLOCKED_LIVE_NUMBER)) return { ok: false as const, reason: "The client's live WhatsApp number is blocked." };
  const match = /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/(.+)$/.exec(url.split("?")[0]);
  if (!match) return { ok: false as const, reason: "Only Graph API calls are allowed." };
  const path = match[1].toLowerCase();
  if (/(^|\/)(register|deregister)$/.test(path)) return { ok: false as const, reason: "Coexistence numbers are never registered or deregistered by this site." };
  if (method === "DELETE") return { ok: false as const, reason: "Deleting Meta resources is not allowed from this site." };
  if (/\/messages$/.test(path)) return { ok: false as const, reason: "Messages are sent only through the gated Cloud API sender." };
  const segments = path.split("/");
  if (method === "GET") {
    const okGet =
      (segments.length === 1 && /^\d{6,20}$/.test(segments[0])) ||
      (segments.length === 2 && /^\d{6,20}$/.test(segments[0]) && ["phone_numbers", "subscribed_apps", "subscriptions"].includes(segments[1]));
    return okGet ? { ok: true as const } : { ok: false as const, reason: `GET ${path} is not on the allow-list.` };
  }
  if (segments.length === 2 && /^\d{6,20}$/.test(segments[0]) && segments[1] === "subscribed_apps") return { ok: true as const };
  if (segments.length === 2 && /^\d{6,20}$/.test(segments[0]) && segments[1] === "smb_app_data") {
    let parsed: { sync_type?: string } = {};
    try {
      parsed = JSON.parse(body || "{}");
    } catch {
      /* invalid body is rejected below */
    }
    return parsed.sync_type === "smb_app_state_sync" || parsed.sync_type === "history"
      ? { ok: true as const }
      : { ok: false as const, reason: "smb_app_data needs sync_type smb_app_state_sync or history." };
  }
  return { ok: false as const, reason: `POST ${path} is not on the allow-list.` };
}

export const SYNC_WINDOW_HOURS = 24;

export type OnboardingStep = {
  id: "verify_number" | "subscribe_webhooks" | "sync_contacts" | "sync_history";
  label: string;
  state: "done" | "available" | "blocked" | "expired";
  detail: string;
};

/**
 * What can be done next after a real coexistence signup, in Meta's order:
 * verify the number (is_on_biz_app) → subscribe the app to the WABA → contacts sync → history sync.
 * Each sync can be requested once, within 24 hours of onboarding.
 */
export function onboardingSteps(stored: StoredCoexistence | null, env: NodeJS.ProcessEnv, now = Date.now()): OnboardingStep[] {
  const hasToken = stored?.mode === "stored" && Boolean(stored.tokenCiphertext);
  const numberOk = Boolean(stored?.numberCheckedAt) && numberDecision(stored?.displayNumber, env).ok;
  const coexists = numberOk && stored?.isOnBizApp === true;
  const onboarded = stored?.onboardedAt ? Date.parse(stored.onboardedAt) : NaN;
  const windowOpen = Number.isFinite(onboarded) && now - onboarded < SYNC_WINDOW_HOURS * 3_600_000;
  const hoursLeft = Number.isFinite(onboarded) ? Math.max(0, Math.ceil((onboarded + SYNC_WINDOW_HOURS * 3_600_000 - now) / 3_600_000)) : 0;
  const sync = (id: "sync_contacts" | "sync_history", label: string, doneAt: string | undefined): OnboardingStep => {
    if (doneAt) return { id, label, state: "done", detail: `Requested ${doneAt.slice(0, 16)}. Meta allows this only once.` };
    if (!hasToken || !coexists) return { id, label, state: "blocked", detail: "Verify the number first (it must be on the WhatsApp Business app)." };
    if (!stored?.subscribedAt) return { id, label, state: "blocked", detail: "Subscribe the app to the business account first, so the sync webhooks arrive." };
    if (!windowOpen) return { id, label, state: "expired", detail: "The 24-hour sync window has passed. Meta requires offboarding and a new signup." };
    return { id, label, state: "available", detail: `Can be requested once. About ${hoursLeft} hour(s) left in the 24-hour window.` };
  };
  return [
    !hasToken
      ? { id: "verify_number", label: "Verify the onboarded number", state: "blocked", detail: "No stored credentials from a real signup yet." }
      : stored?.numberCheckedAt
        ? numberOk
          ? {
              id: "verify_number",
              label: "Verify the onboarded number",
              state: "done",
              detail: `Number …${(stored.displayNumber || "").slice(-4)} · on Business app: ${stored.isOnBizApp ? "yes" : "no"} · platform ${stored.platformType || "unknown"}.`,
            }
          : { id: "verify_number", label: "Verify the onboarded number", state: "blocked", detail: numberDecision(stored.displayNumber, env).reason }
        : { id: "verify_number", label: "Verify the onboarded number", state: "available", detail: "Read-only lookup of the number, its name and is_on_biz_app / platform_type." },
    stored?.subscribedAt
      ? { id: "subscribe_webhooks", label: "Subscribe the app to the business account", state: "done", detail: `Subscribed ${stored.subscribedAt.slice(0, 16)}.` }
      : !coexists
        ? { id: "subscribe_webhooks", label: "Subscribe the app to the business account", state: "blocked", detail: "Verify the number first." }
        : { id: "subscribe_webhooks", label: "Subscribe the app to the business account", state: "available", detail: "POST /{waba}/subscribed_apps — lets Meta send this WABA's webhooks to the site." },
    sync("sync_contacts", "Contacts sync (smb_app_state_sync)", stored?.contactsSyncRequestedAt),
    sync("sync_history", "Message history sync (history)", stored?.historySyncRequestedAt),
  ];
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
  /** Sender's WhatsApp number (digits) and profile name, inbound messages only. */
  from?: string;
  profileName?: string;
};

export type WaPlan = WaEvent & { action: "ignore" | "draft"; reason: string; send: false };

type Change = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    messages?: { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }[];
    contacts?: { wa_id?: string; profile?: { name?: string } }[];
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
            from: digits(message.from) || undefined,
            profileName:
              value.contacts?.find((contact) => digits(contact.wa_id) === digits(message.from))?.profile?.name?.slice(0, 80) || undefined,
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

export type HistoryMessage = {
  id: string;
  customer: string;
  fromBusiness: boolean;
  timestamp: string;
  type: string;
  text: string | null;
};

export type CoexistenceUpdates = {
  history: { key: string; wabaId: string; phase: number | null; chunk: number | null; progress: number | null; declined: boolean; messages: HistoryMessage[] }[];
  contacts: { key: string; phone: string; fullName: string | null; firstName: string | null; action: "add" | "remove"; at: string }[];
  echoes: { key: string; id: string; customer: string; timestamp: string; type: string; text: string | null; editOf: string | null; revokeOf: string | null }[];
};

function isoFromUnix(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date(0).toISOString();
}

/**
 * The data inside coexistence webhooks (history, smb_app_state_sync, smb_message_echoes), keyed exactly like
 * `normaliseWebhook` so the existing duplicate store decides what is new. None of these ever get an AI reply.
 */
export function coexistenceUpdates(body: unknown): CoexistenceUpdates {
  const out: CoexistenceUpdates = { history: [], contacts: [], echoes: [] };
  const root = body as { object?: string; entry?: { id?: string; changes?: { field?: string; value?: Record<string, unknown> }[] }[] };
  if (root?.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return out;
  for (const entry of root.entry) {
    const wabaId = String(entry?.id || "");
    for (const change of entry?.changes || []) {
      const value = (change?.value || {}) as Record<string, unknown>;
      const display = digits(String((value.metadata as { display_phone_number?: string } | undefined)?.display_phone_number || ""));
      if (change?.field === "history") {
        const rows = Array.isArray(value.history) ? (value.history as Record<string, unknown>[]) : [];
        const first = (rows[0]?.metadata || {}) as { phase?: number; chunk_order?: number; progress?: number };
        const declined = rows.some((row) => Array.isArray(row.errors) && (row.errors as { code?: number }[]).some((e) => e.code === 2593109));
        const messages: HistoryMessage[] = [];
        for (const row of rows) {
          for (const thread of (Array.isArray(row.threads) ? row.threads : []) as { id?: string; messages?: Record<string, unknown>[] }[]) {
            const customer = digits(thread.id);
            for (const m of thread.messages || []) {
              const fromBusiness = Boolean(m.to) || (display !== "" && digits(String(m.from || "")) === display);
              messages.push({
                id: String(m.id || ""),
                customer: customer || digits(String(fromBusiness ? m.to : m.from)),
                fromBusiness,
                timestamp: isoFromUnix(m.timestamp),
                type: String(m.type || "unknown"),
                text: m.type === "text" ? String((m.text as { body?: string } | undefined)?.body || "").slice(0, 4000) : null,
              });
            }
          }
        }
        out.history.push({
          key: `history:${wabaId}:${declined ? "declined" : `${first.phase ?? "na"}:${first.chunk_order ?? "na"}`}`,
          wabaId,
          phase: typeof first.phase === "number" ? first.phase : null,
          chunk: typeof first.chunk_order === "number" ? first.chunk_order : null,
          progress: typeof first.progress === "number" ? first.progress : null,
          declined,
          messages: messages.filter((m) => m.id && m.customer),
        });
      } else if (change?.field === "smb_app_state_sync") {
        const rows = (Array.isArray(value.state_sync) ? value.state_sync : []) as {
          action?: string;
          contact?: { phone_number?: string; full_name?: string; first_name?: string };
          metadata?: { timestamp?: string };
        }[];
        for (const row of rows) {
          const phone = digits(row.contact?.phone_number);
          if (!phone) continue;
          out.contacts.push({
            key: `sync:${wabaId}:${phone.slice(-8)}:${row.action || "unknown"}:${row.metadata?.timestamp || "0"}`,
            phone,
            fullName: row.contact?.full_name?.slice(0, 120) || null,
            firstName: row.contact?.first_name?.slice(0, 60) || null,
            action: row.action === "remove" ? "remove" : "add",
            at: isoFromUnix(row.metadata?.timestamp),
          });
        }
      } else if (change?.field === "smb_message_echoes") {
        const rows = (Array.isArray(value.message_echoes) ? value.message_echoes : []) as Record<string, unknown>[];
        for (const echo of rows) {
          out.echoes.push({
            key: `echo:${echo.id || `${wabaId}:${echo.timestamp || "0"}`}`,
            id: String(echo.id || ""),
            customer: digits(String(echo.to || "")),
            timestamp: isoFromUnix(echo.timestamp),
            type: String(echo.type || "unknown"),
            text: echo.type === "text" ? String((echo.text as { body?: string } | undefined)?.body || "").slice(0, 4000) : null,
            editOf: String((echo.edit as { original_message_id?: string } | undefined)?.original_message_id || "") || null,
            revokeOf: String((echo.revoke as { original_message_id?: string } | undefined)?.original_message_id || "") || null,
          });
        }
      }
    }
  }
  return out;
}

/** After the owner replies from the WhatsApp Business app, the AI stays quiet in that chat for this long. */
export const HUMAN_TAKEOVER_HOURS = 24;

export function shouldSendWhatsApp(env: NodeJS.ProcessEnv) {
  const flags = readFlags(env);
  return flags.coexistenceEnabled && flags.productionOnboardingApproved && flags.outboundEnabled;
}

/**
 * Automatic replies from the coexistence number. Production: all three approval flags.
 * Test: coexistence + outbound flags, and the business number must be the verified test number.
 */
export function outboundAllowed(env: NodeJS.ProcessEnv, businessNumber?: string | null) {
  const flags = readFlags(env);
  if (!flags.coexistenceEnabled || !flags.outboundEnabled) return false;
  if (flags.productionOnboardingApproved) return true;
  const n = normalizePhone(businessNumber);
  return Boolean(n) && n === testNumber(env);
}

export type CoexistenceMode = "not_configured" | "test" | "ready_for_onboarding" | "live";

export function coexistenceVerified(stored: StoredCoexistence | null, env: NodeJS.ProcessEnv) {
  return Boolean(
    stored?.mode === "stored" &&
      stored.tokenCiphertext &&
      stored.numberCheckedAt &&
      numberDecision(stored.displayNumber, env).ok &&
      stored.isOnBizApp === true &&
      stored.platformType === "CLOUD_API"
  );
}

/**
 * not_configured — secrets or flags missing, or no test number and no production approval
 * test — only the test number can be onboarded / replied from
 * ready_for_onboarding — written production approval given, client number not yet verified
 * live — production approval, a non-test number verified on the Business app + Cloud API, app subscribed
 */
export function coexistenceMode(env: NodeJS.ProcessEnv, stored: StoredCoexistence | null): CoexistenceMode {
  const configured =
    Boolean(env.META_APP_SECRET?.trim()) &&
    Boolean(env.META_WEBHOOK_VERIFY_TOKEN?.trim()) &&
    Boolean(env.AUTH_SECRET?.trim());
  const mode = signupMode(env);
  if (!configured || mode === "closed") return "not_configured";
  if (mode === "test") return "test";
  return coexistenceVerified(stored, env) && stored?.subscribedAt && !stored.isTestNumber ? "live" : "ready_for_onboarding";
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
  const verified = coexistenceVerified(stored, env);
  const steps = onboardingSteps(stored, env);
  const test = testNumber(env);
  const displayDigits = normalizePhone(stored?.displayNumber);
  const historySync = stored?.historyStatus
    ? stored.historyStatus.declined
      ? "declined by the business (history sharing turned off in the app)"
      : `phase ${stored.historyStatus.phase ?? "?"} · ${stored.historyStatus.progress ?? 0}% received`
    : stored?.historySyncRequestedAt
      ? "requested, waiting for history webhooks"
      : "not requested";
  const blockers = [
    "Confirm in the Meta dashboard that configuration 1760993601871515 is a Facebook Login for Business config for WhatsApp Embedded Signup with the two approved permissions.",
    "Your business must be a Tech Provider or Solution Partner, and the test phone must run WhatsApp Business app 2.24.17 or newer.",
    "Subscribe the app's WhatsApp Business Account webhook fields: messages, history, smb_app_state_sync, smb_message_echoes, account_update (App Dashboard → WhatsApp → Configuration).",
    "The callback URL must be public HTTPS (/api/meta/whatsapp/webhook) with META_WEBHOOK_VERIFY_TOKEN; localhost cannot receive Meta webhooks.",
    ...(test ? [] : ["Set WHATSAPP_COEXISTENCE_TEST_NUMBER to the test phone (e.g. 9027497288) to allow a test onboarding."]),
    ...(verified ? [] : ["is_on_biz_app / platform_type have not been verified for an onboarded number yet."]),
  ];
  return {
    appId,
    configId,
    graphVersion: version,
    embeddedSignupVersion: "v4",
    featureTypeIncluded: true,
    featureTypeNote:
      'FB.login sends extras { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }, as in Meta\'s "Onboarding WhatsApp Business app users" guide; Meta\'s v4 page says Business-app onboarding "continues to be supported through the featureType parameter".',
    permissions: ["whatsapp_business_messaging", "whatsapp_business_management"],
    appSecretConfigured: Boolean(env.META_APP_SECRET?.trim()),
    webhookSecretConfigured: Boolean(env.META_WEBHOOK_APP_SECRET?.trim() || env.META_APP_SECRET?.trim()),
    verifyTokenConfigured: Boolean(env.META_WEBHOOK_VERIFY_TOKEN?.trim()),
    flags,
    signupAllowed,
    signupMode: signupMode(env),
    testNumberHint: test ? `…${test.slice(-4)}` : null,
    mode: coexistenceMode(env, stored),
    outboundDeliveryWired: true,
    outboundAllowed: outboundAllowed(env, stored?.displayNumber),
    credentialsStored,
    credentialMode: credentialsStored ? "stored" : mode === "simulated" ? "simulated" : "none",
    accountState: state,
    idSource: credentialsStored ? "signup" : mode === "simulated" ? "dry_run" : "none",
    wabaIdMasked: maskId(stored?.wabaId),
    phoneNumberIdMasked: maskId(stored?.phoneNumberId),
    businessIdMasked: maskId(stored?.businessId),
    displayNumberHint: displayDigits ? `…${displayDigits.slice(-4)}` : null,
    isTestNumber: Boolean(stored?.isTestNumber),
    tokenExpiry: credentialsStored ? tokenExpiryLabel(stored?.tokenExpiresAt) : "not stored",
    webhookHandshake: stored?.webhookHandshakeAt ? "token matched" : "not seen",
    webhookSubscription: stored?.subscribedAt ? "subscribed" : "not verified",
    coexistenceVerified: verified ? "verified" : "not verified",
    liveNumberConnected: verified && displayDigits === BLOCKED_LIVE_NUMBER,
    liveNumberTouched: false,
    syncCallsEnabled: steps.some((step) => (step.id === "sync_contacts" || step.id === "sync_history") && step.state === "available"),
    subscriptionChanged: Boolean(stored?.subscribedAt),
    historySync,
    steps,
    lastAttempt: stored?.lastAttempt || null,
    launch: embeddedSignupLaunch(configId),
    blockers,
    checklist: [
      { id: "flags", label: "Production approval flag is off", done: !flags.productionOnboardingApproved, note: "WHATSAPP_PRODUCTION_ONBOARDING_APPROVED stays false until you give written approval to onboard the client's number." },
      { id: "test-number", label: "Test number configured", done: Boolean(test), note: test ? `Only the number ending ${test.slice(-4)} can be onboarded in test mode.` : "Set WHATSAPP_COEXISTENCE_TEST_NUMBER." },
      { id: "secrets", label: "App secret, webhook verify token and AUTH_SECRET set", done: Boolean(env.META_APP_SECRET?.trim() && env.META_WEBHOOK_VERIFY_TOKEN?.trim() && env.AUTH_SECRET?.trim()), note: "Kept on the server only." },
      { id: "featureType", label: "Embedded Signup sends the coexistence featureType", done: true, note: "whatsapp_business_app_onboarding" },
      { id: "exchange", label: "Authorization code exchanged for a stored, encrypted token", done: credentialsStored, note: "Happens on the server after a real signup. The token is never sent to the browser." },
      { id: "verified", label: "Number verified on the Business app (is_on_biz_app, CLOUD_API)", done: verified, note: steps[0].detail },
      { id: "webhooks", label: "App subscribed to the business account", done: Boolean(stored?.subscribedAt), note: steps[1].detail },
      { id: "contacts", label: "Contacts sync requested (once)", done: Boolean(stored?.contactsSyncRequestedAt), note: steps[2].detail },
      { id: "history", label: "History sync requested (once)", done: Boolean(stored?.historySyncRequestedAt), note: `${steps[3].detail} Status: ${historySync}.` },
      { id: "loops", label: "Echo and duplicate protection tested", done: true, note: "Automated tests cover history, echoes, contact sync, duplicates and withheld drafts." },
      { id: "approval", label: "Written approval for live onboarding", done: flags.productionOnboardingApproved, note: "Only an environment change by you can turn this on; the admin screen cannot." },
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
