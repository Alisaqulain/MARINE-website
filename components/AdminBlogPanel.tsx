"use client";

import { ArrowLeft, Eye, Pencil, Plus, Tags, Trash2, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { uploadImageFile } from "@/components/AdminProductImageField";
import { BlogVisualEditor } from "@/components/BlogVisualEditor";
import type { AdminBlogPost } from "@/lib/blog-store";
import type { BlogCategory } from "@/lib/blog";

type Draft = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  image: string;
  body: string;
  category: string;
  link: string;
  linkNewTab: boolean;
  published: boolean;
};

const EMPTY: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  date: "",
  image: "",
  body: "",
  category: "",
  link: "",
  linkNewTab: true,
  published: true,
};

const EXCERPT_MAX = 160;
const PAGE_SIZE = 10;

export function AdminBlogPanel({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    const [data, cats] = await Promise.all([
      fetch("/api/admin/blog")
        .then((res) => res.json())
        .catch(() => ({})),
      fetch("/api/admin/blog/categories")
        .then((res) => res.json())
        .catch(() => ({})),
    ]);
    setPosts(Array.isArray(data.items) ? data.items : []);
    setCategories(Array.isArray(cats.items) ? cats.items : []);
    if (typeof data.error === "string") setError(data.error);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(post: AdminBlogPost) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(typeof data.error === "string" ? data.error : "Could not delete the post.");
      return;
    }
    await load();
  }

  if (draft) {
    return (
      <BlogEditor
        initial={draft}
        categories={categories}
        onCancel={() => setDraft(null)}
        onSaved={async () => {
          setDraft(null);
          await load();
        }}
      />
    );
  }

  const categoryName = (slug?: string) => categories.find((c) => c.slug === slug)?.name ?? "—";
  const pages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = posts.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eee] bg-white p-5">
        <div>
          <h2 className="text-2xl font-semibold text-navy-900">Blog Management</h2>
          <p className="text-sm text-navy-600">Write, edit, publish or hide articles shown on /blog.</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCategories((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e6dfd2] bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:border-[#C9A84C]"
            >
              <Tags className="h-4 w-4" /> Categories
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY, category: categories[0]?.slug ?? "" })}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#031D38] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3358]"
            >
              <Plus className="h-4 w-4" /> Add New Blog
            </button>
          </div>
        ) : null}
      </div>

      {showCategories && canEdit ? (
        <CategoryManager categories={categories} canDelete={canDelete} onChange={load} onClose={() => setShowCategories(false)} />
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="px-2 text-sm text-navy-600">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-navy-600">No blog posts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#eee] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#f3efe7] bg-[#faf8f4] text-xs font-semibold text-navy-700">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((post, i) => (
                  <tr key={post.id} className="border-b border-[#f3efe7] last:border-0">
                    <td className="px-4 py-3 text-navy-600">{(current - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-[#f6f3ec]">
                          {post.image ? <ProductImage src={post.image} alt="" fill sizes="64px" className="object-cover" /> : null}
                        </div>
                        <span className="line-clamp-2 max-w-[260px] text-navy-900">{post.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-navy-700">{categoryName(post.category)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          post.published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-navy-700">{post.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {post.published ? (
                          <Link
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            aria-label="View post"
                            className="grid h-8 w-8 place-items-center rounded-full text-navy-700 hover:bg-[#faf8f4]"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            aria-label="Edit post"
                            onClick={() =>
                              setDraft({
                                id: post.id,
                                title: post.title,
                                slug: post.slug,
                                excerpt: post.excerpt,
                                date: post.date,
                                image: post.image,
                                body: post.body.join("\n\n"),
                                category: post.category ?? "",
                                link: post.link ?? "",
                                linkNewTab: post.linkNewTab !== false,
                                published: post.published,
                              })
                            }
                            className="grid h-8 w-8 place-items-center rounded-full text-navy-800 hover:bg-[#faf8f4]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            aria-label="Delete post"
                            onClick={() => void remove(post)}
                            className="grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-[#faf8f4]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#f3efe7] px-4 py-3 text-xs text-navy-600">
            <span>
              Showing {(current - 1) * PAGE_SIZE + 1}–{(current - 1) * PAGE_SIZE + shown.length} of {posts.length} articles
            </span>
            {pages > 1 ? (
              <div className="flex gap-1">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`grid h-7 w-7 place-items-center rounded ${
                      n === current ? "bg-[#B8892F] font-semibold text-white" : "hover:bg-[#faf8f4]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryManager({
  categories,
  canDelete,
  onChange,
  onClose,
}: {
  categories: BlogCategory[];
  canDelete: boolean;
  onChange: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body?: unknown) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save the category.");
        return false;
      }
      await onChange();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#eee] bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-navy-900">Blog categories</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#faf8f4]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/admin/blog/categories", "POST", { name })) setName("");
        }}
      >
        <input className="input flex-1" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={busy || !name.trim()} className="rounded-md bg-[#031D38] px-4 text-sm font-medium text-white disabled:opacity-50">
          Add
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <ul className="mt-4 divide-y divide-[#f3efe7]">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            {editing?.id === c.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await send(`/api/admin/blog/categories/${c.id}`, "PATCH", { name: editing.name })) setEditing(null);
                }}
              >
                <input className="input flex-1" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <button type="submit" disabled={busy} className="rounded-md bg-[#031D38] px-3 text-sm text-white">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-md border px-3 text-sm">
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm text-navy-900">{c.name}</span>
                <button
                  type="button"
                  aria-label={`Rename ${c.name}`}
                  onClick={() => setEditing({ id: c.id, name: c.name })}
                  className="grid h-8 w-8 place-items-center rounded-full text-navy-800 hover:bg-[#faf8f4]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete category “${c.name}”? Its articles stay published under “All”.`)) {
                        void send(`/api/admin/blog/categories/${c.id}`, "DELETE");
                      }
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-[#faf8f4]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlogEditor({
  initial,
  categories,
  onCancel,
  onSaved,
}: {
  initial: Draft;
  categories: BlogCategory[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "publish">("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  async function save(published: boolean) {
    setError("");
    if (!draft.title.trim()) return setError("Enter a blog title.");
    if (published) {
      if (!draft.category) return setError("Choose a category.");
      if (!draft.excerpt.trim()) return setError("Write a short description.");
      if (!draft.image) return setError("Add a featured image.");
      if (!draft.body.replace(/<(?!img|div data-product)[^>]*>|&nbsp;/g, "").trim()) return setError("Write the article content.");
    }
    setBusy(published ? "publish" : "draft");
    try {
      const res = await fetch(draft.id ? `/api/admin/blog/${draft.id}` : "/api/admin/blog", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save the post.");
        return;
      }
      await onSaved();
    } finally {
      setBusy("");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return null;
    setUploading(true);
    setError("");
    try {
      return (await uploadImageFile(file)).url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }

  const label = "mb-1 block text-xs font-semibold text-navy-900";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-sm md:p-6">
      <button type="button" onClick={onCancel} className="mb-3 inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" /> Back to all posts
      </button>
      <h2 className="text-xl font-semibold text-navy-900">{draft.id ? "Edit Blog" : "Add New Blog"}</h2>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <label className="block text-sm">
            <span className={label}>Blog Title *</span>
            <input className="input" placeholder="Enter blog title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className={label}>Category *</span>
            <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className={label}>Short Description *</span>
          <textarea
            className="input min-h-20"
            maxLength={EXCERPT_MAX}
            placeholder="Write a short description (for listing page)…"
            value={draft.excerpt}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
          />
          <span className="mt-1 block text-right text-[11px] text-navy-500">
            {draft.excerpt.length}/{EXCERPT_MAX}
          </span>
        </label>

        <div className="text-sm">
          <span className={label}>Featured Image *</span>
          <button
            type="button"
            disabled={uploading}
            onClick={() => coverRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragging(false);
              const url = await upload(e.dataTransfer.files?.[0]);
              if (url) setDraft((d) => ({ ...d, image: url }));
            }}
            className={`relative flex min-h-36 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs text-navy-600 ${
              dragging ? "border-[#C9A84C] bg-[#FFFBF3]" : "border-[#e6dfd2] bg-[#faf8f4]"
            }`}
          >
            {draft.image ? (
              <ProductImage src={draft.image} alt="" fill sizes="768px" className="object-cover opacity-90" />
            ) : null}
            <span className="relative flex flex-col items-center gap-1 rounded-lg bg-white/85 px-4 py-2">
              <UploadCloud className="h-6 w-6 text-[#B8892F]" />
              {uploading ? "Uploading…" : draft.image ? "Click or drop to replace" : "Click to upload or drag and drop"}
              <span className="text-[11px] text-navy-500">(Recommended size: 1200 × 630)</span>
            </span>
          </button>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              const url = await upload(file);
              if (url) setDraft((d) => ({ ...d, image: url }));
            }}
          />
          <input
            className="input mt-2 text-xs"
            placeholder="Or paste image URL"
            value={draft.image}
            onChange={(e) => setDraft({ ...draft, image: e.target.value })}
          />
        </div>

        <div className="text-sm">
          <span className={label}>Content *</span>
          <BlogVisualEditor
            value={draft.body}
            onChange={(html) => setDraft((d) => ({ ...d, body: html }))}
            uploadImage={upload}
          />
          <p className="mt-1 text-[11px] text-navy-500">
            Select text, then use the toolbar: bold, italic, underline, alignment, headings, quotes, lists, links, images
            and product boxes. What you see here is how the article looks.
          </p>
        </div>

        <div className="text-sm">
          <span className={label}>Add Link (Optional)</span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input flex-1"
              placeholder="Paste product or external link here"
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
            />
            <label className="inline-flex items-center gap-2 text-xs text-navy-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={draft.linkNewTab}
                onChange={(e) => setDraft({ ...draft, linkNewTab: e.target.checked })}
              />
              Open in new tab
            </label>
          </div>
          <span className="mt-1 block text-[11px] text-navy-500">
            A link to one of our product pages shows as a “Recommended Product” box.
          </span>
        </div>

        <label className="block text-sm">
          <span className={label}>Page URL (optional)</span>
          <input
            className="input text-xs"
            placeholder="Made from the title if empty, e.g. caring-for-brass"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            disabled={Boolean(busy) || uploading}
            onClick={() => void save(false)}
            className="rounded-md border border-[#cfc6b4] bg-white px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-[#faf8f4] disabled:opacity-60"
          >
            {busy === "draft" ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || uploading}
            onClick={() => void save(true)}
            className="rounded-md bg-[#031D38] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0a3358] disabled:opacity-60"
          >
            {busy === "publish" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
