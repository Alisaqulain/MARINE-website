import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getDb } from "@/lib/mongodb";
import { findUserByEmail } from "@/lib/auth-helpers";
import { sendPasswordOtp } from "@/lib/mail";

export async function POST(req: Request) {
  let body: { email?: unknown };

  // Handle invalid JSON separately
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  // Validate and normalize email
  const normalized =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const user = await findUserByEmail(normalized);

    // Use the same response whether the account exists or not
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: "If that email exists, a code has been sent.",
      });
    }

    // Generate a cryptographically secure six-digit OTP
    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const db = await getDb();

    await db.collection("password_otps").updateOne(
      { email: normalized },
      {
        $set: {
          email: normalized,
          otp,
          expiresAt,
          createdAt: new Date(),
          attempts: 0,
        },
      },
      { upsert: true },
    );

    await sendPasswordOtp(normalized, otp);

    return NextResponse.json({
      ok: true,
      message: "If that email exists, a code has been sent.",
    });
  } catch (error) {
    // Keep technical details in server logs, not in the API response
    console.error("Forgot-password request failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to process your request right now. Please try again later.",
      },
      { status: 500 },
    );
  }
}
