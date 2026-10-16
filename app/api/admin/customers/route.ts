import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { DbUser, UserRole, WholesaleApplication } from "@/lib/db/types";

export async function GET(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const segment = searchParams.get("segment");
  const db = await getDb();
  const filter =
    segment === "wholesale"
      ? { role: "wholesale" as const }
      : segment === "customer"
        ? { role: "customer" as const }
        : { role: { $in: ["customer", "wholesale"] as UserRole[] } };

  const users = await db
    .collection<DbUser>("users")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const ids = users.flatMap((u) => (u._id ? [u._id] : []));
  const applications = ids.length
    ? await db
        .collection<WholesaleApplication>("wholesale_applications")
        .find({ userId: { $in: ids } })
        .sort({ createdAt: -1 })
        .toArray()
    : [];
  const applicationByUser = new Map<string, WholesaleApplication>();
  for (const application of applications) {
    const key = String(application.userId);
    if (!applicationByUser.has(key)) applicationByUser.set(key, application);
  }

  return NextResponse.json({
    items: users.map((u) => {
      const application = u._id ? applicationByUser.get(String(u._id)) : undefined;
      const created = u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt);
      return {
        id: String(u._id),
        name: u.name,
        phone: u.phone || application?.phone || "—",
        email: u.email,
        accountType: u.role === "wholesale" ? "Wholesale" : u.role === "customer" ? "Customer" : u.role,
        address: u.address || application?.address || "—",
        memberSince: Number.isNaN(created.getTime()) ? "—" : created.toLocaleDateString(),
        role: u.role,
        restricted: Boolean(u.restricted),
        verified: u.emailVerified === false ? "Not verified" : "Verified",
        wholesaleProfileComplete: u.wholesaleProfileComplete,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
      };
    }),
  });
}
