import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { findUserByEmail } from "@/lib/auth-helpers";

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  let body: {
    email?: unknown;
    otp?: unknown;
    password?: unknown;
  };

  // Handle malformed JSON
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
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json(
      { error: "Please enter the six-digit verification code." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Your new password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const db = await getDb();
    const record = await db.collection("password_otps").findOne({
      email,
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired code. Request a new one." },
        { status: 400 },
      );
    }

    if (
      !record.expiresAt ||
      new Date(record.expiresAt).getTime() <= Date.now()
    ) {
      await db.collection("password_otps").deleteOne({ email });

      return NextResponse.json(
        { error: "Code expired. Request a new one." },
        { status: 400 },
      );
    }

    if (Number(record.attempts ?? 0) >= MAX_ATTEMPTS) {
      await db.collection("password_otps").deleteOne({ email });

      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 },
      );
    }

    if (String(record.otp) !== otp) {
      await db
        .collection("password_otps")
        .updateOne({ _id: record._id }, { $inc: { attempts: 1 } });

      return NextResponse.json(
        { error: "Invalid or expired code." },
        { status: 400 },
      );
    }

    const user = await findUserByEmail(email);

    if (!user?._id) {
      await db.collection("password_otps").deleteOne({ email });

      return NextResponse.json(
        { error: "Invalid or expired code. Request a new one." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .collection("users")
      .updateOne(
        { _id: user._id },
        { $set: { passwordHash, updatedAt: new Date() } },
      );

    // Remove the OTP after a successful password reset
    await db.collection("password_otps").deleteOne({ email });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reset-password request failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to reset your password right now. Please try again later.",
      },
      { status: 500 },
    );
  }
}
