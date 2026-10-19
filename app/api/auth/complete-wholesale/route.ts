import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
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
    const password = String(body.password ?? "");
    const confirm = String(body.confirm ?? "");
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (password !== confirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);
    const passwordHash = await bcrypt.hash(password, 12);

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

    if (!doc.contact) doc.contact = doc.company || doc.email.split("@")[0];
    if (!doc.phone || !doc.businessType || !doc.taxId || !doc.productInterest) {
      return NextResponse.json({ error: "Please complete all required trade fields." }, { status: 400 });
    }

    await db.collection<WholesaleApplication>("wholesale_applications").insertOne(doc);
    await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          passwordHash,
          wholesaleProfileComplete: true,
          role: "wholesale",
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not complete signup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
