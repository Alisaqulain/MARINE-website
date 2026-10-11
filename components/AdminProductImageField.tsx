"use client";

import { useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { resolveMediaUrl } from "@/lib/media-url";

export function AdminProductImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      let res: Response;
      try {
        res = await fetch("/api/upload", { method: "POST", body });
      } catch {
        setError(
          "Network error — could not reach /api/upload. Check that the site is running and you are logged in as admin."
        );
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      const url = data.path ?? data.url;
      if (url) onChange(String(url));
      else if (data.url) onChange(String(data.url));
      if (data.warning) setNotice(String(data.warning));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-navy-600">Product image</span>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#C9A84C]/50 bg-[#FAF7F2] px-4 py-6 text-center transition hover:border-[#C9A84C]">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          className="sr-only"
          onChange={onPickFile}
        />
        <span className="text-sm font-medium text-navy-800">{uploading ? "Uploading…" : "Take photo or upload"}</span>
        <span className="mt-1 text-[11px] text-navy-500">Camera, gallery, or JPG / PNG / WebP</span>
      </label>
      {value ? (
        <div className="flex items-start gap-3">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-[#e6dfd2]">
            <ProductImage src={value} alt="" fill className="object-cover" sizes="96px" />
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-red-700 underline"
            onClick={() => onChange("")}
          >
            Remove image
          </button>
        </div>
      ) : null}
      {value ? (
        <p className="truncate text-[10px] text-navy-500" title={value}>
          {resolveMediaUrl(value)}
        </p>
      ) : null}
      <input
        className="input text-sm"
        placeholder="Or paste image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {notice ? <p className="text-xs text-amber-800">{notice}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
