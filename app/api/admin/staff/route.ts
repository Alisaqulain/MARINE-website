import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { DbUser } from "@/lib/db/types";
import { isSuperAdminEmail, normalizeStaffPermissions } from "@/lib/staff-access";

export async function GET() {
  const { error } = await requireAdminSession("team");
  if (error) return error;

  const db = await getDb();
  const users = await db
    .collection<DbUser>("users")
    .find({ role: "staff" })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    items: users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      access: user.permissions?.access === "limited" ? "limited" : "full",
      canAddProduct: user.permissions?.access === "limited" ? Boolean(user.permissions.canAddProduct) : true,
      canDelete: user.permissions?.access === "limited" ? Boolean(user.permissions.canDelete) : true,
      restricted: Boolean(user.restricted || user.permissions?.restricted),
      createdAt: user.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession("team");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (isSuperAdminEmail(email)) {
    return NextResponse.json({ error: "That email is the main admin account." }, { status: 400 });
  }

  const permissions = normalizeStaffPermissions(body);
  const db = await getDb();
  const existing = await db.collection<DbUser>("users").findOne({ email });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const now = new Date();
  const doc: DbUser = {
    email,
    name,
    role: "staff",
    passwordHash: await bcrypt.hash(password, 12),
    permissions,
    restricted: permissions.restricted,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<DbUser>("users").insertOne(doc);
  return NextResponse.json({ id: String(result.insertedId) });
}
