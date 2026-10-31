import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDashboardRole } from "@/lib/staff-access";
import { getDb } from "@/lib/mongodb";
import type { Testimonial } from "@/lib/db/types";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const isAdmin = isDashboardRole(session?.user?.role);
    const homeOnly = new URL(req.url).searchParams.get("home") === "1";
    const db = await getDb();
    let filter: Record<string, unknown> = {};
    if (!isAdmin) {
      filter = {
        published: true,
        $or: [{ showOnHome: true }, { showOnHome: { $exists: false } }],
      };
    } else if (homeOnly) {
      filter = {
        published: true,
        $or: [{ showOnHome: true }, { showOnHome: { $exists: false } }],
      };
    }
    const items = await db
      .collection<Testimonial>("testimonials")
      .find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(isAdmin ? 200 : 12)
      .toArray();
    return NextResponse.json({
      items: items.map((t) => ({
        id: String(t._id),
        title: t.title,
        body: t.body,
        name: t.name,
        location: t.location,
        product: t.product,
        published: t.published,
        showOnHome: t.showOnHome !== false,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load testimonials";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isDashboardRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const db = await getDb();
  const doc: Omit<Testimonial, "_id"> = {
    title: String(body.title ?? ""),
    body: String(body.body ?? ""),
    name: String(body.name ?? ""),
    location: String(body.location ?? ""),
    product: String(body.product ?? ""),
    published: body.published !== false,
    showOnHome: body.showOnHome !== false,
    sortOrder: Number(body.sortOrder ?? 0),
    createdAt: new Date(),
  };
  const result = await db.collection<Testimonial>("testimonials").insertOne(doc);
  return NextResponse.json({ id: String(result.insertedId) });
}
