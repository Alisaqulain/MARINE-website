/**
 * Google service-account OAuth (JWT bearer grant) for GA4 Data API and Search Console.
 * Uses Node crypto directly, so no Google SDK dependency. Tokens are cached per scope until shortly before expiry.
 */
import { createSign } from "crypto";
import { env, requestJson } from "../ai/http.ts";

export const SCOPES = {
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
} as const;

type ServiceAccount = { email: string; privateKey: string };

/** GOOGLE_SERVICE_ACCOUNT_JSON (raw or base64 key file) or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. */
export function serviceAccount(): ServiceAccount | null {
  const json = env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (json) {
    try {
      const text = json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8");
      const parsed = JSON.parse(text) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) return { email: parsed.client_email, privateKey: parsed.private_key };
    } catch {
      return null;
    }
    return null;
  }
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  return email && key ? { email, privateKey: key } : null;
}

export function serviceAccountEmail() {
  return serviceAccount()?.email || "";
}

const cache = new Map<string, { token: string; expires: number }>();

export function signJwt(account: ServiceAccount, scope: string, now = Math.floor(Date.now() / 1000)) {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: account.email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

export async function googleAccessToken(scope: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const account = serviceAccount();
  if (!account) return { ok: false, error: "Google service account credentials are not set or not readable." };
  const hit = cache.get(scope);
  if (hit && hit.expires > Date.now() + 60_000) return { ok: true, token: hit.token };
  let assertion: string;
  try {
    assertion = signJwt(account, scope);
  } catch {
    return { ok: false, error: "The service account private key could not sign a token. Check the key format (PEM with \\n line breaks)." };
  }
  const res = await requestJson<{ access_token?: string; expires_in?: number; error_description?: string }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    timeoutMs: 10_000,
    secrets: [account.privateKey],
  });
  if (!res.ok || !res.data?.access_token) {
    return { ok: false, error: res.data?.error_description || res.error || "Google did not issue a token." };
  }
  cache.set(scope, { token: res.data.access_token, expires: Date.now() + (res.data.expires_in || 3600) * 1000 });
  return { ok: true, token: res.data.access_token };
}
