"use client";

import { ExternalLink, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { uploadImageFile } from "@/components/AdminProductImageField";
import type { AdminBlogPost } from "@/lib/blog-store";

type Draft = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  image: string;
  body: string;
  published: boolean;
};

const EMPTY: Draft = { title: "", slug: "", excerpt: "", date: "", image: "", body: "", published: true };

export function AdminBlogPanel({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const data = await fetch("/api/admin/blog")
      .then((res) => res.json())
      .catch(() => ({}));
    setPosts(Array.isArray(data.items) ? data.items : []);
    if (typeof data.error === "string") setError(data.error);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(post: AdminBlogPost) {
    setError("");
    setDraft({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      date: post.date,
      image: post.image,
      body: post.body.join("\n\n"),
      published: post.published,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(draft.id ? `/api/admin/blog/${draft.id}` : "/api/admin/blog", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save the post.");
        return;
      }
      setDraft(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

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

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadImageFile(file);
      setDraft((current) => (current ? { ...current, image: uploaded.url } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (draft) {
    return (
      <form onSubmit={save} className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-5 shadow-sm md:p-6">
        <h2 className="font-serif text-2xl text-navy-900">{draft.id ? "Edit blog post" : "New blog post"}</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-navy-900">Title</span>
          <input className="input" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-navy-900">Page URL (optional)</span>
          <span className="mb-1 block text-xs text-navy-600">Left empty, it is made from the title: /blog/your-title</span>
          <input className="input" placeholder="e.g. caring-for-brass" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-navy-900">Short summary</span>
          <span className="mb-1 block text-xs text-navy-600">Shown on the blog list card.</span>
          <textarea className="input min-h-20" maxLength={300} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-navy-900">Date shown</span>
            <input className="input" placeholder="Today if empty" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
            Published (visible on the website)
          </label>
        </div>
        <div className="space-y-2 text-sm">
          <span className="block font-semibold text-navy-900">Cover image</span>
          <div className="flex flex-wrap items-center gap-3">
            {draft.image ? (
              <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-[#e6dfd2]">
                <ProductImage src={draft.image} alt="" fill sizes="128px" className="object-cover" />
              </div>
            ) : null}
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-4 py-2.5 text-sm font-medium text-navy-800 disabled:opacity-60"
            >
              <ImageIcon className="h-4 w-4" />
              {uploading ? "Uploading…" : draft.image ? "Change image" : "Upload image"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={onImage} />
          </div>
          <input className="input text-sm" placeholder="Or paste image URL" value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} />
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-navy-900">Article</span>
          <span className="mb-1 block text-xs text-navy-600">Leave an empty line between paragraphs.</span>
          <textarea className="input min-h-64 leading-relaxed" required value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-full bg-[#031D38] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0a3358]"
            onClick={() => {
              setDraft(null);
              setError("");
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn-gold flex-1" disabled={busy || uploading}>
            {busy ? "Saving…" : draft.id ? "Save changes" : "Publish post"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eee] bg-white p-5">
        <div>
          <h2 className="font-serif text-2xl text-navy-900">Blog</h2>
          <p className="text-sm text-navy-600">Write, edit or hide articles shown on /blog.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn-gold inline-flex items-center gap-1.5 px-5 py-2 text-sm" onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="h-4 w-4" /> New post
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="px-2 text-sm text-navy-600">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-navy-600">No blog posts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#eee] bg-white">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-3 border-b border-[#f3efe7] px-4 py-3 last:border-0">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[#f6f3ec]">
                {post.image ? <ProductImage src={post.image} alt="" fill sizes="80px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">{post.title}</p>
                <p className="truncate text-xs text-navy-600">
                  {post.date} · /blog/{post.slug}
                  {post.published ? "" : " · Hidden"}
                </p>
              </div>
              {post.published ? (
                <Link href={`/blog/${post.slug}`} target="_blank" aria-label="View post" className="grid h-8 w-8 place-items-center rounded-full text-navy-600 hover:bg-[#faf8f4]">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null}
              {canEdit ? (
                <button type="button" aria-label="Edit post" onClick={() => edit(post)} className="grid h-8 w-8 place-items-center rounded-full text-navy-800 hover:bg-[#faf8f4]">
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" aria-label="Delete post" onClick={() => void remove(post)} className="grid h-8 w-8 place-items-center rounded-full text-red-700 hover:bg-[#faf8f4]">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
