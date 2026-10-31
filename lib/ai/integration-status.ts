/**
 * How /test turns individual checks into one status per integration. Pure, covered by `npm run check:phase2`.
 *
 * - not_configured: none of the required variables are set
 * - partial:        some required variables missing, or credentials work but setup steps remain (warnings)
 * - failed:         a credential or live check failed
 * - connected:      every required variable set and every credential/live check passed
 */

export type IntegrationStatus = "connected" | "partial" | "failed" | "not_configured";

/** config = settings present · credential = provider accepted the credentials · live = a real API operation succeeded */
export type CheckKind = "config" | "credential" | "live";

export type CheckStep = { label: string; result: "pass" | "fail" | "warn" | "skip"; detail: string; kind: CheckKind };

export function rollupStatus(input: { requiredSet: number; requiredTotal: number; steps: CheckStep[] }): IntegrationStatus {
  if (input.requiredSet === 0) return "not_configured";
  const hardFail = input.steps.some((s) => s.result === "fail" && s.kind !== "config");
  if (hardFail) return "failed";
  if (input.requiredSet < input.requiredTotal) return "partial";
  const verified = input.steps.some((s) => s.result === "pass" && s.kind !== "config");
  if (!verified) return "partial";
  if (input.steps.some((s) => s.result === "fail" || s.result === "warn")) return "partial";
  return "connected";
}

export function summarise(statuses: IntegrationStatus[]) {
  return {
    total: statuses.length,
    connected: statuses.filter((s) => s === "connected").length,
    partial: statuses.filter((s) => s === "partial").length,
    failed: statuses.filter((s) => s === "failed").length,
    notConfigured: statuses.filter((s) => s === "not_configured").length,
  };
}

/** Env names with set/missing only. Values are never returned. */
export function envPresence(names: string[], source: Record<string, string | undefined> = process.env) {
  return names.map((name) => ({ name, set: Boolean(source[name]?.trim()) }));
}
