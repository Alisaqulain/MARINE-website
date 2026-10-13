import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { deleteWebsiteVisitor } from "@/lib/page-views";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;

  const { id } = await ctx.params;
  const visitorId = decodeURIComponent(id);
  if (!visitorId || visitorId.length > 512) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const removed = await deleteWebsiteVisitor(visitorId);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
