import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { agentActivation } from "@/lib/ai/agents";
import { fingerprintFile, loadFingerprintFile } from "@/lib/whatsapp/fingerprints";
import { runIntegrationChecks } from "@/lib/ai/integrations";
import { STATUS_LABEL, type IntegrationStatus } from "@/lib/ai/integration-status";

// Phase 2 status in plain language. Live values come only from this server's own configuration;
// no provider is called, nothing is sent, and no secret value is shown.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Phase 2 status", robots: { index: false, follow: false } };

type Tone = "done" | "wait" | "blocked" | "off";
const TONE: Record<Tone, { badge: string; dot: string }> = {
  done: { badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  wait: { badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  blocked: { badge: "bg-red-100 text-red-800", dot: "bg-red-500" },
  off: { badge: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone].badge}`}><span className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} />{children}</span>;
}

function Row({ title, detail, tone, label }: { title: string; detail?: string; tone: Tone; label: string }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{title}</p>
        {detail ? <p className="mt-0.5 text-sm text-gray-600">{detail}</p> : null}
      </div>
      <Badge tone={tone}>{label}</Badge>
    </li>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      <ul className="mt-3">{children}</ul>
    </section>
  );
}

const GATES: { id: string; name: string; tone: Tone; label: string; detail: string }[] = [
  { id: "G1", name: "Local environment security", tone: "done", label: "Done", detail: "Test database isolated (13/13); old root password disabled." },
  { id: "G2", name: "Verification", tone: "done", label: "Done (local)", detail: "All checks re-run on 16 Nov on the current code." },
  { id: "G3", name: "Safety features & commerce fixes", tone: "done", label: "Done (local)", detail: "WhatsApp delivery safety, recovery, safety lock, agent switch, PayPal/order/email fixes." },
  { id: "G4", name: "Real provider tests", tone: "wait", label: "In progress", detail: "Gemini, Vapi and Meta (read-only) passed. Optional: one test WhatsApp message." },
  { id: "G4-B", name: "Temporary public test link", tone: "off", label: "Not started", detail: "Needs a host and a time window." },
  { id: "G5", name: "Production deployment", tone: "blocked", label: "Waiting", detail: "Needs server access, new production keys and a date." },
];

const TESTS: [string, string][] = [
  ["Code type-check", "0 errors"],
  ["Phase 2 checks", "274 / 274"],
  ["WhatsApp checks", "102 / 102"],
  ["WhatsApp safety (D/E/F)", "182 / 182"],
  ["Production build", "Pass"],
  ["Isolated test build", "Pass (fixed 16 Nov)"],
  ["Database isolation", "13 / 13"],
  ["Running app isolation", "8 / 8"],
  ["Website routes", "19 / 19"],
  ["Webhooks", "25 / 25"],
  ["Recovery & orders (live server)", "19 / 19"],
];

const PROVIDERS: { name: string; tone: Tone; label: string; detail: string }[] = [
  { name: "Gemini (AI model)", tone: "done", label: "Pass", detail: "Test key accepted; both models answer." },
  { name: "Vapi (voice)", tone: "done", label: "Pass", detail: "Assistant found with the right tools. No call placed. Webhook secret still to set at deployment." },
  { name: "Meta / WhatsApp", tone: "done", label: "Pass", detail: "Token, test number, business account and webhook subscription verified; 5 approved templates. One test message (hello_world) sent to the tester's number on 16 Nov. Follow-up template name still to choose." },
  { name: "Google Analytics & Search Console", tone: "done", label: "Working", detail: "Read-only data available on the main site." },
  { name: "Exotel (calls)", tone: "blocked", label: "Client action", detail: "Account is on Trial: complete KYC and ask Exotel to enable vSIP." },
  { name: "ShipGlobal", tone: "blocked", label: "Client action", detail: "Login rejected for the label API: ask ShipGlobal to enable it." },
];

const NEXT: string[] = [
  "Meta: choose which approved template to use for follow-ups; optional one test message to the tester's number.",
  "Ahmad: one-line written confirmation of the phone approval.",
  "Ahmad: server access, new production keys (after rotation) and a deployment date.",
  "Exotel KYC + vSIP; ShipGlobal label-API access; PayPal webhook ID.",
];

const GOOD: IntegrationStatus[] = ["operational", "connected", "authenticated"];
const liveTone = (st: IntegrationStatus): Tone => (GOOD.includes(st) ? "done" : st === "credentials_present" || st === "partial" ? "wait" : "blocked");

const AGENTS: { id: "chat" | "voice" | "growth" | "whatsapp"; name: string }[] = [
  { id: "chat", name: "Chat & Sales" },
  { id: "voice", name: "Voice & Call" },
  { id: "growth", name: "Growth & Revenue" },
  { id: "whatsapp", name: "WhatsApp" },
];

export default async function Phase2StatusPage({ searchParams }: { searchParams: Promise<{ live?: string }> }) {
  const session = await auth();
  if (!session?.user || !isDashboardRole(session.user.role)) redirect("/admin/login?callbackUrl=/test-ai");

  const env = process.env;
  const on = (name: string) => (env[name] || "").trim().toLowerCase() === "true";
  const lock = loadFingerprintFile(fingerprintFile());
  const lockCounts = lock.ok
    ? `${lock.config.ids.app_id.length + lock.config.ids.config_id.length + lock.config.ids.waba.length + lock.config.ids.phone_number_id.length} live IDs and ${lock.config.recipients.length} protected number(s) locked`
    : `Configuration problem: ${lock.reason}`;
  const done = GATES.filter((g) => g.tone === "done").length;
  // Provider calls only on explicit request (?live=1); a normal load makes no external call and writes nothing.
  const runLive = (await searchParams).live === "1";
  const live = runLive ? await runIntegrationChecks() : [];
  const percent = 65; // verified share of planned Phase 2 effort (G1–G3 done locally; G4–G5 remaining)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-gold-700">Marina Muse · Phase 2</p>
        <h1 className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">Project status</h1>
        <p className="mt-2 text-gray-600">A plain summary of where Phase 2 stands. Safety values below are read live from this server; nothing is sent or called.</p>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Overall progress</p>
          <p className="mt-1 text-3xl font-bold text-navy-900">~{percent}%</p>
          <div className="mt-3 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Stages complete</p>
          <p className="mt-1 text-3xl font-bold text-navy-900">{done} / {GATES.length}</p>
          <p className="mt-2 text-sm text-gray-500">Remaining: provider tests and deployment</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Automated tests</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">All passing</p>
          <p className="mt-2 text-sm text-gray-500">Last full run 16 Nov 2026</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Stages" subtitle="The six Phase 2 stages (G1 → G5)">
          {GATES.map((g) => <Row key={g.id} title={`${g.id} · ${g.name}`} detail={g.detail} tone={g.tone} label={g.label} />)}
        </Card>

        <Card title="Safety right now" subtitle="Live from this server's settings">
          {AGENTS.map((a) => {
            const s = agentActivation(a.id);
            return <Row key={a.id} title={`AI agent: ${a.name}`} detail={s.enabled ? "Switched on" : "Switched off (safe default)"} tone={s.enabled ? "wait" : "done"} label={s.enabled ? "ON" : "OFF"} />;
          })}
          <Row title="WhatsApp sending" detail="Messages can only leave when this is explicitly enabled." tone={on("WHATSAPP_OUTBOUND_ENABLED") ? "wait" : "done"} label={on("WHATSAPP_OUTBOUND_ENABLED") ? "ON" : "OFF"} />
          <Row title="Outbound phone calls" detail="Vapi calls need explicit enabling and customer consent." tone={on("VAPI_OUTBOUND_ENABLED") ? "wait" : "done"} label={on("VAPI_OUTBOUND_ENABLED") ? "ON" : "OFF"} />
          <Row title="WhatsApp safety lock" detail={lockCounts} tone={lock.ok ? "done" : "blocked"} label={lock.ok ? "Active" : "Problem"} />
          <Row title="Payment mode" detail={(env.PAYPAL_MODE || "sandbox") === "live" && env.NODE_ENV !== "production" ? "Live PayPal on a non-production server: test orders would charge real cards." : "No live-payment risk on this server."} tone={(env.PAYPAL_MODE || "sandbox") === "live" && env.NODE_ENV !== "production" ? "blocked" : "done"} label={(env.PAYPAL_MODE || "sandbox") === "live" ? "Live" : "Sandbox"} />
        </Card>

        <Card title="Live API check (right now)" subtitle={`Keys from this server's env, checked read-only only when opened with ?live=1 · ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`}>
          {!runLive ? <Row title="Not run" detail="This page makes no external API call by default. Open /test-ai?live=1 to run read-only provider checks (Gemini uses a few tokens)." tone="off" label="Off" /> : null}
          {live.map((r) => {
            const bad = r.steps.find((x) => x.result === "fail") || r.steps.find((x) => x.result === "warn");
            return <Row key={r.id} title={r.name} detail={`${bad ? `${bad.label}: ${bad.detail}` : `${r.steps.filter((x) => x.result === "pass").length} check(s) passed`} · ${r.ms} ms`} tone={liveTone(r.status)} label={GOOD.includes(r.status) ? "Pass" : STATUS_LABEL[r.status]} />;
          })}
        </Card>

        <Card title="Provider tests (G4)" subtitle="Real services, test credentials only, read-only">
          {PROVIDERS.map((p) => <Row key={p.name} title={p.name} detail={p.detail} tone={p.tone} label={p.label} />)}
        </Card>

        <Card title="Automated test results" subtitle="Local test environment, 16 Nov 2026">
          {TESTS.map(([name, result]) => <Row key={name} title={name} tone="done" label={result} />)}
        </Card>
      </div>

      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-amber-900">What is needed next</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-amber-900">
          {NEXT.map((n) => <li key={n}>{n}</li>)}
        </ol>
      </section>

      <p className="mt-6 text-xs text-gray-500">Detailed report: reports/phase2/PHASE2_FINAL_COMPLETION_REPORT.md · Technical integration checks: /test</p>
    </main>
  );
}
