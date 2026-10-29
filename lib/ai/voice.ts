import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/mongodb";
import { scoreLead, signalsFromText } from "@/lib/ai/scoring";
import { voiceStatus } from "@/lib/ai/crm";

export type VoiceEvent = {
  id: string;
  type: "inbound" | "outbound" | "completed" | "missed" | "opt_out";
  from?: string;
  to?: string;
  transcript?: string;
  consent?: boolean;
};

function signatureOk(raw: string, header: string | null) {
  const secret = process.env.VOICE_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function acceptVoiceEvent(raw: string, signature: string | null) {
  const status = voiceStatus();
  if (!status.configured) {
    return { ok: false as const, status: 503, message: status.message };
  }
  if (!signatureOk(raw, signature)) {
    return { ok: false as const, status: 401, message: "Voice webhook signature was rejected." };
  }
  let event: VoiceEvent;
  try {
    event = JSON.parse(raw) as VoiceEvent;
  } catch {
    return { ok: false as const, status: 400, message: "Voice webhook body was not JSON." };
  }
  if (!event.id || !event.type) {
    return { ok: false as const, status: 400, message: "Voice event needs an id and type." };
  }
  if (event.type === "outbound" && event.consent !== true) {
    return { ok: false as const, status: 403, message: "Outbound calls require recorded consent." };
  }
  const db = await getDb();
  const existing = await db.collection("ai_calls").findOne({ id: event.id });
  if (existing) return { ok: true as const, status: 200, duplicate: true, message: "Event already stored." };
  if (event.type === "opt_out" && event.from) {
    await db.collection("ai_suppression").updateOne(
      { phone: event.from },
      { $set: { phone: event.from, at: new Date().toISOString() } },
      { upsert: true }
    );
  }
  const scored = scoreLead(signalsFromText(event.transcript || "", 1, 0));
  await db.collection("ai_calls").insertOne({
    id: event.id,
    type: event.type,
    from: event.from || "",
    to: event.to || "",
    transcript: (event.transcript || "").slice(0, 8000),
    score: scored.score,
    stage: scored.stage,
    createdAt: new Date().toISOString(),
  });
  return { ok: true as const, status: 200, duplicate: false, message: "Call event stored. No live call was placed by this request." };
}
