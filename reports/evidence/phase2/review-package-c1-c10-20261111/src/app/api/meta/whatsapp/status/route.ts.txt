import { requireAdminSession } from "@/lib/admin-auth";
import { publicStatus } from "@/lib/whatsapp/coexistence";
import { directStatus, isDirectMode } from "@/lib/whatsapp/mode";
import { readCoexistenceState } from "@/lib/whatsapp/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  const stored = await readCoexistenceState();
  // C8: direct mode reports masked IDs and set/missing flags only (only the webhook handshake time is read from the store).
  if (isDirectMode()) return NextResponse.json(directStatus(process.env, stored?.webhookHandshakeAt));
  return NextResponse.json({ integrationMode: "coexistence", ...publicStatus(process.env, stored) });
}
