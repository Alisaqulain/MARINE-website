import { access, readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { labelFilePath } from "@/lib/shipglobal";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const { id } = await params;
  const orderId = decodeURIComponent(id);
  if (!/^[\w-]+$/.test(orderId)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const file = labelFilePath(orderId);
  try {
    await access(file);
  } catch {
    return NextResponse.json({ error: "No ShipGlobal label is saved for this order yet." }, { status: 404 });
  }
  const pdf = await readFile(file);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${orderId}-shipglobal.pdf"`,
    },
  });
}
