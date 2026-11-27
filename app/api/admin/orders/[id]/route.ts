import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOrderDurable } from "@/lib/orders";
import { reconcilePayPalOrder } from "@/lib/paypal-reconcile";
import { fulfillPaidOrder, markPaidOnce, sendOrderConfirmation } from "@/lib/orders";
import { isSuperAdminEmail } from "@/lib/staff-access";
import { getDb } from "@/lib/mongodb";

/** Admin Orders: "Check PayPal" — asks PayPal for the real payment state and marks the order paid if PayPal has it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await params;
  const order = await getOrderDurable(decodeURIComponent(id));
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const body = await req.json().catch(() => null);

  // Manual confirmation after the admin has checked PayPal → Activity. Main admin only, transaction ID required, audited.
  if (body?.action === "mark_paid") {
    const actor = session?.user?.email || "";
    if (!isSuperAdminEmail(actor)) return NextResponse.json({ error: "Only the main admin can mark an order as paid." }, { status: 403 });
    const txn = String(body?.transactionId ?? "").trim();
    if (!/^[A-Z0-9]{10,25}$/i.test(txn)) return NextResponse.json({ error: "Enter the PayPal transaction ID from PayPal → Activity." }, { status: 400 });
    if (order.status === "paid") return NextResponse.json({ status: "paid", detail: "Already marked paid." });
    const won = await markPaidOnce(order, { paypalCaptureId: txn, paidAt: new Date().toISOString() });
    await (await getDb()).collection("ai_audit").insertOne({ at: new Date().toISOString(), action: "admin_order_mark_paid", actor, orderId: order.id, transactionId: txn, ok: won });
    if (won) {
      await fulfillPaidOrder(order);
      try {
        await sendOrderConfirmation(order);
      } catch {
        console.error("[order-email] confirmation not sent", { orderId: order.id });
      }
    }
    return NextResponse.json({ status: "paid", detail: `Marked paid manually (PayPal ${txn}). Confirmation email ${order.emailSent ? "sent" : "attempted"}.` });
  }

  const result = await reconcilePayPalOrder(order);
  return NextResponse.json({ ...result, orderStatus: order.status }, { status: result.status === "error" ? 502 : 200 });
}
