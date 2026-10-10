import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getKvmUploadBase, getKvmUploadToken } from "@/lib/kvm-upload";

export const runtime = "nodejs";

async function saveLocal(bytes: Buffer, filename: string) {
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

/** Upload product images — tries KVM POST /upload when configured, else (or on failure) public/uploads. */
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kvmBase = getKvmUploadBase();
  const kvmToken = getKvmUploadToken();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const maxMb = 12;
    if (bytes.length > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: `Image must be under ${maxMb} MB` }, { status: 400 });
    }

    const original = (file as File).name || "upload.jpg";
    const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}-${safe}`;

    if (kvmBase) {
      try {
        const remote = new FormData();
        remote.append("file", new Blob([bytes]), filename);
        const headers: HeadersInit = {};
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
            if (data.url?.startsWith("http")) {
              return NextResponse.json({ url: data.url, storage: "kvm" });
            }
          }
        }
        const text = res.ok ? "invalid JSON (no url)" : (await res.text()).slice(0, 300);
        const localUrl = await saveLocal(bytes, filename);
        return NextResponse.json({
          url: absolutize(req, localUrl),
          path: localUrl,
          storage: "local",
          warning: `KVM /upload did not return a valid image URL (${res.status}). Saved on this server.`,
        });
      } catch (remoteErr) {
        const localUrl = await saveLocal(bytes, filename);
        const hint =
          remoteErr instanceof Error ? remoteErr.message : "Could not reach KVM upload URL";
        return NextResponse.json({
          url: absolutize(req, localUrl),
          path: localUrl,
          storage: "local",
          warning: `KVM unreachable (${hint}). Image saved on this server.`,
        });
      }
    }

    const localUrl = await saveLocal(bytes, filename);
    return NextResponse.json({ url: absolutize(req, localUrl), path: localUrl, storage: "local" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
