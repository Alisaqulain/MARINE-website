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
  return `/uploads/${filename}`;
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
          const data = (await res.json().catch(() => ({}))) as { url?: string };
          const url = data.url ?? `${kvmBase}/files/${filename}`;
          return NextResponse.json({ url, storage: "kvm" });
        }
        const text = (await res.text()).slice(0, 300);
        const localUrl = await saveLocal(bytes, filename);
        return NextResponse.json({
          url: localUrl,
          storage: "local",
          warning: `KVM upload returned ${res.status}. Saved locally instead. ${text}`,
        });
      } catch (remoteErr) {
        const localUrl = await saveLocal(bytes, filename);
        const hint =
          remoteErr instanceof Error ? remoteErr.message : "Could not reach KVM upload URL";
        return NextResponse.json({
          url: localUrl,
          storage: "local",
          warning: `KVM unreachable (${hint}). Image saved on this server at ${localUrl}. Fix KVM2_UPLOAD_URL or add POST ${kvmBase}/upload on your host.`,
        });
      }
    }

    const localUrl = await saveLocal(bytes, filename);
    return NextResponse.json({ url: localUrl, storage: "local" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
