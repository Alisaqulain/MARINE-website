import { applyCoexistenceUpdates, applyStatusUpdates, draftInbound } from "@/lib/whatsapp/inbound";
import { verifyHandshake, verifySignature } from "@/lib/whatsapp/coexistence";
import { MAX_WEBHOOK_BYTES, filterDirectWebhook, isDirectMode } from "@/lib/whatsapp/mode";
import { processWebhookBody } from "@/lib/whatsapp/webhook-process";
import { claimWebhookEvent, completeWebhookEvent, failWebhookEvent, markWebhookHandshake } from "@/lib/whatsapp/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Keys the DATABASE has marked "done" (C5). Only an optimisation: the database claim is the source of truth. */
function doneCache() {
  const g = globalThis as typeof globalThis & { __marinaWaDone?: Set<string> };
  if (!g.__marinaWaDone) g.__marinaWaDone = new Set();
  const done = g.__marinaWaDone;
  return {
    has: (key: string) => done.has(key),
    add: (key: string) => {
      done.add(key);
      if (done.size > 5000) {
        const first = done.values().next().value;
        if (first) done.delete(first);
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
  // C4: size limit before any signature work.
  if (Number(req.headers.get("content-length") || 0) > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });
  }
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });

  // Signature over the exact received bytes (C4). Nothing below runs for an unsigned or altered body.
  const secret = process.env.META_WEBHOOK_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  const signature = verifySignature(raw, req.headers.get("x-hub-signature-256"), secret);
  if (!signature.ok) return NextResponse.json({ error: signature.error }, { status: signature.status });

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Webhook body was not JSON." }, { status: 400 });
  }

  // C4: direct mode — only `messages` changes for the configured WABA and phone-number ID go further.
  const direct = isDirectMode();
  let ignored = { ignoredForeign: 0, ignoredOther: 0 };
  if (direct) {
    const filtered = filterDirectWebhook(body);
    if (!filtered.ok) return NextResponse.json({ error: filtered.error }, { status: filtered.status });
    body = filtered.body;
    ignored = { ignoredForeign: filtered.ignoredForeign, ignoredOther: filtered.ignoredOther };
  }

  // C5: database-backed claims; HTTP 500 (Meta redelivers) whenever database processing does not complete.
  const outcome = await processWebhookBody(
    body,
    {
      claim: claimWebhookEvent,
      complete: completeWebhookEvent,
      fail: failWebhookEvent,
      draft: draftInbound,
      applyCoexistence: applyCoexistenceUpdates,
      applyStatuses: applyStatusUpdates,
      doneCache: doneCache(),
    },
    { direct }
  );
  if (outcome.status !== 200) console.error("[whatsapp] webhook not completed", outcome.failed.length ? "failed" : "in_progress");
  return NextResponse.json(outcome.status === 200 ? { ...outcome.json, ...ignored } : outcome.json, { status: outcome.status });
}
