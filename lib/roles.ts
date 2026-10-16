import type { UserRole } from "@/lib/db/types";

/** Always an admin, even if the production server still has an older ADMIN_EMAILS value. */
const CANONICAL_ADMIN = "admin@marinamuseinternational.com";

export const adminEmailsList = () => {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([CANONICAL_ADMIN, ...fromEnv])];
};

const adminEmails = adminEmailsList;

export function resolveRole(email: string, requested?: UserRole): UserRole {
  if (adminEmails().includes(email.toLowerCase())) return "admin";
  if (requested === "staff") return "staff";
  if (requested === "wholesale") return "wholesale";
  return "customer";
}
