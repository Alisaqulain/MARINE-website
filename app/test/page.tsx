import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { pingPayPal } from "@/lib/paypal";
import { pingShipGlobal } from "@/lib/shipglobal";
import { runHealthCheck } from "@/lib/ai/health";
import { STATUS_LABEL, type CheckStep, type IntegrationStatus } from "@/lib/ai/integration-status";
import type { AgentStatus } from "@/lib/ai/integration-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integration health", robots: { index: false, follow: false } };

const STATUS: Record<IntegrationStatus, { card: string; badge: string }> = {
  operational: { card: "border-emerald-300 bg-emerald-50", badge: "bg-emerald-700 text-white" },
  connected: { card: "border-emerald-200 bg-emerald-50/60", badge: "bg-emerald-500 text-white" },
  partial: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-500 text-white" },
  auth_failed: { card: "border-red-200 bg-red-50", badge: "bg-red-600 text-white" },
  api_error: { card: "border-red-200 bg-red-50", badge: "bg-red-700 text-white" },
  not_configured: { card: "border-gray-200 bg-gray-50", badge: "bg-gray-500 text-white" },
};

const AGENT_STATUS: Record<AgentStatus, { label: string; badge: string }> = {
  operational: { label: "Operational", badge: "bg-emerald-700 text-white" },
  degraded: { label: "Degraded", badge: "bg-amber-500 text-white" },
  not_operational: { label: "Not operational", badge: "bg-red-600 text-white" },
  disabled: { label: "Disabled", badge: "bg-gray-500 text-white" },
};

const RESULT: Record<CheckStep["result"], { icon: string; className: string }> = {
  pass: { icon: "✓", className: "text-emerald-800" },
  fail: { icon: "✗", className: "text-red-700" },
  warn: { icon: "!", className: "text-amber-800" },
  skip: { icon: "–", className: "text-gray-600" },
};

const KIND: Record<CheckStep["kind"], string> = { config: "settings", credential: "credentials", live: "live API" };
const yesNo = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "not checked");
const when = (iso: string | null) => (iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : "never");

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${tone}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-[11px] uppercase tracking-wider">{label}</p>
    </div>
  );
}

/**
 * Phase 2 integration health dashboard. Admin/staff only (also in development). Read-only towards providers:
 * no WhatsApp message is sent, no call placed, no payment made; the only writes are the health-run record and
 * a scratch database document deleted immediately. Secrets, tokens, full numbers and database credentials are never shown.
 */
export default async function TestPage() {
  const session = await auth();
  if (!session?.user || !isDashboardRole(session.user.role)) redirect("/admin/login?callbackUrl=/test");

  const [health, paypal, shipping] = await Promise.all([runHealthCheck(), pingPayPal(), pingShipGlobal()]);
  const { summary, readiness } = health;
  const categories = [...new Set(health.env.map((e) => e.category))];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl text-navy-900">Phase 2 integration health</h1>
      <p className="mt-2 text-sm text-navy-600">
        Real checks of every integration and the four AI agents. “Credentials” and “live API” steps are labelled separately; an integration is only
        Operational when real production activity has been seen. Nothing is sent, called or charged.
      </p>
      <p className="mt-1 text-xs text-navy-500">
        Checked {when(health.checkedAt)} in {health.ms} ms · NODE_ENV {health.environment.nodeEnv} ·{" "}
        {health.environment.production ? "Production" : "Test / development"} environment · PayPal {health.environment.paypalMode}
      </p>

      {/* Overview */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Agent readiness" value={`${readiness.agents}%`} tone="bg-navy-900 text-white" />
        <Stat label="Integrations up" value={`${summary.operational + summary.connected}/${summary.total}`} tone="bg-emerald-50 text-emerald-900" />
        <Stat label="Agents operational" value={`${health.agentsOperational}/4`} tone="bg-sky-50 text-sky-900" />
        <Stat label="Failing" value={summary.failed} tone="bg-red-50 text-red-900" />
        <Stat label="Operational" value={summary.operational} tone="bg-emerald-50 text-emerald-900" />
        <Stat label="Connected" value={summary.connected} tone="bg-emerald-50/60 text-emerald-900" />
        <Stat label="Partially configured" value={summary.partial} tone="bg-amber-50 text-amber-900" />
        <Stat label="Not configured" value={summary.notConfigured} tone="bg-gray-100 text-gray-800" />
      </div>
      <div className="mt-3 grid gap-2 text-sm text-navy-700 sm:grid-cols-2">
        <p>
          <span className="font-semibold">Last check with no failing integration:</span> {when(health.lastHealthyAt)}
        </p>
        <p>
          <span className="font-semibold">Last error:</span>{" "}
          {health.lastError ? `${when(health.lastError.at)} · ${health.lastError.id}: ${health.lastError.error.slice(0, 140)}` : "none recorded"}
        </p>
      </div>

      {/* Agents */}
      <h2 className="mt-10 font-serif text-2xl text-navy-900">AI agents</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {health.agents.map((agent) => (
          <section key={agent.id} className="rounded-2xl border border-[#e6dfd2] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-navy-900">{agent.name}</h3>
                <p className="text-xs text-navy-600">{agent.purpose}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${AGENT_STATUS[agent.status].badge}`}>{AGENT_STATUS[agent.status].label}</span>
            </div>
            <p className="mt-2 text-xs text-navy-600">
              Dependencies OK: {agent.score}% · logic tests {agent.tests.passed} passed / {agent.tests.failed} failed · Gemini last 24 h:{" "}
              {agent.usage ? `${agent.usage.calls} calls, ${agent.usage.errors} errors, avg ${agent.usage.avgMs} ms` : "no calls"}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {agent.checks.map((c) => (
                <li key={c.label} className={c.ok ? "text-emerald-800" : c.level === "critical" ? "text-red-700" : c.level === "required" ? "text-amber-800" : "text-gray-600"}>
                  <span className="font-semibold">
                    {c.ok ? "✓" : c.level === "info" ? "–" : "✗"} {c.label}
                  </span>{" "}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-navy-600">{c.level}</span>
                  <span className="block break-words pl-4 text-xs text-navy-700">{c.detail}</span>
                </li>
              ))}
            </ul>
            {agent.missing.length ? <p className="mt-3 text-xs text-navy-700">Needs: {agent.missing.join(", ")}</p> : null}
          </section>
        ))}
      </div>

      {/* Integrations */}
      <h2 className="mt-10 font-serif text-2xl text-navy-900">Integrations</h2>
      <div className="mt-4 space-y-4">
        {health.cards.map((card) => (
          <section key={card.id} className={`rounded-2xl border p-5 ${STATUS[card.status].card}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-navy-900">{card.name}</h3>
                <p className="text-xs text-navy-600">{card.purpose}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[card.status].badge}`}>{STATUS_LABEL[card.status]}</span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-navy-700 sm:grid-cols-2">
              <div>
                <dt className="inline font-semibold">Required variables present: </dt>
                <dd className="inline">
                  {card.env.filter((e) => e.required).length ? `${card.env.filter((e) => e.required && e.set).length}/${card.env.filter((e) => e.required).length}` : "none needed"}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Authentication verified: </dt>
                <dd className="inline">{yesNo(card.authVerified)}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Safe API operation succeeded: </dt>
                <dd className="inline">{yesNo(card.operationOk)}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Last successful check: </dt>
                <dd className="inline">{when(card.lastSuccessAt)}</dd>
              </div>
              {card.lastError ? (
                <div className="sm:col-span-2">
                  <dt className="inline font-semibold">Last error ({when(card.lastErrorAt)}): </dt>
                  <dd className="inline break-words">{card.lastError}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-navy-800">
              <span className="font-semibold">Next action: </span>
              {card.nextAction}
            </p>
            {card.missing.length || card.invalid.length ? (
              <p className="mt-2 text-xs text-red-800">
                {card.missing.length ? `Missing: ${card.missing.join(", ")}. ` : ""}
                {card.invalid.length ? `Invalid: ${card.invalid.join("; ")}.` : ""}
              </p>
            ) : null}
            <details className="mt-3 text-xs text-navy-700">
              <summary className="cursor-pointer font-semibold">Checks, real activity and variables</summary>
              <ul className="mt-2 space-y-1.5">
                {card.steps.map((step) => (
                  <li key={step.label} className={RESULT[step.result].className}>
                    <span className="font-semibold">
                      {RESULT[step.result].icon} {step.label}
                    </span>{" "}
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] uppercase text-navy-600">{KIND[step.kind]}</span>
                    <span className="block break-words pl-4 text-navy-700">{step.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                <span className="font-semibold">Real activity: </span>
                {card.liveActivity}
              </p>
              {card.env.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {card.env.map((e) => (
                    <li
                      key={e.name}
                      className={`rounded px-2 py-0.5 font-mono ${e.set ? (e.problem ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900") : e.required ? "bg-red-100 text-red-900" : "bg-gray-100 text-gray-700"}`}
                    >
                      {e.name} {e.set ? (e.problem ? "· invalid" : "· set") : e.required ? "· missing" : "· optional"}
                    </li>
                  ))}
                </ul>
              ) : null}
              {card.troubleshooting.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {card.troubleshooting.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          </section>
        ))}
      </div>

      {/* Coexistence */}
      <h2 className="mt-10 font-serif text-2xl text-navy-900">WhatsApp Business app coexistence</h2>
      <section className="mt-4 rounded-2xl border border-[#e6dfd2] bg-white p-5">
        <p className="text-sm text-navy-700">
          Mode: <span className="font-semibold">{health.coexistence.mode.replace(/_/g, " ")}</span> · {health.coexistence.connected ? "Meta-confirmed (connected)" : "not active — Meta has not confirmed an onboarding"}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {health.coexistence.rows.map((row) => (
            <li key={row.label} className={RESULT[row.result].className}>
              <span className="font-semibold">
                {RESULT[row.result].icon} {row.label}
              </span>
              <span className="block break-words pl-4 text-xs text-navy-700">{row.detail}</span>
            </li>
          ))}
        </ul>
        {health.coexistence.steps.length ? (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-navy-700">
            {health.coexistence.steps.map((st) => (
              <li key={st.label}>
                <span className="font-semibold">{st.label}</span> — {st.state}: {st.detail}
              </li>
            ))}
          </ol>
        ) : null}
        {health.coexistence.approvals.length ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-navy-700">
            {health.coexistence.approvals.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Environment */}
      <h2 className="mt-10 font-serif text-2xl text-navy-900">Environment variables</h2>
      <p className="mt-2 text-sm text-navy-600">Set / missing / invalid only — values are never shown. Setup steps: docs/phase2/ENVIRONMENT_SETUP.md.</p>
      <div className="mt-4 space-y-3">
        {categories.map((cat) => {
          const rows = health.env.filter((e) => e.category === cat);
          const missingRequired = rows.filter((e) => !e.set && e.required !== "optional").length;
          const invalid = rows.filter((e) => e.problem).length;
          return (
            <details key={cat} className="rounded-2xl border border-[#e6dfd2] bg-white p-4 text-sm" open={missingRequired > 0 || invalid > 0}>
              <summary className="cursor-pointer font-semibold text-navy-900">
                {cat} · {rows.filter((e) => e.set).length}/{rows.length} set{missingRequired ? ` · ${missingRequired} needed` : ""}
                {invalid ? ` · ${invalid} invalid` : ""}
              </summary>
              <ul className="mt-3 space-y-1 text-xs">
                {rows.map((e) => (
                  <li key={e.name} className={e.problem ? "text-red-700" : e.set ? "text-emerald-800" : e.required === "optional" ? "text-gray-600" : "text-amber-800"}>
                    <span className="font-mono">{e.name}</span> — {e.problem ? e.problem : e.set ? "set" : e.required === "optional" ? "optional, not set" : "missing"}
                    <span className="text-navy-500"> · {e.agents.join(", ")} · {e.scope}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>

      {/* Existing store services */}
      <h2 className="mt-10 font-serif text-2xl text-navy-900">Store services</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { title: "PayPal", ok: paypal.ok, message: paypal.message, meta: `Mode ${paypal.mode} · webhook id ${paypal.webhookSet ? "set" : "missing"}` },
          { title: "ShipGlobal", ok: shipping.ok, message: shipping.message, meta: `HTTP ${shipping.httpStatus ?? "—"} · service ${shipping.service} · no shipment created` },
        ].map((svc) => (
          <section key={svc.title} className={`rounded-2xl border px-5 py-4 ${svc.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{svc.title}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${svc.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>{svc.ok ? "Connected" : "Not connected"}</span>
            </div>
            <p className="mt-1 text-xs opacity-80">{svc.meta}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{svc.message}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
