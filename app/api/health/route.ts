import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health — api-specification.md §29.
 * Bare JSON, NO envelope. Consumed by uptime probes (also the Supabase
 * free-tier pause backstop — IMPLEMENTATION-PLAN.md §Phase 13 / RISK-8).
 * Never exposes internal detail (§29.2).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "unavailable"> = {
    database: "unavailable",
    storage: "unavailable",
  };

  try {
    const supabase = await createClient();

    const dbProbe = await supabase
      .from("hoarding_types")
      .select("code", { head: true, count: "exact" })
      .limit(1);
    // Any response that is not a transport/connection failure counts as reachable;
    // a "relation does not exist" error still means the DB answered.
    if (!dbProbe.error || dbProbe.error.code !== "") {
      checks.database = "ok";
    }

    const storageProbe = await supabase.storage.listBuckets();
    if (!storageProbe.error) {
      checks.storage = "ok";
    }
  } catch {
    // fall through with "unavailable"
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: process.env.NEXT_PUBLIC_ENV ?? "unknown",
      time: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
