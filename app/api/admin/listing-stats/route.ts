import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { LISTING_STAT_RANGES, listingStats, type ListingStatRange } from "@/lib/listing-stats";

export async function GET(req: Request) {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const param = new URL(req.url).searchParams.get("range");
  const range: ListingStatRange = LISTING_STAT_RANGES.includes(param as ListingStatRange)
    ? (param as ListingStatRange)
    : "this-month";
  try {
    const items = await listingStats(range);
    return NextResponse.json({ range, items, updatedAt: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load listing stats.";
    return NextResponse.json({ range, items: [], error: message }, { status: 500 });
  }
}
