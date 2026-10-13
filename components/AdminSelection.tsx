"use client";

import { useEffect, useState, type ReactNode } from "react";

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<string[]>([]);
  const idKey = ids.join("\n");

  useEffect(() => {
    const allowed = new Set(idKey ? idKey.split("\n") : []);
    setSelected((current) => current.filter((id) => allowed.has(id)));
  }, [idKey]);

  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : [...ids]);
  }

  function clear() {
    setSelected([]);
  }

  return { selected, allSelected, toggle, toggleAll, clear };
}

export function BulkActions({
  allSelected,
  selectedCount,
  onToggleAll,
  onDeleteSelected,
  onDeleteAll,
  canDelete = true,
  deleteAllLabel = "Delete all",
  extra,
}: {
  allSelected: boolean;
  selectedCount: number;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  canDelete?: boolean;
  deleteAllLabel?: string;
  extra?: ReactNode;
}) {
  if (!canDelete) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-white px-4 py-2 text-xs">
      <label className="inline-flex items-center gap-2 font-semibold text-navy-800">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
        Select all
      </label>
      <button
        type="button"
        className="font-semibold text-red-700 underline disabled:opacity-40"
        disabled={selectedCount === 0}
        onClick={onDeleteSelected}
      >
        Delete selected{selectedCount ? ` (${selectedCount})` : ""}
      </button>
      <button type="button" className="font-semibold text-red-700 underline" onClick={onDeleteAll}>
        {deleteAllLabel}
      </button>
      {extra}
    </div>
  );
}

export async function deleteUrls(urls: string[]) {
  const results = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url, { method: "DELETE" });
      return res.ok;
    })
  );
  return results.filter((ok) => !ok).length;
}
