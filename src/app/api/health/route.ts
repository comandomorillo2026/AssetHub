import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint.
 * Executes a real read-only query against Postgres (Supabase) so that:
 *  1. Uptime monitors can verify the app AND the database are alive.
 *  2. Free-tier databases receive periodic activity and never get paused
 *     for inactivity (see ops-keepalive pinging this endpoint 2x/day).
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "assethub",
      database: "up",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "assethub",
        database: "down",
        error: error instanceof Error ? error.message : "unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
