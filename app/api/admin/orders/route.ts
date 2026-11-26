import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { listRecentOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Admin Orders: every order (pending payment, paid, failed), newest first. Never returns the order token. */
export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const orders = await listRecentOrders(500);
  return NextResponse.json({
    items: orders.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt ?? "",
      name: o.name,
      email: o.email,
      phone: o.phone,
      address: o.address,
      city: o.city,
      state: o.state ?? "",
      postal: o.postal,
      country: o.country,
      amount: o.amount,
      currency: o.currency,
      paymentMethod: o.paymentMethod ?? "",
      paymentRef: o.paypalCaptureId || o.razorpayPaymentId || o.paypalOrderId || o.razorpayOrderId || "",
      items: (o.items ?? []).map((i) => ({ slug: i.slug, name: i.name, qty: i.qty, unitPrice: i.unitPrice, b2b: Boolean(i.b2b), personalisation: i.personalisation, message: i.message })),
      stage: o.tracking?.stage ?? "",
      trackingNumber: o.tracking?.trackingNumber ?? "",
      trackingUrl: o.tracking?.trackingUrl ?? "",
      emailSent: Boolean(o.emailSent),
    })),
  });
}
