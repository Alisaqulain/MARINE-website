import { acceptExotelCallback, acceptVapiMessage, acceptVoiceEvent } from "@/lib/ai/voice";
import { rateLimit } from "@/lib/ai/crm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One voice webhook for Agent 2:
 * - Vapi server messages (tool calls, status updates, end-of-call reports), authorised by VAPI_WEBHOOK_SECRET
 * - Exotel StatusCallback (`?provider=exotel&token=EXOTEL_WEBHOOK_TOKEN`), form-encoded
 * - the generic HMAC format (`x-marina-voice-signature`) for any other provider
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(`voice:${ip}`, 300)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const url = new URL(req.url);
  const raw = await req.text();
  try {
    if (url.searchParams.get("provider") === "exotel") {
      const params = new URLSearchParams(raw);
      url.searchParams.forEach((value, key) => {
        if (key !== "token" && key !== "provider" && !params.has(key)) params.set(key, value);
      });
      const result = await acceptExotelCallback(params, url.searchParams.get("token"));
      return NextResponse.json(result.body, { status: result.status });
    }
    if (req.headers.get("x-marina-voice-signature")) {
      const result = await acceptVoiceEvent(raw, req.headers.get("x-marina-voice-signature"));
      return NextResponse.json(
        { ok: result.ok, message: result.message, duplicate: "duplicate" in result ? result.duplicate : false },
        { status: result.status }
      );
    }
    const result = await acceptVapiMessage(raw, req.headers);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("[voice-webhook]", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Voice event could not be processed." }, { status: 503 });
  }
}

/** Exotel can be set to call the status callback with GET. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("provider") !== "exotel") return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
  const result = await acceptExotelCallback(url.searchParams, url.searchParams.get("token")).catch(() => ({ status: 503, body: { error: "Failed" } }));
  return NextResponse.json(result.body, { status: result.status });
}
