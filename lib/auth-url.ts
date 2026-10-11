const PRODUCTION_SITE = "https://marinamuseinternational.com";

function isLocalhostUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("localhost")) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

/** Normalise AUTH_URL / NEXTAUTH_URL (must include http:// or https://). */
export function getAuthBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const trimmed = raw.trim();

  if (process.env.NODE_ENV === "production") {
    if (site && site.startsWith("http") && !isLocalhostUrl(site)) {
      return normalizeUrl(site);
    }
    if (trimmed && !isLocalhostUrl(trimmed)) {
      return normalizeUrl(trimmed);
    }
    return PRODUCTION_SITE;
  }

  if (!trimmed) {
    return "http://localhost:3000";
  }
  return normalizeUrl(trimmed);
}

/** Public site origin for links (never localhost on production). */
export function getSiteOrigin(): string {
  return getAuthBaseUrl();
}

/** Call once at auth boot so NextAuth never sees a malformed URL (e.g. `localhost:3000` without scheme). */
export function ensureAuthEnv() {
  const base = getAuthBaseUrl();
  process.env.AUTH_URL = base;
  process.env.NEXTAUTH_URL = base;
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http")) {
    process.env.NEXT_PUBLIC_SITE_URL = base;
  }
}
