/** Shown on forgot-password page and used as SMTP from when configured. */
export const PASSWORD_OTP_FROM =
  process.env.SMTP_FROM?.trim() || "admin@marinamuseinternational.com";
