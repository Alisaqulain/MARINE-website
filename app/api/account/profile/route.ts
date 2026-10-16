import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import type { WholesaleApplication } from "@/lib/db/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const userId = new ObjectId(session.user.id);
  const user = await db.collection("users").findOne({ _id: userId });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isWholesale = user.role === "wholesale";
  const application = isWholesale
    ? await db
        .collection<WholesaleApplication>("wholesale_applications")
        .findOne({ userId }, { sort: { createdAt: -1 } })
    : null;

  return NextResponse.json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone || application?.phone || "",
      address: user.address || application?.address || "",
      role: user.role,
      wholesaleProfileComplete: user.wholesaleProfileComplete ?? false,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    },
    wholesaleApplication: application
      ? {
          id: String(application._id),
          company: application.company,
          contact: application.contact,
          phone: application.phone,
          address: application.address,
          website: application.website,
          businessType: application.businessType,
          taxId: application.taxId,
          productInterest: application.productInterest,
          status: application.status,
          createdAt: application.createdAt.toISOString(),
        }
      : null,
  });
}
