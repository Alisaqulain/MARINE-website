"use client";

import { useEffect, useState } from "react";

type Board = {
  sessions?: number;
  chatModel?: string;
  voice?: { configured: boolean; message: string };
  leads?: {
    id: string;
    score: number;
    segment?: string;
    stage: string;
    summary: string;
    estimatedValueUsd?: number;
    quantity?: number;
    channel?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    country?: string;
    productInterest?: string[];
    alertedAt?: string;
    alertDelivered?: boolean;
  }[];
  approvals?: { id: string; status: string; action: string; terms: string }[];
  calls?: { id: string; type: string; stage?: string; transcript?: string; summary?: string; objections?: string[] }[];
  report?: {
    orders: number;
    revenue: number;
    pageViews: number;
    leads: number;
    estimatedPipelineUsd: number;
    revenueBySource: { source: string; orders: number; revenue: number }[];
    averageOrderValue?: number | null;
    highValuePipelineUsd?: number;
    funnel?: {
      visitors: number;
      enquiries: number;
      leads: number;
      orders: number;
      visitorToEnquiry: number | null;
      enquiryToLead: number | null;
      leadToOrder: number | null;
    };
    leadsBySource?: { source: string; leads: number; pipelineUsd: number }[];
    topProducts?: { slug: string; name: string; units: number; revenue: number }[];
    feed?: { items: number; errors: number };
    notes: string[];
  };
  followUps?: { id: string; channel: string; to: string; reason: string; status: string; note?: string; lastError?: string; createdAt: string }[];
  content?: { id: string; kind: string; topic: string; status: string; body: unknown; sources?: { title: string; uri: string }[]; groundingIssues?: string[]; createdAt: string }[];
  whatsapp?: { to: string; text?: string; status: string; reason?: string; at: string }[];
  error?: string;
};

const sections = [
  "Overview",
  "Leads",
  "Approvals",
  "Follow-ups",
  "Calls",
  "WhatsApp",
  "Growth",
  "Content",
  "Health",
] as const;

const CONTENT_KINDS = ["product_seo", "category_seo", "buying_guide", "faq", "competitor_research"] as const;

function maskTo(value: string) {
  return value.includes("@") ? value.replace(/^(.).*(@.*)$/, "$1…$2") : `…${value.slice(-4)}`;
}

export function AdminAiPanel() {
  const [data, setData] = useState<Board | null>(null);
  const [section, setSection] = useState<(typeof sections)[number]>("Overview");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const res = await fetch("/api/admin/ai");
    const json = (await res.json().catch(() => ({}))) as Board;
    if (!res.ok) {
      setError(json.error || "Could not load Marina AI.");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    setError("");
    const res = await fetch("/api/admin/ai/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Decision was not saved.");
      return;
    }
    await load();
  }

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<(typeof CONTENT_KINDS)[number]>("product_seo");
  const [topic, setTopic] = useState("");

  async function act(payload: Record<string, unknown>, done: string) {
    setError("");
    setNotice("");
    setBusy(String(payload.action));
    try {
      const res = await fetch("/api/admin/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Action failed.");
        return;
      }
      setNotice(done);
      await load();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy-900">Marina AI</h2>
        <p className="mt-1 text-sm text-navy-600">
          Four agents — chat, voice, growth and WhatsApp — share Gemini, the live catalogue and one CRM. Replies are checked against catalogue facts. Discounts and callbacks wait for your approval
          here. Connection status: <a href="/test" className="text-[#8C6E28] underline">/test</a>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              className={`rounded-full px-3 py-1 text-xs ${section === item ? "bg-[#031D38] text-white" : "bg-[#F4F1EA] text-navy-800"}`}
            >
              {item}
            </button>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      </div>
      {section === "Follow-ups" ? (
        <div className="space-y-2">
          {(data?.followUps || []).map((row) => (
            <div key={row.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
              <p className="font-medium">
                {row.reason.replace(/_/g, " ")} · {row.channel} to {maskTo(row.to)} · {row.status.replace(/_/g, " ")}
              </p>
              {row.note ? <p className="mt-1 text-xs text-navy-600">{row.note}</p> : null}
              {row.lastError ? <p className="mt-1 text-xs text-red-700">{row.lastError}</p> : null}
              {row.status === "needs_approval" || row.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  {row.channel === "call" ? (
                    <button type="button" disabled={Boolean(busy)} className="btn-gold" onClick={() => void act({ action: "approve_callback", id: row.id }, "Callback started through Vapi.")}>
                      Approve & call now
                    </button>
                  ) : null}
                  <button type="button" disabled={Boolean(busy)} className="rounded-full border px-4 py-2 text-xs" onClick={() => void act({ action: "dismiss_followup", id: row.id }, "Dismissed.")}>
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {!data?.followUps?.length ? <p className="text-sm text-navy-600">No follow-ups. Missed calls, abandoned checkouts and cooling enquiries (with consent) appear here.</p> : null}
        </div>
      ) : null}
      {section === "WhatsApp" ? (
        <ul className="space-y-2">
          {(data?.whatsapp || []).map((row, i) => (
            <li key={`${row.at}-${i}`} className="rounded-xl bg-white p-4 text-sm shadow-sm">
              <p className="font-medium">
                To {maskTo(row.to)} · {row.status} · {new Date(row.at).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-navy-700">{row.text}</p>
              {row.reason ? <p className="mt-1 text-xs text-amber-800">{row.reason}</p> : null}
            </li>
          ))}
          {!data?.whatsapp?.length ? <p className="text-sm text-navy-600">No WhatsApp replies yet.</p> : null}
        </ul>
      ) : null}
      {section === "Content" ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <p className="font-medium">Growth agent — draft content (owner review, never auto-published)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="input max-w-[12rem]" value={kind} onChange={(e) => setKind(e.target.value as (typeof CONTENT_KINDS)[number])}>
                {CONTENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <input
                className="input min-w-0 flex-1"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={kind === "product_seo" ? "Product slug, e.g. antique-brass-nautical-compass" : "Topic, category or competitor keyword"}
              />
              <button
                type="button"
                className="btn-gold"
                disabled={Boolean(busy)}
                onClick={() =>
                  void act(kind === "product_seo" ? { action: "generate_content", kind, slug: topic.trim() } : { action: "generate_content", kind, topic }, "Draft created.")
                }
              >
                {busy === "generate_content" ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
          {(data?.content || []).map((item) => (
            <details key={item.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
              <summary className="cursor-pointer font-medium">
                {item.kind.replace(/_/g, " ")} · {item.topic || "—"} · {item.status.replace(/_/g, " ")}
              </summary>
              {item.groundingIssues?.length ? <p className="mt-2 text-xs text-red-700">Unverified numbers: {item.groundingIssues.join(", ")} — edit before use.</p> : null}
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-navy-800">{typeof item.body === "string" ? item.body : JSON.stringify(item.body, null, 2)}</pre>
              {item.sources?.length ? (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {item.sources.map((src) => (
                    <li key={src.uri}>
                      <a href={src.uri} target="_blank" rel="noreferrer" className="text-[#8C6E28] underline">
                        {src.title || src.uri}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.status === "draft" || item.status === "needs_review" ? (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-gold" onClick={() => void act({ action: "decide_content", id: item.id, status: "approved" }, "Approved — publish it from the blog or product editor.")}>
                    Approve
                  </button>
                  <button type="button" className="rounded-full border px-4 py-2 text-xs" onClick={() => void act({ action: "decide_content", id: item.id, status: "rejected" }, "Rejected.")}>
                    Reject
                  </button>
                </div>
              ) : null}
            </details>
          ))}
        </div>
      ) : null}
      {section === "Overview" || section === "Growth" ? (
        <div className="rounded-xl bg-white p-5 text-sm text-navy-800 shadow-sm">
          <p>Paid orders in sample: {data?.report?.orders ?? "—"} · Revenue ${data?.report?.revenue ?? "—"} USD</p>
          <p className="mt-1">Page views: {data?.report?.pageViews ?? "—"} · Leads: {data?.report?.leads ?? "—"}</p>
          <p className="mt-1">Estimated pipeline (not revenue): ${data?.report?.estimatedPipelineUsd ?? "—"} USD · high-value ${data?.report?.highValuePipelineUsd ?? "—"}</p>
          <p className="mt-1">Average order value: {data?.report?.averageOrderValue != null ? `${data.report.averageOrderValue}` : "—"}</p>
          {data?.report?.funnel ? (
            <p className="mt-1">
              Funnel: {data.report.funnel.visitors} visitors → {data.report.funnel.enquiries} enquiries (
              {data.report.funnel.visitorToEnquiry ?? "—"}%) → {data.report.funnel.leads} leads ({data.report.funnel.enquiryToLead ?? "—"}%) →{" "}
              {data.report.funnel.orders} orders ({data.report.funnel.leadToOrder ?? "—"}%)
            </p>
          ) : null}
          {data?.report?.feed ? (
            <p className="mt-1">
              Shopping feed: {data.report.feed.items} items · {data.report.feed.errors} with errors
            </p>
          ) : null}
          {data?.report?.topProducts?.length ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Top products by paid revenue</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {data.report.topProducts.map((p) => (
                  <li key={p.slug}>
                    {p.name}: {p.units} sold · ${p.revenue}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data?.report?.leadsBySource?.length ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Leads by source</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {data.report.leadsBySource.map((row) => (
                  <li key={row.source}>
                    {row.source}: {row.leads} leads · ${row.pipelineUsd} estimated
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <a href="/api/ai/report/daily?dry=1" target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-[#8C6E28] underline">
            Preview today's owner report
          </a>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-navy-600">
            {(data?.report?.notes || []).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-xs">
            {(data?.report?.revenueBySource || []).map((row) => (
              <li key={row.source}>
                {row.source}: {row.orders} orders, ${row.revenue} attributed from linked sessions
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {section === "Leads" ? (
        <ul className="space-y-2">
          {(data?.leads || []).map((lead) => (
            <li key={lead.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
              <p className="font-medium text-navy-900">
                {lead.stage} · score {lead.score}{lead.segment ? ` · ${lead.segment.toUpperCase()}` : ""}
                {lead.quantity ? ` · qty ${lead.quantity}` : ""} · est. ${lead.estimatedValueUsd ?? 0}
              </p>
              <p className="mt-1 text-navy-700">{lead.summary}</p>
              <p className="mt-1 text-xs text-navy-600">
                {[lead.channel, lead.name, lead.company, lead.email, lead.phone, lead.country].filter(Boolean).join(" · ") || "No contact details yet"}
                {lead.productInterest?.length ? ` · interested in ${lead.productInterest.join(", ")}` : ""}
              </p>
              {lead.alertedAt ? (
                <p className={`mt-1 text-xs ${lead.alertDelivered ? "text-emerald-700" : "text-red-700"}`}>
                  Owner alerted {new Date(lead.alertedAt).toLocaleString()} — {lead.alertDelivered ? "email delivered" : "email failed (check SMTP on /test)"}
                </p>
              ) : null}
            </li>
          ))}
          {!data?.leads?.length ? <p className="text-sm text-navy-600">No leads yet.</p> : null}
        </ul>
      ) : null}
      {section === "Approvals" ? (
        <div className="space-y-3">
          <label className="block text-xs text-navy-600">
            Message to the customer (the AI shares it when you approve — e.g. "10% off for 25 units, valid 72 hours.")
            <input className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required before approving or rejecting" />
          </label>
          {(data?.approvals || []).map((item) => (
            <div key={item.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
              <p className="font-medium">
                {item.action} · {item.status}
              </p>
              <p className="mt-1 text-navy-700">{item.terms}</p>
              {item.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-gold" onClick={() => void decide(item.id, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="rounded-full border px-4 py-2 text-xs" onClick={() => void decide(item.id, "rejected")}>
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {!data?.approvals?.length ? <p className="text-sm text-navy-600">No approval requests.</p> : null}
        </div>
      ) : null}
      {section === "Calls" ? (
        <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
          <p>{data?.voice?.message}</p>
          <ul className="mt-3 space-y-2">
            {(data?.calls || []).map((call) => (
              <li key={call.id}>
                {call.type}
                {call.stage ? ` · ${call.stage}` : ""} {call.summary ? `· ${call.summary}` : call.transcript ? `· ${call.transcript.slice(0, 140)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {section === "Health" ? (
        <div className="rounded-xl bg-white p-5 text-sm text-navy-800 shadow-sm">
          <p>
            AI model:{" "}
            {data?.chatModel?.startsWith("gemini:") ? `Google Gemini (${data.chatModel.slice(7)})` : "Catalogue answers only — GEMINI_API_KEY is not set."}
          </p>
          <p className="mt-2">Sessions stored: {data?.sessions ?? "—"}</p>
          <p className="mt-2">Product feed: /feeds/google.xml (generated locally, not uploaded to Google)</p>
          <p className="mt-2">{data?.voice?.message}</p>
          <button
            type="button"
            className="mt-3 rounded-full border px-4 py-2 text-xs"
            disabled={Boolean(busy)}
            onClick={() => void act({ action: "vapi_sync" }, "Vapi assistant updated: Gemini model, Marina tools and webhook.")}
          >
            {busy === "vapi_sync" ? "Syncing…" : "Sync Vapi assistant (main admin)"}
          </button>
          <p className="mt-2">
            Full integration status: <a href="/test" className="text-[#8C6E28] underline">/test</a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
