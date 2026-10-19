import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth-helpers";
import { consumeSignupOtp } from "@/lib/signup-otp";

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  let body: {
    email?: unknown;
    otp?: unknown;
    password?: unknown;
    check?: unknown;
  };

  // Handle invalid JSON
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

  if (!validEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const user = await findUserByEmail(email);

    // Check whether email verification is needed
    if (body.check === true) {
      return NextResponse.json({
        needsVerification: user?.emailVerified === false,
      });
    }

    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Enter the six-digit code from your email." },
        { status: 400 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired code." },
        { status: 400 },
      );
    }

    if (user.emailVerified !== false) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
      });
    }

    const verified = await consumeSignupOtp(email, otp, password);

    if (!verified) {
      return NextResponse.json(
        { error: "That code is incorrect or expired." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email verification failed:", error);

    return NextResponse.json(
      {
        error: "Unable to verify your email right now. Please try again.",
      },
      { status: 500 },
    );
  }
}
