import { randomInt } from "crypto";
import { getDb } from "@/lib/mongodb";
import { sendSignupOtp } from "@/lib/mail";
import bcrypt from "bcryptjs";

const OTP_EXPIRY_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function newOtp() {
  return String(randomInt(100000, 1000000));
}

export async function issueSignupOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = newOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  const db = await getDb();

  await db.collection("signup_otps").updateOne(
    { email: normalizedEmail },
    {
      $set: {
        email: normalizedEmail,
        otp,
        expiresAt,
        createdAt: now,
        attempts: 0,
      },
    },
    { upsert: true },
  );

  await sendSignupOtp(normalizedEmail, otp);
}

export async function consumeSignupOtp(
  email: string,
  otp: string,
  password?: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const submittedOtp = otp.trim();

  if (!/^\d{6}$/.test(submittedOtp)) {
    return false;
  }

  const db = await getDb();
  const collection = db.collection("signup_otps");
  const now = new Date();

  const record = await collection.findOne({
    email: normalizedEmail,
  });

  if (!record) {
    return false;
  }

  // Expired codes cannot be used.
  if (
    !record.expiresAt ||
    new Date(record.expiresAt).getTime() <= now.getTime()
  ) {
    await collection.deleteOne({
      _id: record._id,
      expiresAt: record.expiresAt,
    });

    return false;
  }

  // Stop verification after five failed attempts.
  if (Number(record.attempts ?? 0) >= MAX_ATTEMPTS) {
    await collection.deleteOne({ _id: record._id });
    return false;
  }

  if (String(record.otp) !== submittedOtp) {
    await collection.updateOne(
      {
        _id: record._id,
        $or: [
          { attempts: { $lt: MAX_ATTEMPTS } },
          { attempts: { $exists: false } },
        ],
      },
      { $inc: { attempts: 1 } },
    );

    return false;
  }

  const passwordHash =
    typeof password === "string" && password.length >= 8
      ? await bcrypt.hash(password, 12)
      : undefined;

  // Atomically claim the OTP so concurrent requests cannot both use it.
  const claimed = await collection.deleteOne({
    _id: record._id,
    otp: submittedOtp,
    expiresAt: { $gt: now },
    $or: [
      { attempts: { $lt: MAX_ATTEMPTS } },
      { attempts: { $exists: false } },
    ],
  });

  if (claimed.deletedCount !== 1) {
    return false;
  }

  const result = await db.collection("users").updateOne(
    {
      email: normalizedEmail,
      emailVerified: false,
    },
    {
      $set: {
        emailVerified: true,
        updatedAt: new Date(),
        ...(passwordHash ? { passwordHash } : {}),
      },
    },
  );

  if (result.matchedCount !== 1) {
    // The code was consumed, but the account could not be updated.
    // Log this case for server-side investigation.
    console.error(
      "Signup OTP was consumed but the account was not updated:",
      normalizedEmail,
    );

    return false;
  }

  return true;
}
