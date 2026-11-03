import { aiSessionId } from "@/lib/ai/session-client";

/** Fire-and-forget journey event (add to cart, begin checkout) for the Growth agent's funnel. Never blocks the shopper. */
export function trackEvent(type: "add_to_cart" | "begin_checkout", data: { slug?: string; qty?: number; b2b?: boolean } = {}) {
  try {
    void fetch("/api/ai/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, sessionId: aiSessionId(), ...data }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking is optional */
  }
}
