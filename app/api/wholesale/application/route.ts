import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import type { WholesaleApplication } from "@/lib/db/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const doc: Omit<WholesaleApplication, "_id"> = {
      userId,
      email: session.user.email ?? String(body.email ?? ""),
      company: String(body.company ?? ""),
      contact: String(body.contact ?? ""),
      phone: String(body.phone ?? ""),
      website: body.website ? String(body.website) : undefined,
      businessType: String(body.type ?? body.businessType ?? ""),
      taxId: String(body.tax ?? body.taxId ?? ""),
      productInterest: String(body.interest ?? ""),
      productInterestOther: body.interestOther ? String(body.interestOther) : undefined,
      status: "pending",
      createdAt: new Date(),
    };

    await db.collection<WholesaleApplication>("wholesale_applications").insertOne(doc);
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { wholesaleProfileComplete: true, role: "wholesale", updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const items = await db
    .collection<WholesaleApplication>("wholesale_applications")
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return NextResponse.json({
    items: items.map((a) => ({
      id: String(a._id),
      userId: String(a.userId),
      email: a.email,
      company: a.company,
      contact: a.contact,
      phone: a.phone,
      website: a.website,
      businessType: a.businessType,
      taxId: a.taxId,
      productInterest: a.productInterest,
      productInterestOther: a.productInterestOther,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
