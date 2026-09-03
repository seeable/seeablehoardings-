import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/hoardings/{id}/approve — api-specification.md §16.
 * `approve_listing()` is the boundary function (system-architecture.md §44
 * rule 7 — Admin never UPDATEs `hoardings` directly). It notifies the Publisher
 * and writes an `admin_actions` row.
 */
export const POST = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/admin/hoardings/{id}/approve",
  auth: "ADMIN",
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("approve_listing", {
      p_hoarding_id: params.id,
    });
    if (error) throw pgErrorToApiError(error);
    const hoarding = Array.isArray(data) ? data[0] : data;
    return { data: { hoarding } };
  },
});
