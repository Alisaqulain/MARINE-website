import { NextResponse } from "next/server";
import { loadCategoryCatalog } from "@/lib/shop-categories";

export async function GET() {
  const catalog = await loadCategoryCatalog();
  return NextResponse.json(catalog);
}
