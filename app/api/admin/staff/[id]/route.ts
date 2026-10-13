import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { DbUser } from "@/lib/db/types";
import { normalizeStaffPermissions } from "@/lib/staff-access";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("team");
  if (error) return error;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection<DbUser>("users").findOne({ _id: new ObjectId(id) });
  if (!user || user.role !== "staff") {
    return NextResponse.json({ error: "Team account not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const current = user.permissions ?? {
    access: "limited" as const,
    canAddProduct: false,
    canDelete: false,
    restricted: Boolean(user.restricted),
  };
  const permissions = normalizeStaffPermissions({
    access: body.access ?? current.access,
    canAddProduct: body.canAddProduct ?? current.canAddProduct,
    canDelete: body.canDelete ?? current.canDelete,
    restricted: body.restricted ?? current.restricted,
  });

  await db.collection<DbUser>("users").updateOne(
    { _id: user._id },
    {
      $set: {
        permissions,
        restricted: permissions.restricted,
        updatedAt: new Date(),
      },
    }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await requireAdminSession("team");
  if (error) return error;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection<DbUser>("users").findOne({ _id: new ObjectId(id) });
  if (!user || user.role !== "staff") {
    return NextResponse.json({ error: "Team account not found." }, { status: 404 });
  }
  await db.collection<DbUser>("users").deleteOne({ _id: user._id });
  return NextResponse.json({ ok: true });
}
