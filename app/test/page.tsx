import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { pingDatabase } from "@/lib/mongodb";
import { pingPayPal } from "@/lib/paypal";
import { pingShipGlobal } from "@/lib/shipglobal";
import { runIntegrationChecks } from "@/lib/ai/integrations";
import { runPhase2SelfTest } from "@/lib/ai/selftest";
import type { CheckStep, IntegrationStatus } from "@/lib/ai/integration-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integration checks", robots: { index: false, follow: false } };

const STATUS: Record<IntegrationStatus, { label: string; card: string; badge: string }> = {
  connected: { label: "Connected", card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-600 text-white" },
  partial: { label: "Partially configured", card: "border-amber-200 bg-amber-50", badge: "bg-amber-500 text-white" },
  failed: { label: "Failed", card: "border-red-200 bg-red-50", badge: "bg-red-600 text-white" },
  not_configured: { label: "Not configured", card: "border-gray-200 bg-gray-50", badge: "bg-gray-500 text-white" },
};

const RESULT: Record<CheckStep["result"], { icon: string; className: string }> = {
  pass: { icon: "✓", className: "text-emerald-800" },
  fail: { icon: "✗", className: "text-red-700" },
  warn: { icon: "!", className: "text-amber-800" },
  skip: { icon: "–", className: "text-gray-600" },
};

const KIND: Record<CheckStep["kind"], string> = { config: "settings", credential: "credentials", live: "live API" };

function Card({ ok, title, message, meta }: { ok: boolean; title: string; message: string; meta?: string }) {
  return (
    <section className={`rounded-2xl border px-5 py-4 ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>{ok ? "Connected" : "Not connected"}</span>
      </div>
      {meta ? <p className="mt-1 text-xs opacity-80">{meta}</p> : null}
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message}</p>
    </section>
  );
}

/**
 * Integration checker. Production: admin/staff sign-in required. It never shows secrets, never sends a customer
 * message and never places a call — credential checks and live activity are reported separately.
 */
export default async function TestPage() {
  if (process.env.NODE_ENV === "production") {
    const session = await auth();
    if (!session?.user || !isDashboardRole(session.user.role)) redirect("/admin/login?callbackUrl=/test");
  }

  const [db, paypal, shipping, checks] = await Promise.all([pingDatabase(), pingPayPal(), pingShipGlobal(), runIntegrationChecks()]);
  const selfTest = runPhase2SelfTest();
  const selfTestFailed = selfTest.filter((r) => !r.pass).length;
  const { summary } = checks;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-5">
      <h1 className="font-serif text-3xl text-navy-900">Integration checks</h1>
      <p className="mt-3 text-sm text-navy-600">
        Live, read-only checks of every service the four Marina AI agents use. Secrets and customer data are never shown. No WhatsApp message is sent and no
        phone call is placed — &ldquo;credentials&rdquo; and &ldquo;live API&rdquo; steps are labelled separately from real calls/messages.
      </p>
      <p className="mt-1 text-xs text-navy-500">
        Checked {checks.checkedAt.slice(0, 19).replace("T", " ")} UTC in {checks.ms} ms · NODE_ENV {process.env.NODE_ENV}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Connected", summary.connected, "bg-emerald-50 text-emerald-900"],
          ["Partial", summary.partial, "bg-amber-50 text-amber-900"],
          ["Failed", summary.failed, "bg-red-50 text-red-900"],
          ["Not configured", summary.notConfigured, "bg-gray-100 text-gray-800"],
        ].map(([label, value, className]) => (
          <div key={String(label)} className={`rounded-2xl px-4 py-3 ${className}`}>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-navy-700">
        {summary.connected} of {summary.total} AI integrations passed · {summary.failed} failed · {summary.partial + summary.notConfigured} need setup.
      </p>

      <h2 className="mt-12 font-serif text-2xl text-navy-900">AI integrations</h2>
      <div className="mt-4 space-y-5">
        {checks.integrations.map((item) => (
          <section key={item.id} className={`rounded-2xl border p-5 ${STATUS[item.status].card}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-navy-900">{item.name}</h3>
                <p className="text-xs text-navy-600">{item.purpose}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[item.status].badge}`}>{STATUS[item.status].label}</span>
            </div>
            {item.steps.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {item.steps.map((step) => (
                  <li key={step.label} className={RESULT[step.result].className}>
                    <span className="font-semibold">
                      {RESULT[step.result].icon} {step.label}
                    </span>{" "}
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-navy-600">{KIND[step.kind]}</span>
                    <span className="block break-words pl-4 text-xs text-navy-700">{step.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-navy-700">
              <span className="font-semibold">Real activity: </span>
              {item.liveActivity}
            </p>
            <details className="mt-3 text-xs text-navy-700">
              <summary className="cursor-pointer font-semibold">Environment variables & troubleshooting</summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {item.env.map((row) => (
                  <li key={row.name} className={`rounded px-2 py-0.5 font-mono ${row.set ? "bg-emerald-100 text-emerald-900" : row.required ? "bg-red-100 text-red-900" : "bg-gray-100 text-gray-700"}`}>
                    {row.name} {row.set ? "· set" : row.required ? "· missing" : "· optional"}
                  </li>
                ))}
              </ul>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {item.troubleshooting.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </details>
          </section>
        ))}
      </div>

      <h2 className="mt-12 font-serif text-2xl text-navy-900">Agents</h2>
      <ul className="mt-4 space-y-2 rounded-2xl border border-[#e6dfd2] bg-white p-5 text-sm">
        {checks.agents.map((agent) => (
          <li key={agent.name} className={RESULT[agent.result].className}>
            <span className="font-semibold">
              {RESULT[agent.result].icon} {agent.name}
            </span>
            <span className="block pl-4 text-xs text-navy-700">{agent.detail}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-serif text-2xl text-navy-900">Platform, jobs & webhooks</h2>
      <ul className="mt-4 space-y-2 rounded-2xl border border-[#e6dfd2] bg-white p-5 text-sm">
        {checks.platform.map((row) => (
          <li key={row.name} className={RESULT[row.result].className}>
            <span className="font-semibold">
              {RESULT[row.result].icon} {row.name}
            </span>
            <span className="block break-words pl-4 text-xs text-navy-700">{row.detail}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-serif text-2xl text-navy-900">Store services</h2>
      <div className="mt-4 space-y-4">
        <Card
          ok={db.ok}
          title="MongoDB"
          message={db.message}
          meta={[db.connectionMode && `mode ${db.connectionMode}`, db.clusterHost && `cluster ${db.clusterHost}`, db.maxPoolSize != null && `pool ${db.maxPoolSize}`].filter(Boolean).join(" · ")}
        />
        {!db.ok && db.hints?.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-navy-700">
            {db.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : null}
        <Card ok={paypal.ok} title="PayPal" message={paypal.message} meta={`Mode ${paypal.mode} · webhook id ${paypal.webhookSet ? "set" : "missing"}`} />
        <Card ok={shipping.ok} title="ShipGlobal" message={shipping.message} meta={`HTTP ${shipping.httpStatus ?? "—"} · service ${shipping.service} · no shipment created`} />
      </div>

      <h2 className="mt-12 font-serif text-2xl text-navy-900">Logic self-test</h2>
      <p className={`mt-3 rounded-2xl px-5 py-3 text-sm font-semibold ${selfTestFailed ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>
        {selfTest.length - selfTestFailed} passed · {selfTestFailed} failed (same checks as <code>npm run check:phase2</code>)
      </p>
      {selfTestFailed ? (
        <ul className="mt-3 space-y-1 text-sm text-red-700">
          {selfTest
            .filter((r) => !r.pass)
            .map((r) => (
              <li key={`${r.section}-${r.name}`}>
                ✗ {r.section} · {r.name} <span className="block pl-4 text-xs">{r.detail}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
