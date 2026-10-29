import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  deleteAllWebsiteVisitors,
  deleteWebsiteVisitor,
  listingViewStats,
  listWebsiteVisitors,
} from "@/lib/page-views";

export async function GET(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize")) || 25));
  try {
    const [data, listings] = await Promise.all([listWebsiteVisitors(page, pageSize), listingViewStats()]);
    return NextResponse.json({ ...data, listingViews: listings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load visitors.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  if (body.all === true) {
    await deleteAllWebsiteVisitors();
    return NextResponse.json({ ok: true });
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!ids.length) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
  }
  let removed = 0;
  for (const id of ids) {
    if (await deleteWebsiteVisitor(id)) removed += 1;
  }
  return NextResponse.json({ ok: true, removed });
}
