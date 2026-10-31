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
};

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/** Removes known secret values and common token shapes from a message. */
export function redactSecrets(text: string, secrets: (string | undefined)[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join("[redacted]");
  }
  return out
    .replace(/EAA[A-Za-z0-9]{10,}/g, "[redacted-token]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-key]")
    .replace(/ya29\.[0-9A-Za-z_.-]+/g, "[redacted-token]")
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[redacted-key]")
    .replace(/(key|token|secret|password|access_token|client_secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function providerError(data: unknown): string | undefined {
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
  init: RequestInit & { timeoutMs?: number; retries?: number; secrets?: (string | undefined)[] } = {}
): Promise<HttpResult<T>> {
  const { timeoutMs = 12_000, retries = 1, secrets = [], ...rest } = init;
  let last: HttpResult<T> = { ok: false, status: 0, data: null, reached: false, error: "Not attempted" };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
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
      const message = providerError(data) || raw.slice(0, 200) || res.statusText;
      last = {
        ok: false,
        status: res.status,
        data,
        reached: true,
        error: redactSecrets(`HTTP ${res.status}: ${message}`, secrets).slice(0, 300),
      };
      if (!RETRYABLE.has(res.status)) return last;
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const message = name === "TimeoutError" ? `Timed out after ${timeoutMs / 1000}s` : err instanceof Error ? err.message : "Network error";
      last = { ok: false, status: 0, data: null, reached: false, error: redactSecrets(message, secrets).slice(0, 300) };
    }
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  return last;
}

export const env = (name: string) => process.env[name]?.trim() || "";
export const flag = (name: string) => env(name).toLowerCase() === "true";
