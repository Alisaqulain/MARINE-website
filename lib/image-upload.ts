import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  getKvmUploadBase,
  getKvmUploadToken,
  kvmRemoteUploadEnabled,
  sameOriginAsKvm,
} from "@/lib/kvm-upload";

export type StoredImage = { url: string; path?: string; storage: "kvm" | "local"; warning?: string };

async function saveLocal(bytes: Buffer<ArrayBuffer>, filename: string) {
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  /** Served by app/api/media/[...path] — works when nginx does not expose public/uploads. */
  return `/api/media/${filename}`;
}

function requestOrigin(req: Request): string | null {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host.split(",")[0]!.trim()}`;
}

function absolutize(req: Request, relative: string): string {
  const origin = requestOrigin(req);
  return origin ? `${origin}${relative}` : relative;
}

/** Store an image — tries KVM POST /upload when configured, else (or on failure) public/uploads. */
export async function storeImage(req: Request, bytes: Buffer<ArrayBuffer>, original: string): Promise<StoredImage> {
  const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safe}`;
  const kvmBase = getKvmUploadBase();
  const useKvmRemote = kvmRemoteUploadEnabled() && kvmBase && !sameOriginAsKvm(requestOrigin(req), kvmBase);

  if (useKvmRemote && kvmBase) {
    try {
      const remote = new FormData();
      remote.append("file", new Blob([bytes]), filename);
      const headers: HeadersInit = {};
      const kvmToken = getKvmUploadToken();
      if (kvmToken) headers.Authorization = `Bearer ${kvmToken}`;
      const res = await fetch(`${kvmBase}/upload`, {
        method: "POST",
        body: remote,
        headers,
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const data = (await res.json().catch(() => ({}))) as { url?: string };
          if (data.url?.startsWith("http")) return { url: data.url, storage: "kvm" };
        }
      }
      const localUrl = await saveLocal(bytes, filename);
      return {
        url: absolutize(req, localUrl),
        path: localUrl,
        storage: "local",
        warning: `KVM /upload did not return a valid image URL (${res.status}). Saved on this server.`,
      };
    } catch (remoteErr) {
      const localUrl = await saveLocal(bytes, filename);
      const hint = remoteErr instanceof Error ? remoteErr.message : "Could not reach KVM upload URL";
      return {
        url: absolutize(req, localUrl),
        path: localUrl,
        storage: "local",
        warning: `KVM unreachable (${hint}). Image saved on this server.`,
      };
    }
  }

  const localUrl = await saveLocal(bytes, filename);
  return { url: absolutize(req, localUrl), path: localUrl, storage: "local" };
}
