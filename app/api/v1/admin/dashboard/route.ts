import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { dashboardFromSummary } from "@/lib/admin/projection";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/dashboard — api-specification.md §24.4, AD-01.
 * Maps to `admin_dashboard_summary()` (SECURITY DEFINER). `requests` has no
 * Admin RLS, so the LIVE-campaign count can only come from that aggregate.
 * A moderation dashboard must never show stale numbers — no caching, and
 * `generated_at` tells the operator how fresh they are.
 */
export const GET = defineRoute({
  path: "/api/v1/admin/dashboard",
  auth: "ADMIN",
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase }) => {
    const { data, error } = await supabase.rpc("admin_dashboard_summary");
    if (error) throw pgErrorToApiError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw ApiError.of("INTERNAL_ERROR");
    return { data: dashboardFromSummary(row, new Date().toISOString()) };
  },
});
