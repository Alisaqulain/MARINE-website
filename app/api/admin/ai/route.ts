import { listAiAdmin } from "@/lib/ai/crm";
import { growthReport } from "@/lib/ai/growth";
import { requireAdminSession } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  try {
    const [board, report] = await Promise.all([listAiAdmin(), growthReport()]);
    return NextResponse.json({ ...board, report });
  } catch (err) {
    console.error("[ai-admin]", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "AI records are unavailable." }, { status: 503 });
  }
}
