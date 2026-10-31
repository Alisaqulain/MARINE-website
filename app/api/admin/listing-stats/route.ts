import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  LISTING_STAT_CHANNELS,
  LISTING_STAT_RANGES,
  listingStats,
  type ListingStatChannel,
  type ListingStatRange,
} from "@/lib/listing-stats";

export async function GET(req: Request) {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const params = new URL(req.url).searchParams;
  const param = params.get("range");
  const range: ListingStatRange = LISTING_STAT_RANGES.includes(param as ListingStatRange)
    ? (param as ListingStatRange)
    : "this-month";
  const channelParam = params.get("channel");
  const channel: ListingStatChannel = LISTING_STAT_CHANNELS.includes(channelParam as ListingStatChannel)
    ? (channelParam as ListingStatChannel)
    : "retail";
  try {
    const items = await listingStats(range, channel);
    return NextResponse.json({ range, channel, items, updatedAt: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load listing stats.";
    return NextResponse.json({ range, channel, items: [], error: message }, { status: 500 });
  }
}
