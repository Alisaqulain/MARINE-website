import nodemailer from "nodemailer";

import { PASSWORD_OTP_FROM } from "@/lib/password-otp-email";
import { adminEmailsList } from "@/lib/roles";

export { PASSWORD_OTP_FROM };

function mailLoginError(error: unknown): Error | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/535|BadCredentials|Username and Password not accepted/i.test(message)) {
    return new Error(
      "We could not send the verification email because the mailbox login was rejected. Please try again in a few minutes or email info@marinamuseinternational.com."
    );
  }
  return null;
}

async function otpTransport() {
  const user = (process.env.SMTP_USER ?? PASSWORD_OTP_FROM).trim();
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s/g, "");
  if (!pass) {
    throw new Error(
      "SMTP_PASS is not set. Configure SMTP so codes can be sent from info@marinamuseinternational.com."
    );
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "mail.marinamuseinternational.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  });
}

async function sendCode(to: string, subject: string, intro: string, otp: string) {
  const transport = await otpTransport();
  try {
    const from = PASSWORD_OTP_FROM;
    await transport.sendMail({
      from: `Marina Muse International <${from}>`,
      replyTo: from,
      to,
      subject,
      text: `${intro}\n\n${otp}\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.`,
      html: `<p>${intro}</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 15 minutes.</p>`,
    });
  } catch (error) {
    throw mailLoginError(error) ?? error;
  }
}

export async function sendPasswordOtp(to: string, otp: string) {
  await sendCode(to, "Your password reset code", "Your Marina Muse password reset code is:", otp);
}

export async function sendSignupOtp(to: string, otp: string) {
  await sendCode(to, "Verify your Marina Muse account", "Your Marina Muse account verification code is:", otp);
}

/** OWNER_ALERT_EMAILS (comma-separated), else the admin list. */
export function ownerAlertEmails(): string[] {
  const fromEnv = (process.env.OWNER_ALERT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : adminEmailsList();
}

/** Plain-text mail to the owner (alerts, daily report). Throws when SMTP is not configured. */
export async function sendOwnerMail(subject: string, text: string) {
  const transport = await otpTransport();
  try {
    await transport.sendMail({
      from: `Marina AI <${PASSWORD_OTP_FROM}>`,
      to: ownerAlertEmails(),
      subject,
      text,
    });
  } catch (error) {
    throw mailLoginError(error) ?? error;
  }
}

/** Plain-text mail to one customer (consented follow-ups only). Throws when SMTP is not configured. */
export async function sendCustomerMail(to: string, subject: string, text: string) {
  const transport = await otpTransport();
  try {
    await transport.sendMail({
      from: `Marina Muse International <${PASSWORD_OTP_FROM}>`,
      replyTo: PASSWORD_OTP_FROM,
      to,
      subject,
      text,
    });
  } catch (error) {
    throw mailLoginError(error) ?? error;
  }
}

/** Logs in to SMTP without sending anything. */
export async function verifyOwnerMail(): Promise<{ ok: boolean; message: string }> {
  try {
    const transport = await otpTransport();
    await transport.verify();
    return { ok: true, message: `SMTP login works. Alerts go to ${ownerAlertEmails().join(", ")}.` };
  } catch (error) {
    const err = mailLoginError(error) ?? error;
    return { ok: false, message: err instanceof Error ? err.message : "SMTP login failed." };
  }
}
