import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body.restricted !== "boolean") {
    return NextResponse.json({ error: "restricted must be true or false." }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role === "admin" || user.role === "staff") {
    return NextResponse.json({ error: "Manage team accounts from Team access." }, { status: 403 });
  }

  await db.collection("users").updateOne(
    { _id: new ObjectId(id) },
    { $set: { restricted: body.restricted, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("delete");
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
  if (user.role === "admin" || user.role === "staff") {
    return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 403 });
  }

  await db.collection("users").deleteOne({ _id: new ObjectId(id) });
  await db.collection("wholesale_applications").deleteMany({ userId: new ObjectId(id) });

  return NextResponse.json({ ok: true });
}
