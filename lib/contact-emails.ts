const PUBLIC_CONTACT = "info@marinamuseinternational.com";

/** Single public inbox for footer, contact page, and secure payment. */
export function getPublicContactEmail(): string {
  return PUBLIC_CONTACT;
}

/** @deprecated Use getPublicContactEmail — kept for callers expecting an array. */
export function getContactEmails(): string[] {
  return [getPublicContactEmail()];
}
