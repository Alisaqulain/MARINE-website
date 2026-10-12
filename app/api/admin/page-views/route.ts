import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listWebsiteVisitors } from "@/lib/page-views";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize")) || 25));
  try {
    const data = await listWebsiteVisitors(page, pageSize);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load visitors.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
