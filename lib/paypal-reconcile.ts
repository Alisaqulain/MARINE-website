import { fulfillPaidOrder, markPaidOnce, sendOrderConfirmation, type OrderRecord } from "@/lib/orders";
import { captureMatches, capturePayPalOrder, getPayPalOrder } from "@/lib/paypal";

export type ReconcileResult = { status: "paid" | "not_paid" | "mismatch" | "error"; detail: string };

/**
 * Ask PayPal for the real state of an order's payment and fix our record when PayPal has the money.
 * Used when the browser capture call failed half-way (timeout, reload) and from the admin "Check PayPal" button.
 * An approved-but-uncaptured PayPal order is captured here (the buyer already approved it).
 */
export async function reconcilePayPalOrder(order: OrderRecord): Promise<ReconcileResult> {
  if (order.status === "paid") return { status: "paid", detail: "Already marked paid." };
  if (!order.paypalOrderId) return { status: "not_paid", detail: "This order has no PayPal payment." };
  try {
    let data = await getPayPalOrder(order.paypalOrderId);
    if (data.status === "APPROVED") data = await capturePayPalOrder(order.paypalOrderId);
    const check = captureMatches(order.amount, data);
    if (!check.paid) return { status: "not_paid", detail: `PayPal status: ${data.status ?? "unknown"} (no completed payment).` };
    if (!check.amountOk || (check.customId && check.customId !== order.id)) {
      return { status: "mismatch", detail: "PayPal shows a payment, but the amount or order reference does not match. Check it in PayPal." };
    }
    const won = await markPaidOnce(order, { paypalCaptureId: check.captureId, paidAt: new Date().toISOString() });
    if (won) {
      await fulfillPaidOrder(order);
      try {
        await sendOrderConfirmation(order);
      } catch {
        console.error("[order-email] confirmation not sent", { orderId: order.id });
      }
    }
    return { status: "paid", detail: `Payment confirmed by PayPal (capture ${check.captureId}).` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/does not exist|RESOURCE_NOT_FOUND/i.test(message)) {
      return {
        status: "error",
        detail:
          "PayPal cannot find this payment in the PayPal account connected to the website (it was probably made through a different PayPal account/app or in sandbox). Check PayPal → Activity. If the money is there, use “Mark as paid manually” with the PayPal transaction ID.",
      };
    }
    return { status: "error", detail: message.slice(0, 200) || "PayPal check failed." };
  }
}
