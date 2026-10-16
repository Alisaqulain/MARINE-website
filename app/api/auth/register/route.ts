import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, resolveRole } from "@/lib/auth-helpers";
import { issueSignupOtp } from "@/lib/signup-otp";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const mode = body.mode === "wholesale" ? "wholesale" : "customer";

    if (!email || !name || password.length < 8 || !phone || !address) {
      return NextResponse.json(
        { error: "Name, email, phone, address and password (8+ characters) are required." },
        { status: 400 }
      );
    }

    const existing = await findUserByEmail(email);
    if (existing && existing.emailVerified !== false) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const user =
      existing ??
      (await createUser({
        email,
        name,
        password,
        role: resolveRole(email, mode),
        emailVerified: false,
        phone,
        address,
      }));
    if (existing) {
      const { getDb } = await import("@/lib/mongodb");
      const db = await getDb();
      const passwordHash = await bcrypt.hash(password, 12);
      await db.collection("users").updateOne(
        { _id: existing._id },
        {
          $set: {
            name,
            phone,
            address,
            passwordHash,
            role: resolveRole(email, mode),
            emailVerified: false,
            updatedAt: new Date(),
          },
        }
      );
    }

    await issueSignupOtp(email);

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      user: { id: String(user._id), email: user.email, role: user.role },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const dbDown =
      /Mongo|ECONNREFUSED|SSL|connection|timed out|Atlas/i.test(message) ||
      message.includes("MONGODB_URI");
    return NextResponse.json(
      {
        error: dbDown
          ? "We could not reach the account database. Please try again in a few minutes or contact support at info@marinamuseinternational.com."
          : message,
      },
      { status: dbDown ? 503 : 500 }
    );
  }
}
