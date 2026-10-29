import { decideApproval } from "@/lib/ai/crm";
import { requireAdminSession } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { error, session } = await requireAdminSession("addProduct");
  if (error) return error;
  const body = await req.json().catch(() => null);
  const status = body?.status === "approved" || body?.status === "rejected" ? body.status : null;
  const id = String(body?.id || "");
  const reason = String(body?.reason || "").trim();
  if (!status || !id || !reason) {
    return NextResponse.json({ error: "Choose approve or reject and include a reason." }, { status: 400 });
  }
  const result = await decideApproval({
    id,
    status,
    reason,
    actor: session?.user?.email || "admin",
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
