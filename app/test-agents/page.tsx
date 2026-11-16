import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import AgentTester from "./AgentTester";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agent tests", robots: { index: false, follow: false } };

export default async function TestAgentsPage() {
  const session = await auth();
  if (!session?.user || !isDashboardRole(session.user.role)) redirect("/admin/login?callbackUrl=/test-agents");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-gold-700">Marina Muse · Phase 2</p>
      <h1 className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">Test the AI agents</h1>
      <p className="mt-2 text-gray-600">
        Each button runs one agent the same way it would for a customer, but the result is shown only here. No WhatsApp
        message is sent, no call is placed, and nothing is saved as a chat or lead. It works even while the agents are
        switched OFF for customers. Each test uses a few Gemini tokens.
      </p>
      <div className="mt-6">
        <AgentTester />
      </div>
    </main>
  );
}
