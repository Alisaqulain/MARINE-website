import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { WholesaleApplication } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const status = body.status;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .collection<WholesaleApplication>("wholesale_applications")
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status } },
      { returnDocument: "after" }
    );

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const app = result;
  if (status === "approved" && app.userId) {
    await db.collection("users").updateOne(
      { _id: app.userId },
      { $set: { role: "wholesale", wholesaleProfileComplete: true, updatedAt: new Date() } }
    );
  }

  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection("wholesale_applications").deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
