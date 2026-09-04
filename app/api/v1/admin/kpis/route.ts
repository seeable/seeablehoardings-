import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { kpisFromRow } from "@/lib/admin/projection";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/kpis — Phase 10, mvp-brd.md §14.
 * Thin facade over `admin_kpis()` (SECURITY DEFINER). Same no-cache posture
 * as /admin/dashboard — a reporting number that's stale is worse than one
 * that's slow.
 */
export const GET = defineRoute({
  path: "/api/v1/admin/kpis",
  auth: "ADMIN",
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase }) => {
    const { data, error } = await supabase.rpc("admin_kpis");
    if (error) throw pgErrorToApiError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw ApiError.of("INTERNAL_ERROR");
    return { data: kpisFromRow(row, new Date().toISOString()) };
  },
});
