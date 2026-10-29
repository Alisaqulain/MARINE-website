"use client";

import { useEffect, useState } from "react";

type Board = {
  sessions?: number;
  chatModel?: string;
  voice?: { configured: boolean; message: string };
  leads?: { id: string; score: number; stage: string; summary: string; estimatedValueUsd?: number; quantity?: number }[];
  approvals?: { id: string; status: string; action: string; terms: string }[];
  calls?: { id: string; type: string; stage?: string; transcript?: string }[];
  report?: {
    orders: number;
    revenue: number;
    pageViews: number;
    leads: number;
    estimatedPipelineUsd: number;
    revenueBySource: { source: string; orders: number; revenue: number }[];
    notes: string[];
  };
  error?: string;
};

const sections = [
  "Overview",
  "Leads",
  "Approvals",
  "Calls",
  "Growth",
  "Health",
] as const;

export function AdminAiPanel() {
  const [data, setData] = useState<Board | null>(null);
  const [section, setSection] = useState<(typeof sections)[number]>("Overview");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("Reviewed in admin.");

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy-900">Marina AI</h2>
        <p className="mt-1 text-sm text-navy-600">
          Chat uses the live catalogue. Voice and search-volume data stay off until their credentials are set. Restricted discounts stay pending until you approve them here.
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
      </div>
      {section === "Overview" || section === "Growth" ? (
        <div className="rounded-xl bg-white p-5 text-sm text-navy-800 shadow-sm">
          <p>Paid orders in sample: {data?.report?.orders ?? "—"} · Revenue ${data?.report?.revenue ?? "—"} USD</p>
          <p className="mt-1">Page views: {data?.report?.pageViews ?? "—"} · Leads: {data?.report?.leads ?? "—"}</p>
          <p className="mt-1">Estimated pipeline (not revenue): ${data?.report?.estimatedPipelineUsd ?? "—"} USD</p>
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
                {lead.stage} · score {lead.score}
                {lead.quantity ? ` · qty ${lead.quantity}` : ""} · est. ${lead.estimatedValueUsd ?? 0}
              </p>
              <p className="mt-1 text-navy-700">{lead.summary}</p>
            </li>
          ))}
          {!data?.leads?.length ? <p className="text-sm text-navy-600">No leads yet.</p> : null}
        </ul>
      ) : null}
      {section === "Approvals" ? (
        <div className="space-y-3">
          <label className="block text-xs text-navy-600">
            Decision note
            <input className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
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
                {call.stage ? ` · ${call.stage}` : ""} {call.transcript ? `· ${call.transcript.slice(0, 140)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {section === "Health" ? (
        <div className="rounded-xl bg-white p-5 text-sm text-navy-800 shadow-sm">
          <p>Chat model: {data?.chatModel === "configured" ? "OpenAI key is set" : "Catalogue answers only. OPENAI_API_KEY is not set."}</p>
          <p className="mt-2">Sessions stored: {data?.sessions ?? "—"}</p>
          <p className="mt-2">Product feed: /feeds/google.xml (generated locally, not uploaded to Google)</p>
          <p className="mt-2">{data?.voice?.message}</p>
        </div>
      ) : null}
    </div>
  );
}
