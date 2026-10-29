import { handleCustomerMessage } from "@/lib/ai/crm";
import type { WaPlan } from "@/lib/whatsapp/coexistence";

export async function draftInbound(plan: WaPlan) {
  if (plan.action !== "draft" || !plan.text || !plan.messageId) return { sent: false as const, drafted: false as const };
  const sessionId = `wa${plan.messageId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-30)}`.padEnd(8, "0").slice(0, 80);
  try {
    await handleCustomerMessage({ sessionId, message: plan.text, region: "other" });
  } catch (err) {
    console.error("[whatsapp] draft failed", err instanceof Error ? err.message : "failed");
  }
  return { sent: false as const, drafted: true as const };
}
