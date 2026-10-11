const PUBLIC_CONTACT = "info@marinamuseinternational.com";

/** Single public inbox for footer, contact page, and secure payment. */
export function getPublicContactEmail(): string {
  const raw = process.env.CONTACT_EMAILS?.trim();
  if (raw) {
    const first = raw.split(",")[0]?.trim().toLowerCase();
    if (first) return first;
  }
  return PUBLIC_CONTACT;
}

/** @deprecated Use getPublicContactEmail — kept for callers expecting an array. */
export function getContactEmails(): string[] {
  return [getPublicContactEmail()];
}
