import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, resolveRole } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { issueSignupOtp } from "@/lib/signup-otp";

export async function POST(req: Request) {
  let body: {
    email?: unknown;
    name?: unknown;
    password?: unknown;
    phone?: unknown;
    address?: unknown;
    mode?: unknown;
  };

  // Validate the request body
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const mode = body.mode === "wholesale" ? "wholesale" : "customer";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (!name || name.length > 100 || !phone || !address) {
    return NextResponse.json(
      { error: "Please provide a valid name, phone number and address." },
      { status: 400 },
    );
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
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

    const role = resolveRole(email, mode);

    let user;

    if (existing) {
      const db = await getDb();
      const passwordHash = await bcrypt.hash(password, 12);

      await db.collection("users").updateOne(
        { _id: existing._id, emailVerified: false },
        {
          $set: {
            name,
            phone,
            address,
            passwordHash,
            role,
            updatedAt: new Date(),
          },
        },
      );

      user = {
        _id: existing._id,
        email,
        role,
      };
    } else {
      user = await createUser({
        email,
        name,
        password,
        role,
        emailVerified: false,
        phone,
        address,
      });
    }

    await issueSignupOtp(email);

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration failed:", error);

    const message = error instanceof Error ? error.message : "";

    const dbDown =
      /Mongo|ECONNREFUSED|SSL|connection|timed out|Atlas|MONGODB_URI/i.test(
        message,
      );

    return NextResponse.json(
      {
        error: dbDown
          ? "We could not reach the account database. Please try again later or contact support at info@marinamuseinternational.com."
          : "Registration could not be completed. Please try again.",
      },
      { status: dbDown ? 503 : 500 },
    );
  }
}
