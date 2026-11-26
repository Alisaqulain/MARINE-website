import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOrderDurable } from "@/lib/orders";
import { reconcilePayPalOrder } from "@/lib/paypal-reconcile";

/** Admin Orders: "Check PayPal" — asks PayPal for the real payment state and marks the order paid if PayPal has it. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await params;
  const order = await getOrderDurable(decodeURIComponent(id));
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const result = await reconcilePayPalOrder(order);
  return NextResponse.json({ ...result, orderStatus: order.status }, { status: result.status === "error" ? 502 : 200 });
}
