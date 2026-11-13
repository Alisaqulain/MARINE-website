import { requireAdminSession } from "@/lib/admin-auth";
import { publicStatus } from "@/lib/whatsapp/coexistence";
import { readCoexistenceState } from "@/lib/whatsapp/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  const stored = await readCoexistenceState();
  return NextResponse.json(publicStatus(process.env, stored));
}
