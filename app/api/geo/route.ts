import { NextResponse } from "next/server";
import { detectCountry } from "@/lib/geo";
import { REGION_COOKIE, regionFromCountry } from "@/lib/region";

export const dynamic = "force-dynamic";

/** Visitor's country and pricing region (India, United States or other). */
export async function GET(req: Request) {
  const country = await detectCountry(req);
  const region = regionFromCountry(country);
  const res = NextResponse.json({ country, region });
  // Only remember a real result, so a failed lookup is retried on the next visit.
  if (country) {
    res.cookies.set(REGION_COOKIE, region, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  }
  return res;
}
