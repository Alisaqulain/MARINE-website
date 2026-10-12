"use client";

import { useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { ImageOverlayText } from "@/components/ImageOverlayText";
import type { ListingImage } from "@/lib/listing-images";
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

async function uploadImageFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  const url = data.path ?? data.url;
  if (!url) throw new Error("Upload did not return an image address.");
  return { url: String(url), warning: data.warning ? String(data.warning) : "" };
}

export function AdminProductImagesField({
  images,
  onChange,
}: {
  images: ListingImage[];
  onChange: (images: ListingImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paste, setPaste] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function update(index: number, patch: Partial<ListingImage>) {
    onChange(images.map((image, i) => (i === index ? { ...image, ...patch } : image)));
  }

  async function addFiles(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    setError("");
    setNotice("");
    setUploading(true);
    const added: ListingImage[] = [];
    try {
      for (const file of files) {
        const uploaded = await uploadImageFile(file);
        added.push({ url: uploaded.url, name: "", color: "", text: "" });
        if (uploaded.warning) setNotice(uploaded.warning);
      }
      onChange([...images, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      if (added.length) onChange([...images, ...added]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-navy-600">Product images</span>
      <p className="text-[11px] text-navy-500">
        Add as many photos as you need. Name each one, set the color the buyer picks, and optional text drawn on that photo.
      </p>
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
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <input
          className="input text-sm"
          placeholder="Or paste image URL"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button
          type="button"
          className="btn-outline shrink-0 px-3 text-xs"
          onClick={() => {
            const url = paste.trim();
            if (!url) return;
            onChange([...images, { url, name: "", color: "", text: "" }]);
            setPaste("");
          }}
        >
          Add
        </button>
      </div>
      {images.map((image, index) => (
        <div key={`${image.url}-${index}`} className="space-y-2 rounded-lg border border-[#e6dfd2] p-2">
          <div className="flex items-start gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#e6dfd2] bg-[#f5f5f5]">
              <ProductImage src={image.url} alt={image.name || "Product image"} fill className="object-cover" sizes="80px" />
              <ImageOverlayText text={image.text} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                className="input text-sm"
                placeholder="Image name"
                value={image.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
              <input
                className="input text-sm"
                placeholder="Color (shows in buyer dropdown)"
                value={image.color}
                onChange={(e) => update(index, { color: e.target.value })}
              />
              <input
                className="input text-sm"
                placeholder="Text on this image"
                value={image.text}
                onChange={(e) => update(index, { text: e.target.value })}
              />
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-red-700 underline"
            onClick={() => onChange(images.filter((_, i) => i !== index))}
          >
            Remove image
          </button>
          <p className="truncate text-[10px] text-navy-500" title={image.url}>
            {resolveMediaUrl(image.url)}
          </p>
        </div>
      ))}
      {notice ? <p className="text-xs text-amber-800">{notice}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
