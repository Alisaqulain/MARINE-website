/**
 * Shared outbound HTTP for provider APIs (Gemini, Vapi, Exotel, Meta, Google).
 * Timeouts on every call, a bounded retry on 429/5xx/network errors, and secrets removed from error text.
 * Relative imports only, so `npm run check:phase2` can load it with plain Node.
 */

export type HttpResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** Short, secret-free error for logs and /test. */
  error?: string;
  /** False when the request never reached the provider (DNS, TLS, timeout). */
  reached: boolean;
  /** True when the request was abandoned at the timeout. */
  timedOut?: boolean;
  /** Provider's requested wait before retrying (Retry-After header or Google RetryInfo), in ms. */
  retryAfterMs?: number;
  /** Network error code when the request failed without an HTTP answer (e.g. ECONNREFUSED, ECONNRESET). */
  errorCode?: string;
};

/**
 * Phase 2 D: delivery state of a one-shot provider send (WhatsApp POST /messages).
 * - sent:    2xx with a provider message id
 * - failed:  definitive rejection (any 4xx) or a failure PROVEN to happen before transmission
 * - unknown: anything that might have reached the provider (timeout, reset, 5xx/408, 2xx without an id)
 * `reached:false` alone never proves non-delivery: only the pre-transmission error codes below do.
 * Neither failed nor unknown may ever trigger an automatic resend.
 */
export type DeliveryState = "sent" | "failed" | "unknown";
export const PRE_TRANSMISSION_ERRORS = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
]);

export function deliveryStateFromHttp(res: Pick<HttpResult<unknown>, "ok" | "status" | "reached" | "timedOut" | "errorCode">, hasProviderId: boolean): DeliveryState {
  if (res.ok) return hasProviderId ? "sent" : "unknown";
  if (res.reached && res.status > 0) {
    if (res.status === 408 || res.status >= 500) return "unknown";
    if (res.status >= 400) return "failed";
    return "unknown";
  }
  if (res.timedOut) return "unknown";
  return res.errorCode && PRE_TRANSMISSION_ERRORS.has(res.errorCode) ? "failed" : "unknown";
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
/** Never sleep longer than this inside a request; a longer Retry-After is reported instead of waited for. */
const MAX_RETRY_WAIT_MS = 3_000;

/**
 * Why a provider call failed, as /test reports it:
 * config = our settings or request (wrong id, bad value, unknown model) · placeholder = a sample value instead of a real one ·
 * client = something only the account owner can create or supply · auth = credentials rejected ·
 * activation = the provider account lacks a feature the client/provider must enable ·
 * quota = a usage quota or rate limit (HTTP 429) · restriction = another provider-side API restriction (e.g. 403) ·
 * temporary = timeout, network or provider overload.
 */
export type FailureClass = "config" | "placeholder" | "client" | "auth" | "activation" | "quota" | "restriction" | "temporary";

export function classifyHttp(result: Pick<HttpResult<unknown>, "status" | "reached">): FailureClass {
  if (!result.reached || result.status === 0) return "temporary";
  if (result.status === 401) return "auth";
  if (result.status === 429) return "quota";
  if (result.status === 403) return "restriction";
  if (result.status === 408 || result.status >= 500) return "temporary";
  return "config";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value.trim());

/** Values copied from an example file instead of a real credential, e.g. YOUR_VAPI_ASSISTANT_ID or <token>. */
export function looksLikePlaceholder(value: string) {
  const v = value.trim();
  if (!v) return false;
  if (/^<.*>$|^\[.*\]$|^x{4,}$|changeme|replace[_-]?me|^your[_-]|^todo$|^example$|^placeholder$/i.test(v)) return true;
  // SHOUTING_SNAKE_CASE words (YOUR_API_KEY, VAPI_ASSISTANT_ID) — real keys and ids are never only capitals and underscores.
  return /^[A-Z]+(?:_[A-Z0-9]+)+$/.test(v);
}

function retryAfter(res: Response, data: unknown): number | undefined {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  // Google APIs: error.details[] { "@type": ".../google.rpc.RetryInfo", retryDelay: "12s" }
  const details = (data as { error?: { details?: { "@type"?: string; retryDelay?: string }[] } } | null)?.error?.details;
  const delay = details?.find((d) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const seconds = delay ? parseFloat(delay) : NaN;
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

/** Removes known secret values and common token shapes from a message. */
export function redactSecrets(text: string, secrets: (string | undefined)[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join("[redacted]");
  }
  return out
    .replace(/EAA[A-Za-z0-9]{10,}/g, "[redacted-token]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-key]")
    .replace(/\bAQ\.[0-9A-Za-z_.-]{20,}/g, "[redacted-key]")
    .replace(/ya29\.[0-9A-Za-z_.-]+/g, "[redacted-token]")
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[redacted-key]")
    .replace(/(key|token|secret|password|access_token|client_secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function providerError(data: unknown, raw = ""): string | undefined {
  // Exotel (Twilio-style) errors are XML even when JSON was requested.
  const xml = /<Message>([\s\S]*?)<\/Message>/i.exec(raw)?.[1]?.trim();
  if (xml) return xml;
  if (!data || typeof data !== "object") return undefined;
  const root = data as Record<string, unknown>;
  const err = root.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return [e.message, e.status, e.code].filter((v) => v != null && v !== "").join(" · ") || undefined;
  }
  if (typeof root.message === "string") return root.message;
  if (Array.isArray(root.message)) return root.message.join("; ");
  const rest = root.RestException as Record<string, unknown> | undefined;
  if (rest?.Message) return String(rest.Message);
  return undefined;
}

export async function requestJson<T = unknown>(
  url: string,
  init: RequestInit & {
    timeoutMs?: number;
    retries?: number;
    /** Retry after a timeout too (default true). A slow provider usually stays slow, so callers with a fallback turn this off. */
    retryTimeouts?: boolean;
    secrets?: (string | undefined)[];
  } = {}
): Promise<HttpResult<T>> {
  const { timeoutMs = 12_000, retries = 1, retryTimeouts = true, secrets = [], ...rest } = init;
  let last: HttpResult<T> = { ok: false, status: 0, data: null, reached: false, error: "Not attempted" };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let wait = 400 * (attempt + 1);
    try {
      const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
      const raw = await res.text();
      let data: T | null = null;
      try {
        data = raw ? (JSON.parse(raw) as T) : null;
      } catch {
        data = null;
      }
      if (res.ok) return { ok: true, status: res.status, data, reached: true };
      const message = (providerError(data, raw) || raw.slice(0, 200) || res.statusText).replace(/\s+/g, " ");
      last = {
        ok: false,
        status: res.status,
        data,
        reached: true,
        retryAfterMs: retryAfter(res, data),
        error: redactSecrets(`HTTP ${res.status}: ${message}`, secrets).slice(0, 300),
      };
      if (!RETRYABLE.has(res.status)) return last;
      if (last.retryAfterMs != null) {
        // Honour the provider's wait, but never block a request for long: report it instead.
        if (last.retryAfterMs > MAX_RETRY_WAIT_MS) return last;
        wait = Math.max(wait, last.retryAfterMs);
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const timedOut = name === "TimeoutError";
      const message = timedOut ? `Timed out after ${timeoutMs / 1000}s` : err instanceof Error ? err.message : "Network error";
      // undici wraps socket errors as TypeError("fetch failed") with the system error in `cause`.
      const anyErr = err as { code?: unknown; cause?: { code?: unknown } } | null;
      const rawCode = anyErr?.cause?.code ?? anyErr?.code;
      const errorCode = typeof rawCode === "string" ? rawCode : undefined;
      last = { ok: false, status: 0, data: null, reached: false, timedOut, errorCode, error: redactSecrets(message, secrets).slice(0, 300) };
      if (timedOut && !retryTimeouts) return last;
    }
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, wait));
  }
  return last;
}

export const env = (name: string) => process.env[name]?.trim() || "";
export const flag = (name: string) => env(name).toLowerCase() === "true";
