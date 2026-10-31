import { createHash, timingSafeEqual } from "crypto";

/** Scheduler requests carry `Authorization: Bearer $CRON_SECRET`. */
export function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!secret || !header) return false;
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(secret).digest();
  return header.length === secret.length && timingSafeEqual(a, b);
}

/** Jobs the scheduler must call, and how stale a last run may be before /test flags it. */
export const SCHEDULED_JOBS = [
  { name: "daily_report", path: "/api/ai/report/daily", schedule: "daily 08:00", maxAgeHours: 26 },
  { name: "followups", path: "/api/ai/jobs", schedule: "every 15 minutes", maxAgeHours: 1 },
] as const;
