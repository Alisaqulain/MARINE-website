"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImageIcon, X } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { ImageOverlayText } from "@/components/ImageOverlayText";
import type { ListingImage } from "@/lib/listing-images";
import { resolveMediaUrl } from "@/lib/media-url";

function CameraCapture({
  stream,
  onCapture,
  onClose,
}: {
  stream: MediaStream | null;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(stream ? "" : "Camera permission was blocked. Allow the camera, or use Gallery / files.");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => setError("Camera is not ready. Use Gallery / files."));
    return () => {
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Camera is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not save the photo.");
          return;
        }
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium">Take product photo</p>
        <button type="button" aria-label="Close camera" onClick={onClose} className="rounded-full p-2">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
      </div>
      {error ? <p className="px-4 py-2 text-center text-sm text-red-200">{error}</p> : null}
      <div className="flex justify-center px-4 py-5">
        <button type="button" onClick={snap} className="btn-gold px-8" disabled={Boolean(error)}>
          Use this photo
        </button>
      </div>
    </div>,
    document.body
  );
}

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
  const galleryRef = useRef<HTMLInputElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open the camera here. Use Gallery / files instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setCameraStream(stream);
    } catch {
      setError("Camera permission was blocked. Allow the camera, or use Gallery / files.");
    }
  }

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
          onClick={() => void openCamera()}
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
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        form="marina-image-picker"
        className="hidden"
        onChange={onPickFile}
      />
      {cameraStream ? (
        <CameraCapture
          stream={cameraStream}
          onClose={() => setCameraStream(null)}
          onCapture={(file) => {
            setCameraStream(null);
            const list = new DataTransfer();
            list.items.add(file);
            void onPickFile({ target: { files: list.files, value: "" } } as React.ChangeEvent<HTMLInputElement>);
          }}
        />
      ) : null}
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
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open the camera here. Use Gallery / files instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setCameraStream(stream);
    } catch {
      setError("Camera permission was blocked. Allow the camera, or use Gallery / files.");
    }
  }

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
          onClick={() => void openCamera()}
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
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        form="marina-image-picker"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          if (!files.length) return;
          const transfer = new DataTransfer();
          files.forEach((file) => transfer.items.add(file));
          void addFiles(transfer.files);
        }}
      />
      {cameraStream ? (
        <CameraCapture
          stream={cameraStream}
          onClose={() => setCameraStream(null)}
          onCapture={(file) => {
            setCameraStream(null);
            const transfer = new DataTransfer();
            transfer.items.add(file);
            void addFiles(transfer.files);
          }}
        />
      ) : null}
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
              <ImageOverlayText text={image.text} x={image.textX} y={image.textY} />
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
                onChange={(e) =>
                  update(index, {
                    text: e.target.value,
                    textX: image.textX ?? 50,
                    textY: image.textY ?? 50,
                  })
                }
              />
            </div>
          </div>
          {image.text ? (
            <div className="space-y-1">
              <p className="text-[11px] text-navy-600">Drag the text to place it on the photo.</p>
              <div
                className="relative h-48 cursor-crosshair touch-none overflow-hidden rounded-lg border border-[#e6dfd2] bg-[#f5f5f5]"
                onPointerDown={(e) => {
                  const move = (event: PointerEvent) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const textX = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
                    const textY = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100));
                    update(index, { textX: Math.round(textX), textY: Math.round(textY) });
                  };
                  move(e.nativeEvent);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const target = e.currentTarget;
                  function onMove(event: PointerEvent) {
                    if (event.pointerId !== e.pointerId) return;
                    move(event);
                  }
                  function onUp(event: PointerEvent) {
                    target.removeEventListener("pointermove", onMove);
                    target.removeEventListener("pointerup", onUp);
                    if (event.pointerId === e.pointerId) target.releasePointerCapture(e.pointerId);
                  }
                  target.addEventListener("pointermove", onMove);
                  target.addEventListener("pointerup", onUp);
                }}
              >
                <ProductImage src={image.url} alt="" fill className="object-cover" sizes="400px" />
                <span
                  className="pointer-events-none absolute z-[2] max-w-[90%] -translate-x-1/2 -translate-y-1/2 text-center text-sm font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.65)]"
                  style={{ left: `${image.textX ?? 50}%`, top: `${image.textY ?? 50}%` }}
                >
                  {image.text}
                </span>
              </div>
            </div>
          ) : null}
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
