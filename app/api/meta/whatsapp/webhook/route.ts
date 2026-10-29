import { draftInbound } from "@/lib/whatsapp/inbound";
import {
  normaliseWebhook,
  planEvents,
  verifyHandshake,
  verifySignature,
  webhookSummary,
  type Seen,
} from "@/lib/whatsapp/coexistence";
import { markWebhookHandshake, recordWebhookKey } from "@/lib/whatsapp/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function seenStore(): Seen {
  const g = globalThis as typeof globalThis & { __marinaWaSeen?: Set<string> };
  if (!g.__marinaWaSeen) g.__marinaWaSeen = new Set();
  const seen = g.__marinaWaSeen;
  return {
    has: (key) => seen.has(key),
    add: (key) => {
      seen.add(key);
      if (seen.size > 5000) {
        const first = seen.values().next().value;
        if (first) seen.delete(first);
      }
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = verifyHandshake({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
    expected: process.env.META_WEBHOOK_VERIFY_TOKEN,
  });
  if (!result.ok) return new Response("Forbidden", { status: result.status });
  await markWebhookHandshake();
  return new Response(result.challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.META_WEBHOOK_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  const signature = verifySignature(raw, req.headers.get("x-hub-signature-256"), secret);
  if (!signature.ok) return NextResponse.json({ error: signature.error }, { status: signature.status });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Webhook body was not JSON." }, { status: 400 });
  }

  const plans = planEvents(normaliseWebhook(body), seenStore());
  let draftsWithheld = 0;
  for (const plan of plans) {
    const saved = await recordWebhookKey(plan.key, { field: plan.field, action: plan.action, reason: plan.reason });
    if (saved.duplicate || plan.action !== "draft") continue;
    const draft = await draftInbound(plan);
    if (draft.drafted) draftsWithheld += 1;
  }
  const summary = webhookSummary(plans);
  return NextResponse.json({ ...summary, draftsWithheld, sent: 0 });
}
