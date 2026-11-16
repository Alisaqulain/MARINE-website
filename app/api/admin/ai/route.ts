import { listAiAdmin } from "@/lib/ai/crm";
import { growthReport, journeyInsights } from "@/lib/ai/growth";
import { ga4Configured } from "@/lib/google/analytics";
import { searchConsoleConfigured } from "@/lib/google/search-console";
import { requireAdminSession } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { messagesCollection } from "@/lib/whatsapp/store";
import { listRecoverable } from "@/lib/whatsapp/recovery";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [board, report, journey, whatsappRecovery] = await Promise.all([
      listAiAdmin(),
      growthReport(),
      journeyInsights(since, { searchConnected: searchConsoleConfigured(), analyticsConnected: ga4Configured() }).catch(() => null),
      // Phase 2 E: masked recipient, no message text.
      messagesCollection().then((col) => listRecoverable(col)).catch(() => null),
    ]);
    return NextResponse.json({ ...board, report, journey, whatsappRecovery });
  } catch (err) {
    console.error("[ai-admin]", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "AI records are unavailable." }, { status: 503 });
  }
}
