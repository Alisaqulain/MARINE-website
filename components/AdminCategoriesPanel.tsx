"use client";

import { ProductImage } from "@/components/ProductImage";
import { uploadImageFile } from "@/components/AdminProductImageField";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  builtin: boolean;
  children: CategoryNode[];
};

function CategoryImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file?: File) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const uploaded = await uploadImageFile(file);
      onChange(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-navy-600">Image</span>
      <label className="relative inline-flex min-h-11 cursor-pointer items-center overflow-hidden rounded-full border border-[#C9A84C]/50 bg-[#FAF7F2] px-4 py-2 text-sm font-medium text-navy-800">
        {uploading ? "Uploading…" : value ? "Change image" : "Upload image"}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
        />
      </label>
      {value ? (
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#e6dfd2]">
            <ProductImage src={value} alt="" fill sizes="64px" className="object-cover" />
          </div>
          <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => onChange("")}>
            Remove image
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-navy-500">This photo is used on the homepage collection slider.</p>
      )}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

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
  const [draftImage, setDraftImage] = useState("");
  const [image, setImage] = useState("");

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
      body: JSON.stringify({ name, parentSlug, image }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not add the category.");
      return;
    }
    setName("");
    setImage("");
    if (parentSlug) setOpen((current) => ({ ...current, [parentSlug]: true }));
    apply(data);
  }

  async function saveEdit(id: string) {
    setError("");
    const res = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft, image: draftImage }),
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

  // A plain render function, not a nested component: a component defined here would get a new
  // identity on every keystroke, remounting the list and resetting its scroll position.
  function renderRow(node: CategoryNode, depth: number) {
    const expanded = open[node.slug] ?? false;
    const isEditing = editing === node.id;
    return (
      <div key={node.id}>
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
          {node.image && !isEditing ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[#e6dfd2]">
              <ProductImage src={node.image} alt="" fill sizes="40px" className="object-cover" />
            </div>
          ) : null}
          {isEditing ? (
            <div className="min-w-0 flex-1 space-y-2 py-1">
              <input
                className="input py-1.5 text-sm"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveEdit(node.id);
                  if (e.key === "Escape") setEditing(null);
                }}
              />
              <CategoryImageField value={draftImage} onChange={setDraftImage} />
            </div>
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
                  setDraftImage(node.image ?? "");
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
          ? node.children.map((child) => renderRow(child, depth + 1))
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
        <div className="text-xs">
          <CategoryImageField value={image} onChange={setImage} />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Saving…" : parentSlug ? "Add subcategory" : "Add category"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#eee] bg-white shadow-sm">
        <p className="border-b border-[#f0f0f0] px-4 py-3 text-[15px] font-medium text-[#b0893a]">Product categories</p>
        <div className="max-h-[70vh] overflow-y-auto">
          {tree.map((node) => renderRow(node, 0))}
        </div>
      </div>
    </div>
  );
}
