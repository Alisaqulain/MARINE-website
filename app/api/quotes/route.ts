import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { getDb } from "@/lib/mongodb";
import type { BulkQuote } from "@/lib/db/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = await getDb();
    const doc: Omit<BulkQuote, "_id"> = {
      userId: new ObjectId(session.user.id),
      email: session.user.email ?? "",
      product: String(body.product ?? ""),
      productOther: body.productOther ? String(body.productOther) : undefined,
      quantity: Number(body.quantity ?? 0),
      logoEngraving: body.logoEngraving ? String(body.logoEngraving) : undefined,
      packaging: String(body.packaging ?? ""),
      destinationCountry: String(body.destinationCountry ?? ""),
      requiredDeliveryDate: body.requiredDeliveryDate
        ? String(body.requiredDeliveryDate)
        : undefined,
      incoterm: String(body.incoterm ?? "FOB"),
      status: "new",
      createdAt: new Date(),
    };
    const result = await db.collection<BulkQuote>("bulk_quotes").insertOne(doc);
    return NextResponse.json({ ok: true, id: String(result.insertedId) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to submit quote";
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
    .collection<BulkQuote>("bulk_quotes")
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return NextResponse.json({
    items: items.map((q) => ({
      id: String(q._id),
      email: q.email,
      product: q.productOther ?? q.product,
      quantity: q.quantity,
      destinationCountry: q.destinationCountry,
      requiredDeliveryDate: q.requiredDeliveryDate,
      incoterm: q.incoterm,
      packaging: q.packaging,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
    })),
  });
}
