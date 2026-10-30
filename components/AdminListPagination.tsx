"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

export function AdminListPagination({
  page,
  totalPages,
  summary,
  onPageChange,
  className = "",
  compact = false,
}: {
  page: number;
  totalPages: number;
  summary: ReactNode;
  onPageChange: (page: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const inputId = useId();
  const [goTo, setGoTo] = useState(String(page));
  const maxPage = Math.max(1, totalPages);

  useEffect(() => {
    setGoTo(String(page));
  }, [page]);

  function jump(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(goTo, 10);
    if (!Number.isFinite(n)) return;
    onPageChange(Math.min(maxPage, Math.max(1, n)));
  }

  const btn = compact
    ? "inline-flex h-8 items-center rounded-full border border-[#e8dfd0] bg-white px-3 text-xs disabled:opacity-40"
    : "inline-flex h-8 items-center rounded border border-[#e8dfd0] bg-white px-3 text-xs disabled:opacity-40";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-xs text-navy-600 ${className}`}
    >
      <span>{summary}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={page <= 1 || totalPages < 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>
        <form onSubmit={jump} className="flex h-8 items-center gap-1.5">
          <label className="sr-only" htmlFor={inputId}>
            Go to page
          </label>
          <input
            id={inputId}
            type="number"
            min={1}
            max={maxPage}
            value={goTo}
            onChange={(e) => setGoTo(e.target.value)}
            className="h-8 w-14 rounded border border-[#e8dfd0] bg-white px-2 text-center text-xs text-navy-900"
          />
          <span className="whitespace-nowrap text-navy-500">of {totalPages || 1}</span>
          <button type="submit" className={btn} disabled={totalPages < 1}>
            Go
          </button>
        </form>
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages || totalPages < 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
