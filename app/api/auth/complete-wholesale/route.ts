import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import type { WholesaleApplication } from "@/lib/db/types";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    const parsed: unknown = await req.json();

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const password = typeof body.password === "string" ? body.password : "";
  const confirm = getString(body.confirm);

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }

  if (password !== confirm) {
    return NextResponse.json(
      { error: "Passwords do not match." },
      { status: 400 },
    );
  }

  const contact = getString(body.contact);
  const company = getString(body.company);
  const phone = getString(body.phone);
  const address = getString(body.address);
  const website = getString(body.website);
  const businessType = getString(body.type ?? body.businessType);
  const taxId = getString(body.tax ?? body.taxId);
  const interest = getString(body.interest);
  const interestOther = getString(body.interestOther);

  if (
    !contact ||
    !company ||
    !phone ||
    !address ||
    !businessType ||
    !taxId ||
    !interest
  ) {
    return NextResponse.json(
      { error: "Please complete all required trade fields." },
      { status: 400 },
    );
  }

  if (
    contact.length > 100 ||
    company.length > 150 ||
    phone.length > 30 ||
    address.length > 500 ||
    businessType.length > 100 ||
    taxId.length > 100 ||
    interest.length > 200 ||
    interestOther.length > 200
  ) {
    return NextResponse.json(
      { error: "One or more fields exceed the allowed length." },
      { status: 400 },
    );
  }

  if (website && (!/^https?:\/\/\S+$/i.test(website) || website.length > 300)) {
    return NextResponse.json(
      { error: "Please enter a valid website URL." },
      { status: 400 },
    );
  }

  if (interest === "other" && !interestOther) {
    return NextResponse.json(
      { error: "Please specify the product under Other." },
      { status: 400 },
    );
  }

  if (!ObjectId.isValid(session.user.id)) {
    return NextResponse.json(
      { error: "Invalid user session. Please sign in again." },
      { status: 401 },
    );
  }

  try {
    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    // Only update a real user account.
    const user = await db.collection("users").findOne({ _id: userId });

    if (!user) {
      return NextResponse.json(
        { error: "Account not found. Please sign in again." },
        { status: 401 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const doc: Omit<WholesaleApplication, "_id"> = {
      userId,
      email: String(user.email ?? session.user.email ?? "")
        .trim()
        .toLowerCase(),
      company,
      contact,
      phone,
      address,
      website: website || undefined,
      businessType,
      taxId,
      productInterest: interest,
      productInterestOther: interestOther || undefined,
      status: "pending",
      createdAt: new Date(),
    };

    // Update the existing application if one exists.
    await db
      .collection<WholesaleApplication>("wholesale_applications")
      .updateOne({ userId }, { $set: doc }, { upsert: true });

    await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          passwordHash,
          wholesaleProfileComplete: true,
          role: "wholesale",
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Completing wholesale signup failed:", error);

    return NextResponse.json(
      {
        error: "Could not complete wholesale signup. Please try again.",
      },
      { status: 500 },
    );
  }
}
