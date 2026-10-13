import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { getDb } from "@/lib/mongodb";
import type { ReturnRequest } from "@/lib/db/types";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const db = await getDb();

    const doc: Omit<ReturnRequest, "_id"> = {
      userId: session?.user?.id ? new ObjectId(session.user.id) : undefined,
      orderNumber: String(body.orderNumber ?? ""),
      customerName: String(body.customerName ?? ""),
      productName: String(body.productName ?? ""),
      reason: String(body.reason ?? ""),
      email: String(body.email ?? ""),
      status: "new",
      createdAt: new Date(),
    };

    if (!doc.orderNumber || !doc.customerName || !doc.productName || !doc.reason || !doc.email) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    await db.collection<ReturnRequest>("return_requests").insertOne(doc);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to submit return";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!isDashboardRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const items = await db
    .collection<ReturnRequest>("return_requests")
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return NextResponse.json({
    items: items.map((r) => ({
      id: String(r._id),
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      productName: r.productName,
      reason: r.reason,
      email: r.email,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
