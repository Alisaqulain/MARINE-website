import nodemailer, { type Transporter } from "nodemailer";
import { PASSWORD_OTP_FROM } from "@/lib/password-otp-email";

export { PASSWORD_OTP_FROM };

let transporterPromise: Promise<Transporter> | null = null;

function requiredEnv(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback ?? "").trim();

  if (!value) {
    throw new Error(`Missing required SMTP configuration: ${name}`);
  }

  return value;
}

function validateEmail(value: string, variableName: string): string {
  const email = value.trim();

  // Basic format check; the mail provider still validates deliverability.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${variableName} must contain a valid email address.`);
  }

  return email;
}

function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const host = requiredEnv("SMTP_HOST", "mail.marinamuseinternational.com");
      const portText = requiredEnv("SMTP_PORT", "587");
      const port = Number(portText);
      const user = requiredEnv("SMTP_USER", PASSWORD_OTP_FROM);
      const pass = process.env.SMTP_PASS?.replace(/\s/g, "") ?? "";

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("SMTP_PORT must be a valid port number.");
      }

      if (!pass) {
        throw new Error("Missing required SMTP configuration: SMTP_PASS");
      }

      validateEmail(user, "SMTP_USER");
      validateEmail(PASSWORD_OTP_FROM, "PASSWORD_OTP_FROM");

      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });

      try {
        await transport.verify();
        return transport;
      } catch (error) {
        console.error("SMTP connection verification failed:", error);
        transport.close();
        throw new Error(
          "Email service is temporarily unavailable. Please try again later.",
        );
      }
    })().catch((error) => {
      // Allow a later request to retry after a configuration or connection failure.
      transporterPromise = null;
      throw error;
    });
  }

  return transporterPromise;
}

async function sendCode(
  to: string,
  subject: string,
  intro: string,
  otp: string,
) {
  const recipient = validateEmail(to, "Recipient email");

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("The verification code format is invalid.");
  }

  const transport = await getTransporter();
  const from = validateEmail(PASSWORD_OTP_FROM, "PASSWORD_OTP_FROM");

  try {
    await transport.sendMail({
      from: `Marina Muse International <${from}>`,
      replyTo: from,
      to: recipient,
      subject,
      text: `${intro}\n\n${otp}\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.`,
      html: `<p>${intro}</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 15 minutes. If you did not request this, ignore this email.</p>`,
    });
  } catch (error) {
    // Log diagnostic details server-side only; never log the OTP or SMTP password.
    console.error("Failed to send verification email:", error);

    const message = error instanceof Error ? error.message : "";

    if (
      /535|BadCredentials|Username and Password not accepted/i.test(message)
    ) {
      throw new Error(
        "Email service authentication failed. Please try again later.",
      );
    }

    throw new Error(
      "We could not send the email right now. Please try again later.",
    );
  }
}

export async function sendPasswordOtp(to: string, otp: string) {
  await sendCode(
    to,
    "Your password reset code",
    "Your Marina Muse password reset code is:",
    otp,
  );
}

export async function sendSignupOtp(to: string, otp: string) {
  await sendCode(
    to,
    "Verify your Marina Muse account",
    "Your Marina Muse account verification code is:",
    otp,
  );
}
