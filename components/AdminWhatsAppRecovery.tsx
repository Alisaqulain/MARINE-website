"use client";

import { useState } from "react";

/** Phase 2 E: reply-recovery queue. Masked recipients, no message text unless expanded by the main admin. */
export type RecoveryRow = {
  id: string;
  ref: string;
  to: string;
  status: string;
  at: string;
  firstProblemAt: string | null;
  reason: string | null;
  attempt: number;
  claim: { at: string; workerId: string; actor: string } | null;
  replyWindowOpen: boolean;
  resendEligible: boolean;
};

const WARNING =
  "The original message may already have been delivered to the customer. Resending may result in the customer receiving the same message twice.";

export function AdminWhatsAppRecovery({ rows, counts, onChange }: { rows: RecoveryRow[]; counts: Record<string, number>; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [reconcile, setReconcile] = useState<Record<string, { outcome: string; reason: string }>>({});

  async function call(payload: Record<string, unknown>) {
    setError("");
    setNotice("");
    setBusy(`${payload.action}:${payload.id}`);
    try {
      const res = await fetch("/api/admin/ai/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Action failed.");
        return null;
      }
      return json as Record<string, unknown>;
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 text-sm shadow-sm">
      <h3 className="font-medium text-navy-900">Reply recovery</h3>
      <p className="mt-1 text-xs text-navy-600">
        Replies that may not have reached the customer. Nothing is ever resent automatically. Resend is possible only inside the customer&apos;s 24-hour window,
        before the 24-hour recovery expiry, by the main admin, with the duplicate-risk acknowledgement.
      </p>
      <p className="mt-1 text-xs text-navy-700">{Object.entries(counts).map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`).join(" · ") || "Nothing to review."}</p>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {notice ? <p className="mt-2 text-xs text-emerald-700">{notice}</p> : null}
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border p-3">
            <p className="font-medium">
              …{row.ref} · to {row.to} · {row.status.replace(/_/g, " ")} · {new Date(row.at).toLocaleString()}
              {row.attempt ? ` · resend attempt ${row.attempt}` : ""}
            </p>
            {row.reason ? <p className="mt-1 text-xs text-amber-800">{row.reason}</p> : null}
            <p className="mt-1 text-xs text-navy-600">
              Reply window {row.replyWindowOpen ? "open" : "closed"} · {row.resendEligible ? "resend possible" : "resend not possible"}
            </p>
            {texts[row.id] !== undefined ? <p className="mt-2 whitespace-pre-wrap text-navy-700">{texts[row.id]}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                className="rounded-full border px-3 py-1 text-xs"
                onClick={async () => {
                  const json = await call({ action: "wa_expand_message", id: row.id });
                  if (json) setTexts((t) => ({ ...t, [row.id]: String(json.text || "") }));
                }}
              >
                Show message
              </button>
              {row.status !== "resend_claimed" ? (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="rounded-full border px-3 py-1 text-xs"
                  onClick={async () => {
                    if (await call({ action: "wa_mark_resolved", id: row.id })) {
                      setNotice("Marked resolved.");
                      await onChange();
                    }
                  }}
                >
                  Mark resolved
                </button>
              ) : null}
            </div>
            {row.resendEligible ? (
              <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                <p>{WARNING}</p>
                <label className="mt-1 flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(ack[row.id])} onChange={(e) => setAck((a) => ({ ...a, [row.id]: e.target.checked }))} />I understand and accept the duplicate risk.
                </label>
                <button
                  type="button"
                  disabled={Boolean(busy) || !ack[row.id]}
                  className="btn-gold mt-2"
                  onClick={async () => {
                    const json = await call({ action: "wa_resend", id: row.id, confirm: true, acknowledgeDuplicateRisk: true });
                    setAck((a) => ({ ...a, [row.id]: false }));
                    if (json) setNotice(`Resend finished: ${String(json.status)}.`);
                    await onChange();
                  }}
                >
                  Resend once
                </button>
              </div>
            ) : null}
            {row.status === "resend_claimed" ? (
              <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-900">
                <p>
                  Open resend claim since {row.claim ? new Date(row.claim.at).toLocaleString() : "?"} by {row.claim?.actor || "?"} (worker {row.claim?.workerId || "?"}). It is never released automatically. Check the
                  delivery evidence and provider response, then record the outcome.
                </p>
                <select
                  className="input mt-1"
                  value={reconcile[row.id]?.outcome || "resend_unknown"}
                  onChange={(e) => setReconcile((r) => ({ ...r, [row.id]: { ...(r[row.id] || { reason: "" }), outcome: e.target.value } }))}
                >
                  <option value="resent">Delivery confirmed</option>
                  <option value="resend_failed">Definitively rejected</option>
                  <option value="resend_unknown">Still unknown</option>
                </select>
                <input
                  className="input mt-1"
                  placeholder="Reason (what evidence you checked)"
                  value={reconcile[row.id]?.reason || ""}
                  onChange={(e) => setReconcile((r) => ({ ...r, [row.id]: { ...(r[row.id] || { outcome: "resend_unknown" }), reason: e.target.value } }))}
                />
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="mt-1 rounded-full border px-3 py-1 text-xs"
                  onClick={async () => {
                    const r = reconcile[row.id] || { outcome: "resend_unknown", reason: "" };
                    if (await call({ action: "wa_reconcile_resend", id: row.id, claimAt: row.claim?.at || "", ...r })) {
                      setNotice("Claim reconciled.");
                      await onChange();
                    }
                  }}
                >
                  Record outcome
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
