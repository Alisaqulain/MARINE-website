"use client";

import { useState } from "react";

type Result = { ok: boolean; switchState?: string; ms?: number; summary: string; question?: string; reply?: string; products?: string[] };

const AGENTS = [
  { id: "chat", name: "Chat & Sales", what: "Answers a website visitor's product question.", ask: true },
  { id: "whatsapp", name: "WhatsApp", what: "Writes the reply a WhatsApp customer would get (not sent).", ask: true },
  { id: "voice", name: "Voice & Call", what: "Checks the Vapi assistant is reachable and set up. No call is placed.", ask: false },
  { id: "growth", name: "Growth & Revenue", what: "Writes insights from the last 7 days of Analytics data.", ask: false },
] as const;

export default function AgentTester() {
  const [question, setQuestion] = useState("Do you have a brass telescope? What is the price?");
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});

  async function run(agent: string) {
    setBusy(agent);
    try {
      const res = await fetch("/api/admin/agent-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, message: question }) });
      const data = (await res.json().catch(() => ({ ok: false, summary: `HTTP ${res.status}` }))) as Result & { error?: string };
      setResults((r) => ({ ...r, [agent]: data.error ? { ok: false, summary: data.error } : data }));
    } catch {
      setResults((r) => ({ ...r, [agent]: { ok: false, summary: "Network error" } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Test question (for Chat and WhatsApp)</label>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {AGENTS.map((a) => {
          const r = results[a.id];
          return (
            <section key={a.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-navy-900">{a.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{a.what}</p>
                </div>
                {r ? <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{r.ok ? "Working" : "Problem"}</span> : null}
              </div>
              <button onClick={() => run(a.id)} disabled={busy !== null} className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === a.id ? "Testing…" : `Test ${a.name}`}
              </button>
              {r ? (
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-gray-800">{r.summary}</p>
                  {r.reply ? <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-800">{r.reply}</pre> : null}
                  {r.products?.length ? <p className="text-gray-500">Products found: {r.products.join(", ")}</p> : null}
                  <p className="text-xs text-gray-400">Live switch: {r.switchState ?? "?"} · {r.ms ?? 0} ms</p>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
