import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "@/lib/auth-helpers";
import { getDb, withMongoWriteRetry } from "@/lib/mongodb";
import { products } from "@/lib/products";
import { resolveRole } from "@/lib/roles";
import { issueSignupOtp } from "@/lib/signup-otp";
import type { WholesaleApplication } from "@/lib/db/types";

function resolveProductInterest(
  interest: string,
  interestOther?: string,
): string {
  if (!interest) return interestOther?.trim() ?? "";
  if (interest === "other") return interestOther?.trim() || "Other";

  const match = /^(b2c|b2b):(.+)$/.exec(interest);

  if (match) {
    const product = products.find((item) => item.slug === match[2]);
    const prefix = match[1] === "b2b" ? "B2B" : "B2C";
    return product ? `${prefix}: ${product.name}` : interest;
  }

  return interest;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
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

  const email = getString(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const confirm = getString(body.confirm ?? body.confirmPassword);
  const contact = getString(body.contact);
  const company = getString(body.company);
  const phone = getString(body.phone);
  const address = getString(body.address);
  const businessType = getString(body.type ?? body.businessType);
  const taxId = getString(body.tax ?? body.taxId);
  const interestRaw = getString(body.interest);
  const interestOther = getString(body.interestOther);
  const website = getString(body.website);

  if (!validEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid company email address." },
      { status: 400 },
    );
  }

  if (!contact || contact.length > 100) {
    return NextResponse.json(
      { error: "A valid contact person is required." },
      { status: 400 },
    );
  }

  if (!company || company.length > 150) {
    return NextResponse.json(
      { error: "Please enter a valid company name." },
      { status: 400 },
    );
  }

  if (!phone || phone.length > 30) {
    return NextResponse.json(
      { error: "Please enter a valid phone number." },
      { status: 400 },
    );
  }

  if (!address || address.length > 500) {
    return NextResponse.json(
      { error: "Please enter a valid address." },
      { status: 400 },
    );
  }

  if (!businessType || businessType.length > 100) {
    return NextResponse.json(
      { error: "Business type is required." },
      { status: 400 },
    );
  }

  if (!taxId || taxId.length > 100) {
    return NextResponse.json(
      { error: "Tax ID / VAT / GST is required." },
      { status: 400 },
    );
  }

  if (!interestRaw) {
    return NextResponse.json(
      { error: "Please select a product you are interested in." },
      { status: 400 },
    );
  }

  if (interestRaw === "other" && !interestOther) {
    return NextResponse.json(
      { error: "Please enter the product name under Other." },
      { status: 400 },
    );
  }

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

  if (website && (!/^https?:\/\/\S+$/i.test(website) || website.length > 300)) {
    return NextResponse.json(
      { error: "Please enter a valid website URL." },
      { status: 400 },
    );
  }

  try {
    const existing = await findUserByEmail(email);

    if (existing && existing.emailVerified !== false) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const role = resolveRole(email, "wholesale");

    const user = await withMongoWriteRetry(async () => {
      const currentUser =
        existing ??
        (await createUser({
          email,
          name: contact,
          password,
          role,
          emailVerified: false,
          phone,
          address,
        }));

      const db = await getDb();
      const userId =
        currentUser._id instanceof ObjectId
          ? currentUser._id
          : new ObjectId(String(currentUser._id));

      const passwordHash = existing
        ? await bcrypt.hash(password, 12)
        : undefined;

      const application: Omit<WholesaleApplication, "_id"> = {
        userId,
        email,
        company,
        contact,
        phone,
        address,
        website: website || undefined,
        businessType,
        taxId,
        productInterest: resolveProductInterest(interestRaw, interestOther),
        productInterestOther: interestOther || undefined,
        status: "pending",
        createdAt: new Date(),
      };

      // Upsert instead of insert to avoid duplicate applications on retries.
      await db
        .collection<WholesaleApplication>("wholesale_applications")
        .updateOne({ userId }, { $set: application }, { upsert: true });

      await db.collection("users").updateOne(
        { _id: userId, emailVerified: false },
        {
          $set: {
            wholesaleProfileComplete: true,
            role: "wholesale",
            emailVerified: false,
            name: contact,
            phone,
            address,
            ...(passwordHash ? { passwordHash } : {}),
            updatedAt: new Date(),
          },
        },
      );

      return {
        id: String(userId),
        email: currentUser.email,
      };
    });

    // Send the email after the database retry block completes.
    await issueSignupOtp(email);

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      user: {
        id: user.id,
        email: user.email,
        role: "wholesale",
      },
    });
  } catch (error) {
    console.error("Wholesale registration failed:", error);

    const message = error instanceof Error ? error.message : "";
    const dbDown =
      /Mongo|ECONNREFUSED|SSL|connection|timed out|Atlas|MONGODB_URI/i.test(
        message,
      );

    return NextResponse.json(
      {
        error: dbDown
          ? "We could not reach the account database. Please try again later or contact support at info@marinamuseinternational.com."
          : "Wholesale registration could not be completed. Please try again.",
      },
      { status: dbDown ? 503 : 500 },
    );
  }
}
