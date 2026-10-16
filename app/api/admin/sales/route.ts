import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { loadSales, saleDurationDays, saleNameOk } from "@/lib/sales";

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const items = await loadSales();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Sale details are missing." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const percent = Number(body.percent);
  const region = String(body.region ?? "everywhere").trim() || "everywhere";
  const startsAt = String(body.startsAt ?? "").slice(0, 10);
  const endsAt = String(body.endsAt ?? "").slice(0, 10);
  const terms = String(body.terms ?? "").trim().slice(0, 500);
  const scope = body.scope === "selected" ? "selected" : "all";
  const productSlugs = Array.isArray(body.productSlugs)
    ? [...new Set(body.productSlugs.map((slug: unknown) => String(slug).trim()).filter(Boolean))]
    : [];

  if (!saleNameOk(name)) {
    return NextResponse.json({ error: "Sale name can use only letters and numbers." }, { status: 400 });
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    return NextResponse.json({ error: "Enter a discount between 1 and 99 percent." }, { status: 400 });
  }
  const days = saleDurationDays(startsAt, endsAt);
  if (days == null || days < 0) {
    return NextResponse.json({ error: "Choose a start date and an end date." }, { status: 400 });
  }
  if (days > 30) {
    return NextResponse.json({ error: "A sale can run for up to 30 days." }, { status: 400 });
  }
  if (scope === "selected" && !productSlugs.length) {
    return NextResponse.json({ error: "Choose at least one listing." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection("sales").findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (existing) {
    return NextResponse.json({ error: "That sale name is already used. Choose another." }, { status: 400 });
  }

  const result = await db.collection("sales").insertOne({
    name,
    percent,
    region,
    startsAt,
    endsAt,
    terms,
    scope,
    productSlugs: scope === "all" ? [] : productSlugs,
    createdAt: new Date(),
  });
  return NextResponse.json({ id: String(result.insertedId) });
}

export async function DELETE(req: Request) {
  const { error } = await requireAdminSession("delete");
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid sale." }, { status: 400 });
  }
  const db = await getDb();
  await db.collection("sales").deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}
