"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; agent: "all" | "chat" | "whatsapp"; question: string; answer: string; updatedAt: string; updatedBy: string };
const AGENT_LABEL = { all: "Chat bot + WhatsApp", chat: "Website chat bot", whatsapp: "WhatsApp agent" } as const;
const EMPTY = { id: "", agent: "all" as Entry["agent"], question: "", answer: "" };

/** Teach the chat bot / WhatsApp agent: the admin writes how a question should be answered; Gemini uses it in replies. */
export function AdminAiTraining() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/ai/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(typeof json.error === "string" ? json.error : "Not saved.");
      return null;
    }
    if (Array.isArray(json.training)) setRows(json.training);
    return json;
  }

  useEffect(() => {
    void call({ action: "training_list" });
  }, []);

  async function save() {
    const ok = await call({ action: "training_save", ...form });
    if (ok) {
      setForm(EMPTY);
      setMsg("Saved — the AI uses it from the next message.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
        <p className="font-medium">{form.id ? "Edit training answer" : "Add training answer"}</p>
        <p className="mt-1 text-xs text-navy-600">
          Write a customer question and how Marina AI should answer it. Example: Q “Do you ship to Canada?” → A “Yes, we ship worldwide by air courier…”.
        </p>
        <select className="input mt-2 max-w-[14rem]" value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value as Entry["agent"] })}>
          {(Object.keys(AGENT_LABEL) as Entry["agent"][]).map((k) => (
            <option key={k} value={k}>
              {AGENT_LABEL[k]}
            </option>
          ))}
        </select>
        <input className="input mt-2 w-full" placeholder="Customer question" maxLength={500} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <textarea className="input mt-2 w-full" rows={4} placeholder="Answer Marina AI should give" maxLength={2000} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-gold" disabled={busy || !form.question.trim() || !form.answer.trim()} onClick={() => void save()}>
            {form.id ? "Update" : "Save"}
          </button>
          {form.id ? (
            <button type="button" className="rounded-full border px-4 py-2 text-xs" onClick={() => setForm(EMPTY)}>
              Cancel
            </button>
          ) : null}
        </div>
        {msg ? <p className="mt-2 text-xs text-navy-700">{msg}</p> : null}
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
            <p className="text-[11px] text-navy-500">{AGENT_LABEL[r.agent]} · {new Date(r.updatedAt).toLocaleString()}</p>
            <p className="mt-1 font-medium">Q: {r.question}</p>
            <p className="mt-1 whitespace-pre-line text-navy-700">A: {r.answer}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <button type="button" className="text-navy-900 underline" onClick={() => setForm({ id: r.id, agent: r.agent, question: r.question, answer: r.answer })}>
                Edit
              </button>
              <button
                type="button"
                className="text-red-700 underline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this training answer?")) void call({ action: "training_delete", id: r.id });
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {!rows.length ? <p className="text-sm text-navy-600">No training answers yet.</p> : null}
      </ul>
    </div>
  );
}
