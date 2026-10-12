import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireAdminSession() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { session: null as null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null as null };
}
