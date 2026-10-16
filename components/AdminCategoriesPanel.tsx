"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  builtin: boolean;
  children: CategoryNode[];
};

function flatten(nodes: CategoryNode[], depth = 0): { slug: string; name: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { slug: node.slug, name: node.name, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

export function AdminCategoriesPanel() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [name, setName] = useState("");
  const [parentSlug, setParentSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const parents = useMemo(() => flatten(tree), [tree]);

  async function load() {
    const res = await fetch("/api/categories");
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.tree)) setTree(data.tree);
  }

  useEffect(() => {
    void load();
  }, []);

  function apply(data: { tree?: CategoryNode[] }) {
    if (Array.isArray(data.tree)) setTree(data.tree);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentSlug }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not add the category.");
      return;
    }
    setName("");
    if (parentSlug) setOpen((current) => ({ ...current, [parentSlug]: true }));
    apply(data);
  }

  async function saveEdit(id: string) {
    setError("");
    const res = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not rename the category.");
      return;
    }
    setEditing(null);
    apply(data);
  }

  async function remove(node: CategoryNode) {
    if (!window.confirm(`Delete “${node.name}”?`)) return;
    setError("");
    const res = await fetch(`/api/admin/categories/${encodeURIComponent(node.id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not delete the category.");
      return;
    }
    apply(data);
  }

  function Row({ node, depth }: { node: CategoryNode; depth: number }) {
    const expanded = open[node.slug] ?? (depth === 0 && node.slug === tree[0]?.slug);
    const isEditing = editing === node.id;
    return (
      <div>
        <div
          className={`flex items-center gap-2 border-b border-[#f0f0f0] py-2 pr-3 ${
            expanded && depth === 0 ? "border-l-[3px] border-l-[#C9A84C] bg-[#faf7f2]" : "border-l-[3px] border-l-transparent"
          }`}
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          {node.children.length ? (
            <button
              type="button"
              aria-label={expanded ? "Hide subcategories" : "Show subcategories"}
              onClick={() => setOpen((current) => ({ ...current, [node.slug]: !expanded }))}
              className="grid h-7 w-7 shrink-0 place-items-center text-[#888]"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="h-7 w-7 shrink-0" />
          )}
          {isEditing ? (
            <input className="input min-w-0 flex-1 py-1.5 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <span className={`min-w-0 flex-1 text-sm ${depth === 0 ? "font-medium text-[#222]" : "text-[#555]"}`}>
              {node.name}
            </span>
          )}
          {isEditing ? (
            <>
              <button type="button" className="text-xs font-semibold text-[#8C6E28] underline" onClick={() => void saveEdit(node.id)}>
                Save
              </button>
              <button type="button" className="text-xs text-navy-600 underline" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="text-xs font-semibold text-[#8C6E28] underline"
                onClick={() => {
                  setEditing(node.id);
                  setDraft(node.name);
                }}
              >
                Edit
              </button>
              <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => void remove(node)}>
                Delete
              </button>
            </>
          )}
        </div>
        {expanded
          ? node.children.map((child) => <Row key={child.id} node={child} depth={depth + 1} />)
          : null}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[300px_1fr]">
      <form onSubmit={add} className="h-fit space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy-900">Add category</h2>
        <p className="text-xs text-navy-600">
          Choose a category under “Add under” to create a subcategory. Leave it empty to add a top-level category.
        </p>
        <label className="block text-xs">
          <span className="mb-1 block text-navy-600">Name</span>
          <input className="input" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-navy-600">Add under</span>
          <select className="input" value={parentSlug} onChange={(e) => setParentSlug(e.target.value)}>
            <option value="">Top level</option>
            {parents.map((item) => (
              <option key={item.slug} value={item.slug}>
                {`${"— ".repeat(item.depth)}${item.name}`}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Saving…" : parentSlug ? "Add subcategory" : "Add category"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#eee] bg-white shadow-sm">
        <p className="border-b border-[#f0f0f0] px-4 py-3 text-[15px] font-medium text-[#b0893a]">Product categories</p>
        <div className="max-h-[70vh] overflow-y-auto">
          {tree.map((node) => (
            <Row key={node.id} node={node} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
}
