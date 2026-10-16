import { getDb } from "@/lib/mongodb";
import { sendSignupOtp } from "@/lib/mail";
import bcrypt from "bcryptjs";

export function newOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueSignupOtp(email: string) {
  const otp = newOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const db = await getDb();
  await db.collection("signup_otps").updateOne(
    { email },
    { $set: { email, otp, expiresAt, createdAt: new Date() } },
    { upsert: true }
  );
  await sendSignupOtp(email, otp);
}

export async function consumeSignupOtp(email: string, otp: string, password?: string) {
  const db = await getDb();
  const record = await db.collection("signup_otps").findOne({ email });
  if (!record || String(record.otp) !== otp.trim()) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return false;
  const passwordHash =
    typeof password === "string" && password.length >= 8
      ? await bcrypt.hash(password, 12)
      : undefined;
  await db.collection("users").updateOne(
    { email },
    {
      $set: {
        emailVerified: true,
        updatedAt: new Date(),
        ...(passwordHash ? { passwordHash } : {}),
      },
    }
  );
  await db.collection("signup_otps").deleteOne({ email });
  return true;
}
