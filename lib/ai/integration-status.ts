/**
 * How /test turns individual checks into one status per integration. Pure, covered by `npm run check:phase2`.
 *
 * - not_configured: none of the required variables are set
 * - partial:        some required variables missing, or credentials work but setup steps remain (warnings)
 * - auth_failed:    the provider rejected the credentials
 * - api_error:      credentials accepted, but a real API operation failed (or the provider could not be reached)
 * - connected:      every required variable set and every credential/live check passed
 * - operational:    connected AND real production activity has been seen (a call, a delivered message, data read…)
 */

export type IntegrationStatus = "operational" | "connected" | "partial" | "auth_failed" | "api_error" | "not_configured";

/** config = settings present · credential = provider accepted the credentials · live = a real API operation succeeded */
export type CheckKind = "config" | "credential" | "live";

export type CheckStep = { label: string; result: "pass" | "fail" | "warn" | "skip"; detail: string; kind: CheckKind };

export function rollupStatus(input: { requiredSet: number; requiredTotal: number; steps: CheckStep[]; activity?: boolean }): IntegrationStatus {
  if (input.requiredSet === 0) return "not_configured";
  if (input.steps.some((s) => s.result === "fail" && s.kind === "credential")) return "auth_failed";
  if (input.steps.some((s) => s.result === "fail" && s.kind === "live")) return "api_error";
  if (input.requiredSet < input.requiredTotal) return "partial";
  const verified = input.steps.some((s) => s.result === "pass" && s.kind !== "config");
  if (!verified) return "partial";
  if (input.steps.some((s) => s.result === "fail" || s.result === "warn")) return "partial";
  return input.activity ? "operational" : "connected";
}

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  operational: "Operational",
  connected: "Connected",
  partial: "Partially configured",
  auth_failed: "Authentication failed",
  api_error: "API error",
  not_configured: "Not configured",
};

export const isUp = (s: IntegrationStatus) => s === "operational" || s === "connected";
export const isFailing = (s: IntegrationStatus) => s === "auth_failed" || s === "api_error";

export function summarise(statuses: IntegrationStatus[]) {
  return {
    total: statuses.length,
    operational: statuses.filter((s) => s === "operational").length,
    connected: statuses.filter((s) => s === "connected").length,
    partial: statuses.filter((s) => s === "partial").length,
    failed: statuses.filter(isFailing).length,
    notConfigured: statuses.filter((s) => s === "not_configured").length,
  };
}

/** Env names with set/missing only. Values are never returned. */
export function envPresence(names: string[], source: Record<string, string | undefined> = process.env) {
  return names.map((name) => ({ name, set: Boolean(source[name]?.trim()) }));
}

export type AgentStatus = "operational" | "degraded" | "not_operational" | "disabled";
export type AgentCheck = { label: string; ok: boolean; level: "critical" | "required" | "info"; detail: string };

/**
 * An agent is Operational only if every critical and required dependency is OK.
 * Missing required dependencies (e.g. Gemini with a catalogue fallback) → Degraded; a missing critical one → Not operational.
 */
export function agentStatus(enabled: boolean, checks: AgentCheck[]): AgentStatus {
  if (!enabled) return "disabled";
  if (checks.some((c) => c.level === "critical" && !c.ok)) return "not_operational";
  if (checks.some((c) => c.level === "required" && !c.ok)) return "degraded";
  return "operational";
}

/** Share of an agent's critical + required checks that pass (0–100). */
export function agentScore(checks: AgentCheck[]) {
  const counted = checks.filter((c) => c.level !== "info");
  return counted.length ? Math.round((counted.filter((c) => c.ok).length / counted.length) * 100) : 0;
}
