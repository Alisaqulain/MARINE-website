/**
 * How /test turns individual checks into one status per integration. Pure, covered by `npm run check:phase2`.
 *
 * - not_configured:      none of the required variables are set
 * - partial:             configuration incomplete — required variables missing, or setup steps remain (warnings)
 * - credentials_present: everything set, but nothing could be verified with the provider yet
 * - authenticated:       the provider accepted the credentials; no safe API operation has succeeded yet
 * - connected:           a safe real API operation succeeded
 * - operational:         connected AND real production activity has been seen (a call, a delivered message, data read…)
 * - placeholder_credentials: a credential or id is sample text (e.g. YOUR_API_KEY), never sent to the provider
 * - client_action_required:  something only the account owner can create or supply
 * - config_error:        our settings or request are wrong (bad id format, unknown model, wrong value) — fixable here
 * - auth_failed:         the provider rejected the credentials
 * - activation_required: the provider account lacks a feature the client or provider must enable
 * - quota_restricted:    a usage quota or rate limit (HTTP 429)
 * - provider_restricted: another provider-side API restriction (e.g. 403 permission)
 * - temporary_failure:   timeout, network error or provider overload — retry later
 */
import type { FailureClass } from "./http.ts";

export type { FailureClass } from "./http.ts";

export type IntegrationStatus =
  | "operational"
  | "connected"
  | "authenticated"
  | "credentials_present"
  | "partial"
  | "placeholder_credentials"
  | "client_action_required"
  | "config_error"
  | "auth_failed"
  | "activation_required"
  | "quota_restricted"
  | "provider_restricted"
  | "temporary_failure"
  | "not_configured";

/** config = settings present · credential = provider accepted the credentials · live = a real API operation succeeded */
export type CheckKind = "config" | "credential" | "live";

export type CheckStep = {
  label: string;
  result: "pass" | "fail" | "warn" | "skip";
  detail: string;
  kind: CheckKind;
  /** HTTP status the provider returned for this step (0 = no response). */
  http?: number;
  /** Why it failed. Unset on a failing step → derived from `http` and `kind`. */
  failure?: FailureClass;
  /** What to do next, when it is more specific than the detail. */
  action?: string;
  /** Override: whether the client (account owner) has to act. Defaults from the failure class. */
  clientAction?: boolean;
};

/** Failure class of a failing (or warning) step. */
export function stepFailure(step: CheckStep): FailureClass {
  if (step.failure) return step.failure;
  if (step.http != null) {
    if (step.http === 0) return "temporary";
    if (step.http === 401) return "auth";
    if (step.http === 429) return "quota";
    if (step.http === 403) return "restriction";
    if (step.http === 408 || step.http >= 500) return "temporary";
    return "config";
  }
  return step.kind === "credential" ? "auth" : "config";
}

/** Internal = fixable in our code/configuration; external = the client's account or the provider. */
export function failureOwner(failure: FailureClass): "internal" | "external" {
  return failure === "config" ? "internal" : "external";
}

export function needsClient(step: CheckStep) {
  if (step.clientAction != null) return step.clientAction;
  const f = stepFailure(step);
  return f === "placeholder" || f === "client" || f === "auth" || f === "activation" || f === "quota" || f === "restriction";
}

export const FAILURE_LABEL: Record<FailureClass, string> = {
  config: "Internal code/configuration error",
  placeholder: "Placeholder credential",
  client: "Client-side action required",
  auth: "Credentials rejected",
  activation: "External account activation required",
  quota: "Provider-side quota restriction",
  restriction: "Provider-side API restriction",
  temporary: "Timeout or temporary provider failure",
};

const FAILURE_STATUS: Record<FailureClass, IntegrationStatus> = {
  auth: "auth_failed",
  config: "config_error",
  placeholder: "placeholder_credentials",
  client: "client_action_required",
  activation: "activation_required",
  quota: "quota_restricted",
  restriction: "provider_restricted",
  temporary: "temporary_failure",
};
/** When several steps fail, the one the owner must fix first wins. */
const FAILURE_ORDER: FailureClass[] = ["auth", "config", "placeholder", "client", "activation", "quota", "restriction", "temporary"];

export function rollupStatus(input: { requiredSet: number; requiredTotal: number; steps: CheckStep[]; activity?: boolean }): IntegrationStatus {
  if (input.requiredSet === 0) return "not_configured";
  const failing = input.steps.filter((s) => s.result === "fail").map(stepFailure);
  for (const f of FAILURE_ORDER) if (failing.includes(f)) return FAILURE_STATUS[f];
  if (input.requiredSet < input.requiredTotal) return "partial";
  const live = input.steps.some((s) => s.result === "pass" && s.kind === "live");
  const auth = input.steps.some((s) => s.result === "pass" && s.kind === "credential");
  if (!live && !auth) return "credentials_present";
  // A warning marked temporary or quota (e.g. the primary model is out of quota but the fallback answered) does not block "connected".
  if (input.steps.some((s) => s.result === "warn" && stepFailure(s) !== "temporary" && stepFailure(s) !== "quota")) return "partial";
  if (!live) return "authenticated";
  return input.activity ? "operational" : "connected";
}

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  operational: "Production activity verified",
  connected: "API operation successful",
  authenticated: "Authentication verified",
  credentials_present: "Credentials present",
  partial: "Configuration incomplete",
  placeholder_credentials: "Placeholder credentials",
  client_action_required: "Client-side action required",
  config_error: "Internal code/configuration error",
  auth_failed: "Authentication failed",
  activation_required: "External activation required",
  quota_restricted: "Provider quota restriction",
  provider_restricted: "Provider API restriction",
  temporary_failure: "Timeout / temporary failure",
  not_configured: "Not configured",
};

export const isUp = (s: IntegrationStatus) => s === "operational" || s === "connected";
export const isFailing = (s: IntegrationStatus) =>
  s === "auth_failed" ||
  s === "config_error" ||
  s === "placeholder_credentials" ||
  s === "client_action_required" ||
  s === "activation_required" ||
  s === "quota_restricted" ||
  s === "provider_restricted" ||
  s === "temporary_failure";

export function summarise(statuses: IntegrationStatus[]) {
  return {
    total: statuses.length,
    operational: statuses.filter((s) => s === "operational").length,
    connected: statuses.filter((s) => s === "connected").length,
    partial: statuses.filter((s) => s === "partial" || s === "credentials_present" || s === "authenticated").length,
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
