import nodemailer from "nodemailer";

import { PASSWORD_OTP_FROM } from "@/lib/password-otp-email";

export { PASSWORD_OTP_FROM };

export async function sendPasswordOtp(to: string, otp: string) {
  const user = process.env.SMTP_USER ?? process.env.OTP_EMAIL_FROM ?? PASSWORD_OTP_FROM;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? PASSWORD_OTP_FROM;

  if (!pass) {
    throw new Error(
      "SMTP_PASS is not set. Configure SMTP for admin@marinamuseinternational.com (or set SMTP_USER / SMTP_PASS in .env)."
    );
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user, pass },
  });

  await transport.sendMail({
    from: `Marina Muse International <${from}>`,
    to,
    subject: "Your password reset code",
    text: `Your Marina Muse password reset code is: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.`,
    html: `<p>Your password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 15 minutes.</p>`,
  });
}
