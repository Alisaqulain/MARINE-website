import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

type Ctx = { params: Promise<{ path: string[] }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: Request, ctx: Ctx) {
  const segments = (await ctx.params).path;
  if (!segments?.length || segments.some((s) => s.includes(".."))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filename = segments.join("/");
  const filePath = path.join(process.cwd(), "public", "uploads", filename);
  const resolved = path.resolve(filePath);
  const uploadsRoot = path.resolve(path.join(process.cwd(), "public", "uploads"));
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const bytes = await readFile(resolved);
    const ext = path.extname(filename).toLowerCase();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
