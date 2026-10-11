import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { createUser, findUserByEmail } from "@/lib/auth-helpers";
import { getDb, withMongoWriteRetry } from "@/lib/mongodb";
import { products } from "@/lib/products";
import { resolveRole } from "@/lib/roles";
import type { WholesaleApplication } from "@/lib/db/types";

function resolveProductInterest(interest: string, interestOther?: string): string {
  if (!interest) return interestOther?.trim() ?? "";
  if (interest === "other") return interestOther?.trim() || "Other";
  const m = /^(b2c|b2b):(.+)$/.exec(interest);
  if (m) {
    const p = products.find((x) => x.slug === m[2]);
    const prefix = m[1] === "b2b" ? "B2B" : "B2C";
    return p ? `${prefix}: ${p.name}` : interest;
  }
  return interest;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const confirm = String(body.confirm ?? body.confirmPassword ?? "");
    const contact = String(body.contact ?? "").trim();
    const company = String(body.company ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const businessType = String(body.type ?? body.businessType ?? "").trim();
    const taxId = String(body.tax ?? body.taxId ?? "").trim();
    const interestRaw = String(body.interest ?? "");
    const interestOther = body.interestOther ? String(body.interestOther) : undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Company email is required and will be your login." }, { status: 400 });
    }
    if (!contact) {
      return NextResponse.json({ error: "Contact person is required." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone is required." }, { status: 400 });
    }
    if (!businessType) {
      return NextResponse.json({ error: "Business type is required." }, { status: 400 });
    }
    if (!taxId) {
      return NextResponse.json({ error: "Tax ID / VAT / GST is required." }, { status: 400 });
    }
    if (!interestRaw) {
      return NextResponse.json({ error: "Please select a product you are interested in." }, { status: 400 });
    }
    if (interestRaw === "other" && !interestOther?.trim()) {
      return NextResponse.json({ error: "Please enter the product name under Other." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (password !== confirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    return await withMongoWriteRetry(async () => {
      const existing = await findUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }

      const user = await createUser({
        email,
        name: contact,
        password,
        role: resolveRole(email, "wholesale"),
      });

      const db = await getDb();
      const userId = user._id instanceof ObjectId ? user._id : new ObjectId(String(user._id));

      const doc: Omit<WholesaleApplication, "_id"> = {
        userId,
        email,
        company,
        contact,
        phone,
        website: body.website ? String(body.website) : undefined,
        businessType,
        taxId,
        productInterest: resolveProductInterest(interestRaw, interestOther),
        productInterestOther: interestOther,
        status: "pending",
        createdAt: new Date(),
      };

      await db.collection<WholesaleApplication>("wholesale_applications").insertOne(doc);
      await db.collection("users").updateOne(
        { _id: userId },
        { $set: { wholesaleProfileComplete: true, role: "wholesale", updatedAt: new Date() } }
      );

      return NextResponse.json({
        ok: true,
        user: { id: String(userId), email: user.email, role: "wholesale" },
      });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const dbDown =
      /Mongo|ECONNREFUSED|SSL|connection|timed out|Atlas/i.test(message) ||
      message.includes("MONGODB_URI");
    return NextResponse.json(
      {
        error: dbDown
          ? "We could not reach the account database. Please try again in a few minutes or email info@marinamuseinternational.com."
          : message,
      },
      { status: dbDown ? 503 : 500 }
    );
  }
}
