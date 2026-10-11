import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/mongodb";
import { ATLAS_CONNECTOR_VERSION } from "@/lib/atlas-connect";

export const dynamic = "force-dynamic";

/** Lightweight liveness + Mongo ping (reuses shared client; read-only). */
export async function GET() {
  const mongo = await pingDatabase();
  const ok = mongo.ok;
  return NextResponse.json(
    {
      ok,
      mongo: {
        connected: mongo.ok,
        connector: ATLAS_CONNECTOR_VERSION,
        maxPoolSize: mongo.maxPoolSize,
        connectionMode: mongo.connectionMode,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
