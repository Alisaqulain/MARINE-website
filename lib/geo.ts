import { isPriceRegion, REGION_COOKIE, regionFromCountry, type PriceRegion } from "@/lib/region";

/** Country headers set by CDNs / proxies when the site sits behind one. */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-country-code"];

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip")?.trim() || "";
  if (!ip) return null;
  // Local and private addresses cannot be located.
  if (/^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i.test(ip) || ip === "localhost") return null;
  return ip.replace(/^::ffff:/, "");
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Free, key-less lookups: country.is first, ipapi.co (1,000/day free) as a fallback. */
async function lookupCountry(ip: string): Promise<string | null> {
  const primary = await fetchText(`https://api.country.is/${encodeURIComponent(ip)}`);
  if (primary) {
    try {
      const code = (JSON.parse(primary) as { country?: string }).country;
      if (code && /^[A-Z]{2}$/i.test(code)) return code.toUpperCase();
    } catch {
      /* try the fallback */
    }
  }
  const fallback = (await fetchText(`https://ipapi.co/${encodeURIComponent(ip)}/country/`))?.trim();
  return fallback && /^[A-Z]{2}$/i.test(fallback) ? fallback.toUpperCase() : null;
}

function cookieRegion(req: Request): PriceRegion | null {
  const match = new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]+)`).exec(req.headers.get("cookie") ?? "");
  const value = match ? decodeURIComponent(match[1]) : null;
  return isPriceRegion(value) ? value : null;
}

export async function detectCountry(req: Request): Promise<string | null> {
  for (const name of COUNTRY_HEADERS) {
    const code = req.headers.get(name)?.trim().toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code) && code !== "XX") return code;
  }
  const ip = clientIp(req);
  return ip ? lookupCountry(ip) : null;
}

/**
 * Pricing region for this request. Checkout calls this so the charge matches the location,
 * falling back to the region cookie the storefront saved when the lookup is unavailable.
 */
export async function detectRegion(req: Request): Promise<PriceRegion> {
  const country = await detectCountry(req);
  if (country) return regionFromCountry(country);
  return cookieRegion(req) ?? "other";
}

