import { access, readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { fetchShipGlobalLabel, labelFilePath } from "@/lib/shipglobal";
import { getOrderDurable, saveOrder } from "@/lib/orders";

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
    // Not saved yet (e.g. the wallet was empty at booking): pay & get the label from ShipGlobal now.
    const order = await getOrderDurable(orderId);
    const tracking = order?.shipment?.waybill || order?.tracking?.trackingNumber || "";
    if (!order || !tracking) {
      return NextResponse.json({ error: "This order has no ShipGlobal tracking number yet. Book it first." }, { status: 404 });
    }
    try {
      await fetchShipGlobalLabel(orderId, tracking);
      if (order.shipment?.error) {
        order.shipment = { ...order.shipment, error: undefined };
        saveOrder(order);
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "ShipGlobal label failed." }, { status: 502 });
    }
  }
  const pdf = await readFile(file);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${orderId}-shipglobal.pdf"`,
    },
  });
}
