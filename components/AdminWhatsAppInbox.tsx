"use client";

import { useMemo, useState } from "react";

export type InboxRow = { wamid: string; from: string; at: string; hasText: boolean; replied: boolean };
type ThreadMsg = { direction: "in" | "out"; text: string; at: string; status?: string; manual?: boolean };

function mask(digits: string) {
  return digits.length > 4 ? `…${digits.slice(-4)}` : "…";
}

/**
 * WhatsApp inbox grouped by customer: one card per number, click to open the whole conversation (incoming and
 * outgoing) with the reply box under it. Opening a conversation is main-admin only and audited on the server.
 */
export function AdminWhatsAppInbox({ rows, onError }: { rows: InboxRow[]; onError: (message: string) => void }) {
  const [openFrom, setOpenFrom] = useState("");
  const [thread, setThread] = useState<ThreadMsg[]>([]);
  const [fullNumber, setFullNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  const customers = useMemo(() => {
    const map = new Map<string, { from: string; count: number; lastAt: string; lastWamid: string; replied: boolean }>();
    for (const r of rows) {
      const c = map.get(r.from) ?? { from: r.from, count: 0, lastAt: "", lastWamid: "", replied: true };
      c.count += 1;
      if (r.at > c.lastAt) {
        c.lastAt = r.at;
        c.lastWamid = r.wamid;
        c.replied = r.replied;
      }
      map.set(r.from, c);
    }
    return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [rows]);

  async function open(from: string, wamid: string) {
    if (openFrom === from) {
      setOpenFrom("");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/ai/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "wa_conversation", id: wamid }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      onError(typeof json.error === "string" ? json.error : "Could not open the conversation.");
      return;
    }
    setThread(Array.isArray(json.messages) ? json.messages : []);
    setFullNumber(String(json.from || ""));
    setOpenFrom(from);
    setText("");
  }

  async function send(wamid: string) {
    const value = text.trim();
    if (!value) return;
    if (!window.confirm(`Send this WhatsApp reply to +${fullNumber}?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/ai/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "wa_manual_reply", id: wamid, text: value }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      onError(`Reply ${json.result === "refused" ? "refused" : "failed"}: ${typeof json.error === "string" ? json.error : "not sent."}`);
      return;
    }
    setText("");
    setThread((t) => [...t, { direction: "out", text: value, at: new Date().toISOString(), status: "manual_sent", manual: true }]);
  }

  if (!customers.length) return <p className="text-sm text-navy-600">No incoming WhatsApp messages yet.</p>;

  return (
    <ul className="space-y-2">
      {customers.map((c) => (
        <li key={c.from} className="rounded-xl bg-white shadow-sm">
          <button
            type="button"
            disabled={busy}
            onClick={() => void open(c.from, c.lastWamid)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm"
          >
            <span>
              <span className="font-medium text-navy-900">
                Customer {openFrom === c.from && fullNumber ? `+${fullNumber}` : mask(c.from)}
              </span>
              <span className="block text-xs text-navy-500">
                {c.count} message{c.count === 1 ? "" : "s"} · last {new Date(c.lastAt).toLocaleString()}
              </span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.replied ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              {c.replied ? "Replied" : "Needs reply"}
            </span>
          </button>
          {openFrom === c.from ? (
            <div className="border-t border-[#f0ece4] p-4">
              <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg bg-[#F4F1EA] p-3">
                {thread.map((m, i) => (
                  <div key={i} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[13px] ${
                        m.direction === "out" ? "rounded-br-sm bg-[#DCF8C6] text-navy-900" : "rounded-bl-sm bg-white text-navy-900"
                      }`}
                    >
                      {m.text || <em className="text-navy-500">(no text)</em>}
                      <span className="mt-1 block text-right text-[10px] text-navy-500">
                        {new Date(m.at).toLocaleString()}
                        {m.direction === "out" ? ` · ${m.manual ? "admin" : "AI"} · ${String(m.status || "").replace("manual_", "")}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  maxLength={4096}
                  placeholder="Type a reply (only within 24 hours of the customer's last message)"
                  className="flex-1 rounded-lg border border-[#e6dfd2] p-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void send(c.lastWamid)}
                  className="self-end rounded-full bg-[#031D38] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
