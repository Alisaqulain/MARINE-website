"use client";

import { useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4"
        >
          <Camera className="h-4 w-4 shrink-0" />
          {uploading ? "Uploading…" : "Camera"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4"
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          Gallery / files
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        className="hidden"
        onChange={onPickFile}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onPickFile}
      />
      <p className="text-[11px] text-navy-500">Use Gallery on phones to pick existing photos. JPG, PNG, or WebP.</p>
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
