/**
 * C5: processing of a verified (and, in direct mode, ID-filtered) WhatsApp webhook body.
 *
 * Order per delivery:
 *  1. Parse events; drop duplicates inside the same delivery.
 *  2. Claim every new event in the database (`claimEvent`); "done" events are duplicates (200), events another
 *     request is still processing are "in progress" (answer 500 so Meta redelivers later).
 *  3. Do all database work for the claimed events (inbound record + AI draft/reply, Coexistence updates, statuses).
 *  4. Only then mark each claimed event "done". The in-memory cache learns a key only after it is "done" in the
 *     database, so it is an optimisation, never the source of truth.
 *  5. Any error in 2–4 → claimed-but-unfinished events are marked "failed" (best-effort) and the answer is HTTP 500
 *     with a fixed message (no error text, stack or identifiers), so Meta redelivers.
 *
 * Pure: database and AI work are injected (`WebhookDeps`), so the offline checks can simulate failures.
 */
import { coexistenceUpdates, normaliseWebhook, planEvents, type CoexistenceUpdates, type WaPlan } from "./coexistence.ts";
import { statusUpdatesFromWebhook, type WaStatusUpdate } from "./cloud.ts";
import type { Claim } from "./event-claims.ts";

export type WebhookDeps = {
  claim(key: string, meta: { field: string; action: string; reason: string }): Promise<Claim>;
  complete(key: string, token: string): Promise<{ completed: boolean }>;
  fail(key: string, token: string, label: string): Promise<boolean>;
  draft(plan: WaPlan): Promise<{ sent: boolean; drafted: boolean }>;
  applyCoexistence?(updates: CoexistenceUpdates, newKeys: Set<string>): Promise<{ historyMessages: number; contacts: number; echoes: number }>;
  applyStatuses(updates: WaStatusUpdate[]): Promise<number>;
  doneCache: { has(key: string): boolean; add(key: string): void };
};

export const WEBHOOK_FAILED_MESSAGE = "Webhook processing failed; it will be retried.";
export const WEBHOOK_IN_PROGRESS_MESSAGE = "An event in this delivery is still being processed; it will be retried.";

export type WebhookOutcome = {
  status: 200 | 500;
  json: Record<string, unknown>;
  /** For logs/tests only; never put into the HTTP body. */
  claimed: string[];
  completed: string[];
  failed: string[];
};

export async function processWebhookBody(body: unknown, deps: WebhookDeps, options: { direct: boolean }): Promise<WebhookOutcome> {
  const local = new Set<string>();
  const plans = planEvents(normaliseWebhook(body), { has: (k) => local.has(k), add: (k) => void local.add(k) });
  const claimed: { plan: WaPlan; token: string }[] = [];
  const completed: string[] = [];
  const failed: string[] = [];
  let duplicates = 0;
  let inProgress = 0;
  let draftsWithheld = 0;
  let sent = 0;
  let statuses = 0;
  let coexistence = { historyMessages: 0, contacts: 0, echoes: 0 };

  try {
    for (const plan of plans) {
      if (plan.reason === "duplicate" || deps.doneCache.has(plan.key)) {
        duplicates += 1;
        continue;
      }
      const claim = await deps.claim(plan.key, { field: plan.field, action: plan.action, reason: plan.reason });
      if (claim.state === "duplicate") {
        duplicates += 1;
        deps.doneCache.add(plan.key);
      } else if (claim.state === "in_progress") {
        inProgress += 1;
      } else {
        claimed.push({ plan, token: claim.token });
      }
    }
    for (const { plan } of claimed) {
      if (plan.action !== "draft") continue;
      const result = await deps.draft(plan);
      if (result.sent) sent += 1;
      else if (result.drafted) draftsWithheld += 1;
    }
    if (!options.direct && deps.applyCoexistence) {
      coexistence = await deps.applyCoexistence(coexistenceUpdates(body), new Set(claimed.map((c) => c.plan.key)));
    }
    statuses = await deps.applyStatuses(statusUpdatesFromWebhook(body));
    for (const { plan, token } of claimed) {
      await deps.complete(plan.key, token);
      completed.push(plan.key);
      deps.doneCache.add(plan.key);
    }
  } catch {
    for (const { plan, token } of claimed) {
      if (completed.includes(plan.key)) continue;
      await deps.fail(plan.key, token, "processing_failed").catch(() => false);
      failed.push(plan.key);
    }
    return { status: 500, json: { ok: false, error: WEBHOOK_FAILED_MESSAGE }, claimed: claimed.map((c) => c.plan.key), completed, failed };
  }

  const summary = { received: plans.length, processed: completed.length, duplicates, inProgress, draftsWithheld, sent, statuses, coexistence };
  if (inProgress > 0) {
    return { status: 500, json: { ok: false, error: WEBHOOK_IN_PROGRESS_MESSAGE, ...summary }, claimed: claimed.map((c) => c.plan.key), completed, failed };
  }
  return { status: 200, json: { ok: true, ...summary }, claimed: claimed.map((c) => c.plan.key), completed, failed };
}
