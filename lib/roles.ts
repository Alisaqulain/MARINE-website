import type { UserRole } from "@/lib/db/types";

export const adminEmailsList = () =>
  (process.env.ADMIN_EMAILS ?? "admin@marinamuseinternational.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const adminEmails = adminEmailsList;

export function resolveRole(email: string, requested?: UserRole): UserRole {
  if (adminEmails().includes(email.toLowerCase())) return "admin";
  if (requested === "staff") return "staff";
  if (requested === "wholesale") return "wholesale";
  return "customer";
}
