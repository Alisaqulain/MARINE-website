import { invalidatesCatalog } from "@/lib/storefront-catalog";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import type { AdminProduct, CatalogOverride } from "@/lib/db/types";
import { getDb } from "@/lib/mongodb";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  // Deleting needs the delete permission, as for saved products (DELETE /api/admin/products/[id]).
  const { error } = await requireAdminSession(action === "delete" ? "delete" : "addProduct");
  if (error) return error;
  const rawIds: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  const ids = rawIds.filter((id) => ObjectId.isValid(id));
  // Built-in catalogue items have no Mongo doc; their listing state lives in catalog_overrides.
  const catalogSlugs = rawIds.filter((id) => id.startsWith("catalog-")).map((id) => id.slice("catalog-".length));
  if (!ids.length && !catalogSlugs.length) {
    return NextResponse.json({ error: "Select listings first." }, { status: 400 });
  }

  const now = new Date();
  if (action === "delete") {
    // Built-in catalogue items live in code, so "delete" records a permanent hide in catalog_overrides.
    // Saved (MongoDB) products are deleted through DELETE /api/admin/products/[id] instead.
    if (!catalogSlugs.length) return NextResponse.json({ error: "Select built-in catalogue items." }, { status: 400 });
    const db = await getDb();
    const result = await db.collection<CatalogOverride>("catalog_overrides").bulkWrite(
      catalogSlugs.map((slug) => ({
        updateOne: { filter: { slug }, update: { $set: { slug, active: false, deleted: true, updatedAt: now } }, upsert: true },
      }))
    );
    return NextResponse.json({ ok: true, updated: result.matchedCount + result.upsertedCount });
  }
  const set: Partial<AdminProduct> = { updatedAt: now };
  if (action === "deactivate") set.active = false;
  else if (action === "activate") set.active = true;
  else if (action === "renew") {
    set.active = true;
    const renews = new Date(now);
    renews.setMonth(renews.getMonth() + 4);
    set.renewsAt = renews.toISOString();
  } else if (action === "feature") set.featured = true;
  else if (action === "unfeature") set.featured = false;
  else return NextResponse.json({ error: "Unknown listing action." }, { status: 400 });

  const db = await getDb();
  let updated = 0;
  if (ids.length) {
    const result = await db.collection<AdminProduct>("products").updateMany(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { $set: set }
    );
    updated += result.matchedCount;
  }
  if (catalogSlugs.length) {
    const result = await db.collection<CatalogOverride>("catalog_overrides").bulkWrite(
      catalogSlugs.map((slug) => ({
        updateOne: { filter: { slug }, update: { $set: { slug, ...set } }, upsert: true },
      }))
    );
    updated += result.matchedCount + result.upsertedCount;
  }
  return NextResponse.json({ ok: true, updated });
}

export const POST = invalidatesCatalog(handlePOST);
