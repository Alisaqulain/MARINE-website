/**
 * Exotel — Indian business number and telephony for Agent 2.
 * Exotel numbers cannot be imported into Vapi directly; the supported path is SIP:
 *   inbound  ExoPhone → Exotel vSIP trunk → destination `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai`
 *   outbound Vapi byo-sip-trunk credential → Exotel gateway (IP-whitelisted)
 * The vSIP endpoints below are the ones used by Exotel's own Exotel-Vapi-Connector (v2 `/trunks`).
 * Read-only checks only; nothing here places a call.
 */
import { timingSafeEqual } from "crypto";
import { classifyHttp, env, requestJson, type FailureClass } from "./http.ts";

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

export type ExotelCheck = {
  label: string;
  ok: boolean | null;
  detail: string;
  /** credential = Exotel accepted the key/token · live = a read-only API operation · config = local settings */
  kind: "credential" | "live" | "config";
  http?: number;
  failure?: FailureClass;
  action?: string;
};

type AccountInfo = { Account?: { Type?: string; Status?: string; KycStatus?: string } };
type NumberInfo = { PhoneNumber?: string };

/** v1 returns one ExoPhone as an object and several as an array, under the singular key IncomingPhoneNumber. */
export function exophoneRows(payload: unknown): NumberInfo[] {
  const root = (payload || {}) as Record<string, unknown>;
  const rows = root.IncomingPhoneNumber ?? root.IncomingPhoneNumbers;
  if (Array.isArray(rows)) return rows as NumberInfo[];
  return rows && typeof rows === "object" ? [rows as NumberInfo] : [];
}

/** EXOTEL_REGION is informational; the cluster that matters is EXOTEL_SUBDOMAIN. Flags a mismatch between the two. */
export function exotelRegionProblem(region: string, subdomain: string) {
  const r = region.trim().toLowerCase();
  if (!r) return null;
  const expected = /singapore|\bsg\b/.test(r) ? "api.exotel.com" : /mumbai|india|\bin\b/.test(r) ? "api.in.exotel.com" : null;
  return expected && expected !== subdomain ? `EXOTEL_REGION is "${region}" but EXOTEL_SUBDOMAIN is ${subdomain}; that region uses ${expected}.` : null;
}

/**
 * Credentials, account plan/KYC, ExoPhones, vSIP trunk, Vapi destination and number mapping.
 * Read-only GETs; nothing here places a call, buys a number or changes the account.
 */
export async function pingExotel(): Promise<{ configured: boolean; checks: ExotelCheck[] }> {
  const c = exotelConfig();
  if (!exotelConfigured()) return { configured: false, checks: [] };
  const checks: ExotelCheck[] = [];
  const sid = encodeURIComponent(c.accountSid);

  const regionProblem = exotelRegionProblem(env("EXOTEL_REGION"), c.subdomain);
  if (regionProblem) {
    checks.push({ label: "API cluster matches region", ok: false, kind: "config", failure: "config", detail: regionProblem, action: "Set EXOTEL_SUBDOMAIN to the cluster shown in my.exotel.com → API settings." });
  }

  const calls = await exotelGet<unknown>(`/v1/Accounts/${sid}/Calls.json?PageSize=1`);
  const refused = calls.status === 401 || calls.status === 403;
  checks.push({
    label: "API key/token accepted for the account",
    ok: calls.ok,
    kind: "credential",
    http: calls.status,
    failure: calls.ok ? undefined : refused ? "auth" : classifyHttp(calls),
    detail: calls.ok
      ? `Exotel accepted the credentials for account ${c.accountSid.slice(0, 4)}… on ${c.subdomain} (read-only call log request).`
      : refused
        ? `Exotel refused the credentials (${calls.error}).`
        : `Exotel could not be reached: ${calls.error}`,
    action: refused
      ? "Check EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID at my.exotel.com → API settings, and that EXOTEL_SUBDOMAIN is the account's cluster (Singapore = api.exotel.com, Mumbai = api.in.exotel.com)."
      : undefined,
  });
  if (!calls.ok) return { configured: true, checks };

  // Plan and KYC. The account response also contains the AuthToken: only Type/Status/KycStatus are read.
  const account = await exotelGet<AccountInfo>(`/v1/Accounts/${sid}.json`);
  const info = account.data?.Account;
  if (account.ok && info) {
    const trial = /trial/i.test(info.Type || "");
    const kycDone = /^(approved|verified|completed|done)$/i.test(info.KycStatus || "");
    const active = /active/i.test(info.Status || "");
    checks.push({
      label: "Account plan and KYC",
      ok: !trial && kycDone && active ? true : null,
      kind: "live",
      failure: trial || !kycDone || !active ? "activation" : undefined,
      detail: `Plan ${info.Type || "unknown"} · status ${info.Status || "unknown"} · KYC ${info.KycStatus || "unknown"}.${trial ? " Trial accounts have limited features; vSIP is normally enabled only on a KYC-verified paid account." : ""}`,
      action: trial || !kycDone ? "Client: complete KYC in my.exotel.com and ask Exotel to move the account off Trial with vSIP enabled." : undefined,
    });
  }

  const numbers = await exotelGet<unknown>(`/v1/Accounts/${sid}/IncomingPhoneNumbers.json`);
  if (numbers.ok) {
    const owned = exophoneRows(numbers.data).map((n) => digits(String(n.PhoneNumber || ""))).filter(Boolean);
    const configured = digits(c.phoneNumber);
    const match = configured ? owned.some((n) => n.slice(-10) === configured.slice(-10)) : false;
    const list = owned.map((n) => `…${n.slice(-4)}`).join(", ");
    checks.push({
      label: "ExoPhone",
      ok: !owned.length ? false : !configured ? null : match,
      kind: "config",
      failure: !owned.length ? "activation" : !configured || !match ? "config" : undefined,
      detail: !owned.length
        ? "No ExoPhone on the account."
        : !configured
          ? `${owned.length} ExoPhone(s) on the account (${list}), but EXOTEL_PHONE_NUMBER is not set.`
          : match
            ? `EXOTEL_PHONE_NUMBER …${configured.slice(-4)} is an ExoPhone on this account.`
            : `EXOTEL_PHONE_NUMBER …${configured.slice(-4)} is not one of this account's ExoPhones (${list}).`,
      action: !owned.length
        ? "Client: get an ExoPhone in my.exotel.com (may be paid — needs approval)."
        : !configured || !match
          ? "Set EXOTEL_PHONE_NUMBER to the full ExoPhone (E.164) from my.exotel.com → ExoPhones."
          : undefined,
    });
  }

  const trunks = await exotelGet<TrunkList>(`/v2/accounts/${sid}/trunks`);
  const trunkRows = trunks.ok ? exotelRows(trunks.data) : [];
  const v2Unsupported = !trunks.ok && trunks.status === 400 && /version v2 not supported/i.test(trunks.error || "");
  checks.push({
    label: "vSIP (SIP trunking) API",
    ok: trunks.ok,
    kind: "live",
    http: trunks.status,
    failure: trunks.ok ? undefined : v2Unsupported ? "activation" : classifyHttp(trunks),
    detail: trunks.ok
      ? `${trunkRows.length} SIP trunk(s) on the account.`
      : v2Unsupported
        ? `Exotel answered GET /v2/accounts/{sid}/trunks with "${(trunks.error || "").replace(/^HTTP \d+:\s*/, "")}". The request is correct (the same credentials work on v1); vSIP is not enabled on this account.`
        : `The vSIP trunk API failed (${trunks.error}).`,
    action: v2Unsupported
      ? "Client/Exotel: ask Exotel support to enable vSIP (SIP trunking) and the v2 Trunks API on this account. There is no supported workaround — Exotel numbers reach Vapi only over vSIP."
      : undefined,
  });
  if (!trunks.ok) return { configured: true, checks };

  if (!c.trunkSid) {
    checks.push({ label: "Trunk selected", ok: false, kind: "config", failure: "config", detail: "Set EXOTEL_TRUNK_SID to the trunk that routes your ExoPhone to Vapi." });
    return { configured: true, checks };
  }
  const trunkId = encodeURIComponent(c.trunkSid);
  const [destinations, mappedNumbers] = await Promise.all([
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
    kind: "live",
    http: destinations.status,
    failure: !destinations.ok ? classifyHttp(destinations) : pointsToVapi && pointsToCredential ? undefined : "config",
    detail: !destinations.ok
      ? `Could not read trunk destinations: ${destinations.error}`
      : !pointsToVapi
        ? "No destination URI on this trunk points to *.sip.vapi.ai. Add `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai:5060;transport=tcp` as a destination."
        : !pointsToCredential
          ? "The trunk points to Vapi but not to VAPI_SIP_CREDENTIAL_ID — inbound calls may reach the wrong Vapi trunk."
          : "Destination URI points to the configured Vapi SIP trunk.",
  });
  const mapped = c.phoneNumber ? JSON.stringify(mappedNumbers.data || "").includes(digits(c.phoneNumber).slice(-10)) : false;
  checks.push({
    label: "ExoPhone mapped to the trunk",
    ok: mappedNumbers.ok && mapped,
    kind: "live",
    http: mappedNumbers.status,
    failure: !mappedNumbers.ok ? classifyHttp(mappedNumbers) : mapped ? undefined : "config",
    detail: !c.phoneNumber
      ? "Set EXOTEL_PHONE_NUMBER (E.164) to the ExoPhone customers call."
      : !mappedNumbers.ok
        ? `Could not read trunk phone numbers: ${mappedNumbers.error}`
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
