/**
 * Exotel — Indian business number and telephony for Agent 2.
 * Exotel numbers cannot be imported into Vapi directly; the supported path is SIP:
 *   inbound  ExoPhone → Exotel vSIP trunk → destination `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai`
 *   outbound Vapi byo-sip-trunk credential → Exotel gateway (IP-whitelisted)
 * The vSIP endpoints below are the ones used by Exotel's own Exotel-Vapi-Connector (v2 `/trunks`).
 * Read-only checks only; nothing here places a call.
 */
import { timingSafeEqual } from "crypto";
import { env, requestJson } from "./http.ts";

export function exotelConfig() {
  const subdomain = env("EXOTEL_SUBDOMAIN") || "api.in.exotel.com";
  return {
    apiKey: env("EXOTEL_API_KEY"),
    apiToken: env("EXOTEL_API_TOKEN"),
    accountSid: env("EXOTEL_ACCOUNT_SID"),
    subdomain: /^api(\.in|\.us)?\.exotel\.com$/.test(subdomain) ? subdomain : "api.in.exotel.com",
    phoneNumber: env("EXOTEL_PHONE_NUMBER"),
    trunkSid: env("EXOTEL_TRUNK_SID"),
  };
}

export function exotelConfigured() {
  const c = exotelConfig();
  return Boolean(c.apiKey && c.apiToken && c.accountSid);
}

function authHeader() {
  const c = exotelConfig();
  return `Basic ${Buffer.from(`${c.apiKey}:${c.apiToken}`).toString("base64")}`;
}

async function exotelGet<T>(path: string) {
  const c = exotelConfig();
  return requestJson<T>(`https://${c.subdomain}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    timeoutMs: 12_000,
    secrets: [c.apiKey, c.apiToken],
  });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

type TrunkList = { response?: { data?: Record<string, unknown> }[] } | { data?: Record<string, unknown>[] } | Record<string, unknown>[];

/** Exotel wraps v2 results as `{ response: [{ data: {...} }] }`; tolerate a bare array too. */
export function exotelRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const root = (payload || {}) as Record<string, unknown>;
  const response = root.response;
  if (Array.isArray(response)) return response.map((row) => ((row as Record<string, unknown>)?.data as Record<string, unknown>) || (row as Record<string, unknown>));
  if (response && typeof response === "object") {
    const data = (response as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (data && typeof data === "object") return [data as Record<string, unknown>];
  }
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[];
  return [];
}

export type ExotelCheck = { label: string; ok: boolean | null; detail: string; live: boolean };

/** Credentials, account access, vSIP trunk, Vapi destination and number mapping. No call is placed. */
export async function pingExotel(): Promise<{ configured: boolean; checks: ExotelCheck[] }> {
  const c = exotelConfig();
  if (!exotelConfigured()) return { configured: false, checks: [] };
  const checks: ExotelCheck[] = [];
  const sid = encodeURIComponent(c.accountSid);

  const calls = await exotelGet<unknown>(`/v1/Accounts/${sid}/Calls.json?PageSize=1`);
  checks.push({
    label: "API key/token accepted for the account",
    ok: calls.ok,
    live: true,
    detail: calls.ok
      ? `Exotel accepted the credentials for account ${c.accountSid.slice(0, 4)}… on ${c.subdomain} (read-only call log request).`
      : calls.status === 401 || calls.status === 403
        ? `Exotel refused the credentials (${calls.error}). Check EXOTEL_API_KEY / EXOTEL_API_TOKEN at my.exotel.com/apisettings and that EXOTEL_SUBDOMAIN matches your cluster (Mumbai = api.in.exotel.com).`
        : `Exotel could not be reached: ${calls.error}`,
  });
  if (!calls.ok) return { configured: true, checks };

  const trunks = await exotelGet<TrunkList>(`/v2/accounts/${sid}/trunks`);
  const trunkRows = trunks.ok ? exotelRows(trunks.data) : [];
  checks.push({
    label: "vSIP (SIP trunking) enabled",
    ok: trunks.ok,
    live: true,
    detail: trunks.ok
      ? `${trunkRows.length} SIP trunk(s) on the account.`
      : `The vSIP trunk API is not available (${trunks.error}). Ask Exotel to enable vSIP/SIP trunking on this account — it is required to connect Exotel to Vapi.`,
  });
  if (!trunks.ok) return { configured: true, checks };

  if (!c.trunkSid) {
    checks.push({ label: "Trunk selected", ok: false, live: false, detail: "Set EXOTEL_TRUNK_SID to the trunk that routes your ExoPhone to Vapi." });
    return { configured: true, checks };
  }
  const trunkId = encodeURIComponent(c.trunkSid);
  const [destinations, numbers] = await Promise.all([
    exotelGet<unknown>(`/v2/accounts/${sid}/trunks/${trunkId}/destination-uris`),
    exotelGet<unknown>(`/v2/accounts/${sid}/trunks/${trunkId}/phone-numbers`),
  ]);
  const destText = JSON.stringify(destinations.data || "");
  const credentialId = env("VAPI_SIP_CREDENTIAL_ID");
  const pointsToVapi = /sip(\.eu)?\.vapi\.ai/i.test(destText);
  const pointsToCredential = credentialId ? destText.includes(credentialId) : pointsToVapi;
  checks.push({
    label: "Trunk routes inbound calls to Vapi",
    ok: destinations.ok && pointsToVapi && pointsToCredential,
    live: true,
    detail: !destinations.ok
      ? `Could not read trunk destinations: ${destinations.error}`
      : !pointsToVapi
        ? "No destination URI on this trunk points to *.sip.vapi.ai. Add `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai:5060;transport=tcp` as a destination."
        : !pointsToCredential
          ? "The trunk points to Vapi but not to VAPI_SIP_CREDENTIAL_ID — inbound calls may reach the wrong Vapi trunk."
          : "Destination URI points to the configured Vapi SIP trunk.",
  });
  const mapped = c.phoneNumber ? JSON.stringify(numbers.data || "").includes(digits(c.phoneNumber).slice(-10)) : false;
  checks.push({
    label: "ExoPhone mapped to the trunk",
    ok: numbers.ok && mapped,
    live: true,
    detail: !c.phoneNumber
      ? "Set EXOTEL_PHONE_NUMBER (E.164) to the ExoPhone customers call."
      : !numbers.ok
        ? `Could not read trunk phone numbers: ${numbers.error}`
        : mapped
          ? `ExoPhone …${digits(c.phoneNumber).slice(-4)} is mapped to the trunk.`
          : `ExoPhone …${digits(c.phoneNumber).slice(-4)} is not mapped to trunk ${c.trunkSid}.`,
  });
  return { configured: true, checks };
}

export type ExotelStatus = {
  callSid: string;
  status: string;
  from: string;
  to: string;
  direction: string;
  missed: boolean;
};

/** Exotel StatusCallback / Passthru fields (form-encoded or query). */
export function parseExotelCallback(params: URLSearchParams): ExotelStatus | null {
  const callSid = params.get("CallSid") || "";
  if (!callSid) return null;
  const status = (params.get("Status") || params.get("DialCallStatus") || params.get("CallStatus") || "").toLowerCase();
  return {
    callSid,
    status,
    from: params.get("From") || params.get("CallFrom") || "",
    to: params.get("To") || params.get("CallTo") || "",
    direction: (params.get("Direction") || "inbound").toLowerCase(),
    missed: ["busy", "no-answer", "failed", "canceled", "cancelled"].includes(status),
  };
}

/** Exotel callbacks are unsigned, so the URL carries EXOTEL_WEBHOOK_TOKEN (`?token=`). */
export function exotelCallbackAuthorized(token: string | null, expected = env("EXOTEL_WEBHOOK_TOKEN")) {
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
