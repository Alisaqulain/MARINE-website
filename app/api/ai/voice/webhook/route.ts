import { acceptVoiceEvent } from "@/lib/ai/voice";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const raw = await req.text();
  const result = await acceptVoiceEvent(raw, req.headers.get("x-marina-voice-signature"));
  return NextResponse.json({ ok: result.ok, message: result.message, duplicate: "duplicate" in result ? result.duplicate : false }, { status: result.status });
}
