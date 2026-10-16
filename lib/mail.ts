import nodemailer from "nodemailer";

import { PASSWORD_OTP_FROM } from "@/lib/password-otp-email";

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
