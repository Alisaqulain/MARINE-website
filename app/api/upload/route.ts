import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { storeImage } from "@/lib/image-upload";

export const runtime = "nodejs";

/** Upload product images — tries KVM POST /upload when configured, else (or on failure) public/uploads. */
export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;

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

    return NextResponse.json(await storeImage(req, bytes, (file as File).name || "upload.jpg"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
