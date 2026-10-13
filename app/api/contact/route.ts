import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { getDb } from "@/lib/mongodb";
import type { ContactMessage } from "@/lib/db/types";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const db = await getDb();

    const doc: Omit<ContactMessage, "_id"> = {
      userId: session?.user?.id ? new ObjectId(session.user.id) : undefined,
      kind: body.kind === "wholesale" ? "wholesale" : "retail",
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      phone: body.phone ? String(body.phone) : undefined,
      company: body.company ? String(body.company) : undefined,
      subject: String(body.subject ?? "General enquiry"),
      message: String(body.message ?? ""),
      createdAt: new Date(),
    };

    if (!doc.name || !doc.email || !doc.message) {
      return NextResponse.json({ error: "Name, email and message are required." }, { status: 400 });
    }

    await db.collection<ContactMessage>("contact_messages").insertOne(doc);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!isDashboardRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const items = await db
    .collection<ContactMessage>("contact_messages")
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return NextResponse.json({
    items: items.map((m) => ({
      id: String(m._id),
      kind: m.kind,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
