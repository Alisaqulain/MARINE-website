import { requireAdminSession } from "@/lib/admin-auth";
import { uiApprovalDecision } from "@/lib/whatsapp/coexistence";
import { directModeRouteBlock } from "@/lib/whatsapp/mode";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  // C7: closed in direct Cloud API mode.
  const closed = directModeRouteBlock();
  if (closed) return NextResponse.json(closed.body, { status: closed.status });
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  const decision = uiApprovalDecision();
  return NextResponse.json({ ok: false, approved: decision.approved, error: decision.error }, { status: decision.status });
}
