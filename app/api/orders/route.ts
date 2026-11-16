import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrdersByEmail, publicOrder } from "@/lib/orders";

/**
 * Phase 2 commerce 2: paid orders for the signed-in customer only. The email must belong to the session; anonymous
 * callers get 401 and another person's email gets 404 (no enumeration). Reads the database.
 */
export async function GET(req: Request) {
  const session = await auth();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || "";
  if (!sessionEmail) return NextResponse.json({ error: "Please sign in to see your orders." }, { status: 401 });
  const email = (new URL(req.url).searchParams.get("email") ?? sessionEmail).trim().toLowerCase();
  if (email !== sessionEmail) return NextResponse.json({ error: "No orders found." }, { status: 404 });
  try {
    const orders = await getOrdersByEmail(sessionEmail);
    return NextResponse.json({ orders: orders.map(publicOrder) });
  } catch {
    return NextResponse.json({ error: "Orders are unavailable right now." }, { status: 503 });
  }
}
