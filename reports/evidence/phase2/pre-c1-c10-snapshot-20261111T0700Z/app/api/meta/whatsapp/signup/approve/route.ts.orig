import { requireAdminSession } from "@/lib/admin-auth";
import { uiApprovalDecision } from "@/lib/whatsapp/coexistence";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  const decision = uiApprovalDecision();
  return NextResponse.json({ ok: false, approved: decision.approved, error: decision.error }, { status: decision.status });
}
