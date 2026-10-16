import { NextResponse } from "next/server";
import { getOrderDurable, publicOrder } from "@/lib/orders";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const order = await getOrderDurable(id);
  if (!order || order.token !== token) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ order: publicOrder(order) });
}
