import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role === "admin") {
    return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 403 });
  }

  await db.collection("users").deleteOne({ _id: new ObjectId(id) });
  await db.collection("wholesale_applications").deleteMany({ userId: new ObjectId(id) });

  return NextResponse.json({ ok: true });
}
