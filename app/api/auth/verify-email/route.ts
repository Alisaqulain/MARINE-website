import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth-helpers";
import { consumeSignupOtp, issueSignupOtp } from "@/lib/signup-otp";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (body.check === true) {
      const user = await findUserByEmail(email);
      return NextResponse.json({ needsVerification: user?.emailVerified === false });
    }
    const otp = String(body.otp ?? "").trim();
    const password = String(body.password ?? "");
    if (!email || otp.length < 6) {
      return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (user.emailVerified !== false) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    const ok = await consumeSignupOtp(email, otp, password);
    if (!ok) {
      return NextResponse.json({ error: "That code is incorrect or expired." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not verify the code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const user = await findUserByEmail(email);
    if (!user || user.emailVerified !== false) {
      return NextResponse.json({ ok: true });
    }
    await issueSignupOtp(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not resend the code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
