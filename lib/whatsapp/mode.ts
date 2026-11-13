/**
 * WhatsApp integration mode and the Direct Cloud API rules (Change Plan C1, C3, C4, C6, C7, C8, C10).
 *
 * `WHATSAPP_INTEGRATION_MODE=direct` selects the business-owned direct Cloud API; anything else (unset included)
 * keeps the existing Embedded Signup / Coexistence behaviour unchanged. Pure functions only: no I/O, no network,
 * relative imports only, so the offline checks (`npm run check:whatsapp-direct`) can run them under plain Node.
 */

/** Digits for the live Marina Muse WhatsApp Business app number. Never a recipient, never a configured or test identifier. */
export const BLOCKED_LIVE_NUMBER = "917457099540";

/**
 * Production Meta app and Embedded Signup configuration IDs (not secrets). They are NEVER used as a fallback (C9);
 * they are kept only so the isolated test launcher and the checks can refuse them as test identifiers.
 */
export const KNOWN_PRODUCTION_APP_ID = "1588276335845243";
export const KNOWN_PRODUCTION_CONFIG_ID = "1760993601871515";

export type IntegrationMode = "direct" | "coexistence";
type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

const val = (env: Env, name: string) => (env[name] ?? "").trim();
const on = (env: Env, name: string) => val(env, name).toLowerCase() === "true";
const digitsOnly = (v: string | undefined | null) => (v || "").replace(/\D/g, "");

export function integrationMode(env: Env = process.env): IntegrationMode {
  return val(env, "WHATSAPP_INTEGRATION_MODE").toLowerCase() === "direct" ? "direct" : "coexistence";
}

export function isDirectMode(env: Env = process.env) {
  return integrationMode(env) === "direct";
}

/** Direct-mode credentials: environment only (C3). Values are returned to server code only and never logged. */
export function directConfig(env: Env = process.env) {
  const token = val(env, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = val(env, "WHATSAPP_PHONE_NUMBER_ID");
  const wabaId = val(env, "WHATSAPP_BUSINESS_ACCOUNT_ID");
  const missing = [
    ...(token ? [] : ["WHATSAPP_ACCESS_TOKEN"]),
    ...(phoneNumberId ? [] : ["WHATSAPP_PHONE_NUMBER_ID"]),
    ...(wabaId ? [] : ["WHATSAPP_BUSINESS_ACCOUNT_ID"]),
  ];
  return { token, phoneNumberId, wabaId, missing, complete: missing.length === 0 };
}

/**
 * Test configuration: the configured phone-number ID and WABA ID must equal, exactly, the approved Meta TEST
 * phone-number ID and test WABA ID (C10 / approval 4c). Both test IDs must be set.
 */
export function testConfigMatches(env: Env = process.env) {
  const testPhone = val(env, "WHATSAPP_TEST_PHONE_NUMBER_ID");
  const testWaba = val(env, "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID");
  return Boolean(testPhone && testWaba && testPhone === val(env, "WHATSAPP_PHONE_NUMBER_ID") && testWaba === val(env, "WHATSAPP_BUSINESS_ACCOUNT_ID"));
}

/** WHATSAPP_TEST_RECIPIENTS: comma-separated tester numbers (digits). The live business number is never accepted. */
export function testRecipients(env: Env = process.env) {
  return val(env, "WHATSAPP_TEST_RECIPIENTS")
    .split(",")
    .map((n) => digitsOnly(n))
    .filter((n) => /^\d{8,15}$/.test(n) && n !== BLOCKED_LIVE_NUMBER);
}

export type Decision = { ok: boolean; reason: string };

/**
 * C1: direct-mode send permission, independent of every coexistence flag.
 * WHATSAPP_OUTBOUND_ENABLED=true AND either written production approval (WHATSAPP_PRODUCTION_SENDING_APPROVED=true)
 * or test mode (configured IDs equal the approved test IDs, and the recipient is on WHATSAPP_TEST_RECIPIENTS).
 * The remaining rules (window, consent, suppression, live number) stay in sendGate.
 */
export function directOutboundDecision(env: Env, to: string): Decision {
  if (!on(env, "WHATSAPP_OUTBOUND_ENABLED")) return { ok: false, reason: "WhatsApp sending is off (WHATSAPP_OUTBOUND_ENABLED is not true)." };
  if (on(env, "WHATSAPP_PRODUCTION_SENDING_APPROVED")) return { ok: true, reason: "production sending approved" };
  if (!testConfigMatches(env)) {
    return { ok: false, reason: "WhatsApp sending needs WHATSAPP_PRODUCTION_SENDING_APPROVED=true, or the approved test phone-number ID and test WABA ID configured." };
  }
  const recipient = digitsOnly(to);
  if (!testRecipients(env).includes(recipient)) return { ok: false, reason: "Test mode: the recipient is not on WHATSAPP_TEST_RECIPIENTS." };
  return { ok: true, reason: "test mode (approved test number and recipient)" };
}

/** Flag-level view for status screens (no recipient): could anything be sent at all in direct mode? */
export function directOutboundPossible(env: Env = process.env) {
  return on(env, "WHATSAPP_OUTBOUND_ENABLED") && (on(env, "WHATSAPP_PRODUCTION_SENDING_APPROVED") || (testConfigMatches(env) && testRecipients(env).length > 0));
}

/**
 * C6: real sends outside production are refused, fail-closed, before any network request.
 * The only non-production exception is the isolated test launcher (MARINA_ISOLATED_TEST=1) in direct mode, sending
 * from the approved test phone-number ID with matching test WABA ID. (Stricter than the Change Plan draft: no general
 * WHATSAPP_ALLOW_OUTSIDE_PRODUCTION override exists, per the client's mandatory requirement.)
 */
export function sendEnvironmentDecision(env: Env, phoneNumberId: string): Decision {
  if (val(env, "NODE_ENV") === "production") return { ok: true, reason: "production" };
  const isolatedTest =
    val(env, "MARINA_ISOLATED_TEST") === "1" &&
    isDirectMode(env) &&
    testConfigMatches(env) &&
    Boolean(phoneNumberId) &&
    phoneNumberId === val(env, "WHATSAPP_TEST_PHONE_NUMBER_ID");
  return isolatedTest
    ? { ok: true, reason: "isolated test environment, approved test number" }
    : { ok: false, reason: "WhatsApp messages are never sent outside production (only the isolated test launcher with the approved test number may)." };
}

/** C7: Embedded Signup and Coexistence routes are closed in direct mode (410, before any parsing or Meta call). */
export const DIRECT_MODE_ROUTE_ERROR = "Embedded Signup and Coexistence are disabled: WhatsApp runs in direct Cloud API mode.";

export function directModeRouteBlock(env: Env = process.env): { status: 410; body: { ok: false; calledMeta: false; error: string } } | null {
  return isDirectMode(env) ? { status: 410, body: { ok: false, calledMeta: false, error: DIRECT_MODE_ROUTE_ERROR } } : null;
}

/** C4: webhook bodies larger than this are refused (413) before any signature work. */
export const MAX_WEBHOOK_BYTES = 1_000_000;

type Change = { field?: string; value?: { metadata?: { phone_number_id?: unknown } } & Record<string, unknown> } & Record<string, unknown>;
type Entry = { id?: unknown; changes?: Change[] } & Record<string, unknown>;

export type DirectFilterResult =
  | { ok: true; body: { object: string; entry: Entry[] }; accepted: number; ignoredForeign: number; ignoredOther: number }
  | { ok: false; status: 503; error: string };

/**
 * C4: in direct mode only `messages` changes for the configured WABA (entry.id) AND the configured phone-number ID
 * (value.metadata.phone_number_id) reach processing. Missing or mismatched identifiers are dropped here, so they never
 * reach message processing, status updates or storage. Not configured → 503 (fail closed; Meta retries later).
 */
export function filterDirectWebhook(body: unknown, env: Env = process.env): DirectFilterResult {
  const wabaId = val(env, "WHATSAPP_BUSINESS_ACCOUNT_ID");
  const phoneNumberId = val(env, "WHATSAPP_PHONE_NUMBER_ID");
  if (!wabaId || !phoneNumberId) return { ok: false, status: 503, error: "WhatsApp is not configured." };
  const root = body as { object?: unknown; entry?: unknown };
  const out = { object: String(root?.object ?? ""), entry: [] as Entry[] };
  let accepted = 0;
  let ignoredForeign = 0;
  let ignoredOther = 0;
  if (root?.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) {
    return { ok: true, body: out, accepted, ignoredForeign, ignoredOther };
  }
  for (const entry of root.entry as Entry[]) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    if (String(entry?.id ?? "") !== wabaId) {
      ignoredForeign += Math.max(1, changes.length);
      continue;
    }
    const kept: Change[] = [];
    for (const change of changes) {
      if (change?.field !== "messages") {
        ignoredOther += 1;
        continue;
      }
      if (String(change.value?.metadata?.phone_number_id ?? "") !== phoneNumberId) {
        ignoredForeign += 1;
        continue;
      }
      kept.push(change);
      accepted += 1;
    }
    if (kept.length) out.entry.push({ ...entry, changes: kept });
  }
  return { ok: true, body: out, accepted, ignoredForeign, ignoredOther };
}

function mask(value: string) {
  return /^\d{6,20}$/.test(value) ? `${value.slice(0, 4)}…${value.slice(-4)}` : value ? "set (not numeric)" : null;
}

/** C8: admin status in direct mode. Masked IDs and set/missing flags only; never a token, secret or full number. */
export function directStatus(env: Env, handshakeAt?: string) {
  const cfg = directConfig(env);
  const secret = val(env, "META_WEBHOOK_APP_SECRET") || val(env, "META_APP_SECRET");
  return {
    integrationMode: "direct" as const,
    wabaIdMasked: mask(cfg.wabaId),
    phoneNumberIdMasked: mask(cfg.phoneNumberId),
    tokenConfigured: Boolean(cfg.token),
    appIdConfigured: Boolean(val(env, "META_APP_ID")),
    webhookSecretConfigured: Boolean(secret),
    verifyTokenConfigured: Boolean(val(env, "META_WEBHOOK_VERIFY_TOKEN")),
    missing: cfg.missing,
    graphVersion: val(env, "META_GRAPH_API_VERSION") || "v26.0",
    outbound: {
      enabled: on(env, "WHATSAPP_OUTBOUND_ENABLED"),
      productionApproved: on(env, "WHATSAPP_PRODUCTION_SENDING_APPROVED"),
      testConfigMatches: testConfigMatches(env),
      testRecipients: testRecipients(env).length,
      possible: directOutboundPossible(env),
      nonProductionBlocked: val(env, "NODE_ENV") !== "production",
    },
    webhookHandshake: handshakeAt ? "token matched" : "not seen",
    webhookHandshakeAt: handshakeAt || null,
    liveNumberBlocked: true as const,
    embeddedSignup: "disabled" as const,
    callbackPath: "/api/meta/whatsapp/webhook",
  };
}

export type DirectStatus = ReturnType<typeof directStatus>;
