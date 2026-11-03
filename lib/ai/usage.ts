import { getDb } from "@/lib/mongodb";
import { generate, type GeminiResult } from "@/lib/ai/gemini";
import type { AgentId } from "@/lib/ai/agents";

/**
 * Gemini usage and error monitoring shared by all four agents: every generation is logged
 * (agent, operation, ok, duration, sanitised error) in ai_usage and summarised on /test.
 */

export async function recordUsage(entry: { agent: AgentId; op: string; ok: boolean; ms: number; error?: string }) {
  try {
    const db = await getDb();
    await db.collection("ai_usage").insertOne({ ...entry, error: entry.error?.slice(0, 200), at: new Date().toISOString() });
  } catch {
    /* monitoring must never break a customer reply */
  }
}

/** `generate` plus usage logging. Use this from agent code instead of calling Gemini directly. */
export async function generateFor(agent: AgentId, op: string, input: Parameters<typeof generate>[0]): Promise<GeminiResult> {
  const started = Date.now();
  const result = await generate(input);
  void recordUsage({ agent, op, ok: result.ok, ms: Date.now() - started, error: result.ok ? undefined : result.error });
  return result;
}

export type UsageSummary = { agent: string; calls: number; errors: number; avgMs: number; lastError: string | null; lastErrorAt: string | null };

export async function usageSummary(hours = 24): Promise<UsageSummary[]> {
  const db = await getDb();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const rows = await db
    .collection("ai_usage")
    .aggregate<{ _id: string; calls: number; errors: number; avgMs: number }>([
      { $match: { at: { $gte: since } } },
      { $group: { _id: "$agent", calls: { $sum: 1 }, errors: { $sum: { $cond: ["$ok", 0, 1] } }, avgMs: { $avg: "$ms" } } },
    ])
    .toArray();
  const out: UsageSummary[] = [];
  for (const row of rows) {
    const last = await db.collection("ai_usage").findOne({ agent: row._id, ok: false, at: { $gte: since } }, { sort: { at: -1 } });
    out.push({ agent: row._id, calls: row.calls, errors: row.errors, avgMs: Math.round(row.avgMs || 0), lastError: last ? String(last.error || "error") : null, lastErrorAt: last ? String(last.at) : null });
  }
  return out;
}
