import { requireAdminSession } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/ai/crm";
import { originMatches, signupActorAllowed } from "@/lib/whatsapp/coexistence";
import { requestSync, subscribeApp, verifyOnboardedNumber } from "@/lib/whatsapp/coexistence-actions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS = ["verify_number", "subscribe_webhooks", "sync_contacts", "sync_history"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * Post-signup coexistence steps, one at a time, by the main admin only.
 * Steps that change something at Meta (subscribe, the two one-time syncs) need `confirm: true`,
 * which the admin screen sends only after showing exactly what will happen.
 */
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!signupActorAllowed(auth.session?.user?.role)) {
    return NextResponse.json({ error: "Only the main admin can run WhatsApp onboarding steps." }, { status: 403 });
  }
  if (!originMatches(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Request was refused." }, { status: 403 });
  }
  const actor = auth.session.user.email || "admin";
  if (!rateLimit(`wa-coexistence:${actor}`, 6, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { action?: string; confirm?: boolean } | null;
  const action = ACTIONS.find((a) => a === body?.action) as Action | undefined;
  if (!action) return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
  if (action !== "verify_number" && body?.confirm !== true) {
    return NextResponse.json({ error: "This step changes your Meta setup and needs explicit confirmation." }, { status: 400 });
  }
  const result =
    action === "verify_number"
      ? await verifyOnboardedNumber(actor)
      : action === "subscribe_webhooks"
        ? await subscribeApp(actor)
        : await requestSync(action === "sync_contacts" ? "contacts" : "history", actor);
  return NextResponse.json(result, { status: result.ok ? 200 : result.calledMeta ? 502 : 409 });
}
