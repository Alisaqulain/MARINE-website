const DEFAULT_CONTACT = ["info@marinamuseinternational.com", "contact@marinamuseinternational.com"] as const;

/** Public contact inboxes (footer, contact page). Set CONTACT_EMAILS in .env — comma-separated. */
export function getContactEmails(): string[] {
  const raw = process.env.CONTACT_EMAILS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return [...DEFAULT_CONTACT];
}
