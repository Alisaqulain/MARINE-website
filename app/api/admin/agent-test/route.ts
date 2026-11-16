import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { agentActivation } from "@/lib/ai/agents";
import { dryRunReply } from "@/lib/ai/crm";
import { getAssistant } from "@/lib/ai/vapi";
import { externalGrowthData, growthNarrative } from "@/lib/ai/growth-agent";

/**
 * Admin-only dry run of each AI agent (/test-agents). Nothing reaches a customer: no WhatsApp message, no call,
 * no chat session, no lead. Gemini is called (a few tokens) and its usage is logged as usual.
 */
export const dynamic = "force-dynamic";

const AGENTS = ["chat", "whatsapp", "voice", "growth"] as const;
type Agent = (typeof AGENTS)[number];

export async function POST(req: Request) {
  const session = await auth();
  if (!isDashboardRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { agent?: string; message?: string };
  const agent = AGENTS.find((a) => a === body.agent) as Agent | undefined;
  if (!agent) return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
  const message = String(body.message || "").trim().slice(0, 500) || "Do you have a brass telescope? What is the price?";
  const switchState = agentActivation(agent).enabled ? "ON" : "OFF";
  const started = Date.now();

  try {
    if (agent === "chat" || agent === "whatsapp") {
      const r = await dryRunReply(agent, message);
      return NextResponse.json({
        ok: r.model === "gemini",
        switchState,
        ms: Date.now() - started,
        summary: r.model === "gemini" ? "AI reply generated (not sent to anyone)." : `AI did not answer; the safe catalogue reply was used instead.${r.error ? ` Reason: ${r.error}` : ""}${r.rejected?.length ? ` Rejected unverified numbers: ${r.rejected.join(", ")}` : ""}`,
        question: message,
        reply: r.text,
        products: r.products,
      });
    }
    if (agent === "voice") {
      const r = await getAssistant();
      const tools = (r.data?.model?.tools || []).map((t) => t.function?.name).filter(Boolean);
      return NextResponse.json({
        ok: r.ok,
        switchState,
        ms: Date.now() - started,
        summary: r.ok ? `Vapi assistant "${r.data?.name || "?"}" reachable, model ${r.data?.model?.model || "?"}. No call placed.` : `Vapi assistant not reachable: ${r.error || `HTTP ${r.status}`}`,
        reply: r.ok ? `Tools: ${tools.join(", ") || "none"}\nWebhook: ${r.data?.server?.url || r.data?.serverUrl || "not set"}` : "",
      });
    }
    const data = await externalGrowthData(7);
    const text = await growthNarrative(data as unknown as Record<string, unknown>);
    return NextResponse.json({
      ok: Boolean(text),
      switchState,
      ms: Date.now() - started,
      summary: text ? "Growth insights written from the last 7 days of Analytics and Search Console data (shown here only)." : "No insight produced: Gemini unavailable, no data, or the reply contained unverified numbers.",
      reply: text || "",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, switchState, ms: Date.now() - started, summary: `Test crashed: ${err instanceof Error ? err.message.slice(0, 200) : "unknown error"}` }, { status: 500 });
  }
}
