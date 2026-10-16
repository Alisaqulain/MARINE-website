import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import type { AdminProduct } from "@/lib/db/types";
import { getDb } from "@/lib/mongodb";

export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter((id: string) => ObjectId.isValid(id)) : [];
  if (!ids.length) {
    return NextResponse.json({ error: "Select saved listings first. Catalogue items need to be edited and saved before this." }, { status: 400 });
  }

  const now = new Date();
  const set: Partial<AdminProduct> = { updatedAt: now };
  if (action === "deactivate") set.active = false;
  else if (action === "activate") set.active = true;
  else if (action === "renew") {
    set.active = true;
    const renews = new Date(now);
    renews.setMonth(renews.getMonth() + 4);
    set.renewsAt = renews.toISOString();
  } else if (action === "feature") set.featured = true;
  else if (action === "unfeature") set.featured = false;
  else return NextResponse.json({ error: "Unknown listing action." }, { status: 400 });

  const db = await getDb();
  const result = await db.collection<AdminProduct>("products").updateMany(
    { _id: { $in: ids.map((id: string) => new ObjectId(id)) } },
    { $set: set }
  );
  return NextResponse.json({ ok: true, updated: result.modifiedCount });
}
