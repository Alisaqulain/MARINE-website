import { company } from "@/lib/company";

const DEFAULT_CONTACT = [
  "muaasiyainternational@gmail.com",
  "marinamuseinternational@gmail.com",
] as const;

/** Public contact inboxes (footer, contact page). Set CONTACT_EMAILS in .env — comma-separated. */
export function getContactEmails(): string[] {
  const raw = process.env.CONTACT_EMAILS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  if (company.email) {
    const primary = company.email.toLowerCase();
    const rest = DEFAULT_CONTACT.filter((e) => e !== primary);
    return [primary, ...rest];
  }
  return [...DEFAULT_CONTACT];
}
