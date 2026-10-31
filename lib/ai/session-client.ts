/**
 * One browser-tab session id shared by the attribution beacon, the chat widget and checkout,
 * so a journey can be followed from landing page → chat → lead → order.
 */
export const AI_SESSION_KEY = "marina-attr-session";

export function aiSessionId(): string {
  try {
    const existing = sessionStorage.getItem(AI_SESSION_KEY);
    if (existing) return existing;
    const created = `attr_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    sessionStorage.setItem(AI_SESSION_KEY, created);
    return created;
  } catch {
    return `attr_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  }
}
