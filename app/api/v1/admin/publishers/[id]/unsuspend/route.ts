import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/publishers/{id}/unsuspend — api-specification.md §26.5.
 * Maps to `unsuspend_publisher()`. Clears all four suspension columns; the
 * Publisher's `verification_status` is untouched. A call on a not-suspended
 * Publisher returns 409 PUBLISHER_VERIFICATION_STATE_CONFLICT (Phase 9 guard).
 */
export const POST = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/admin/publishers/{id}/unsuspend",
  auth: "ADMIN",
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("unsuspend_publisher", {
      p_publisher_id: params.id,
    });
    if (error) throw pgErrorToApiError(error);
    const publisher = Array.isArray(data) ? data[0] : data;
    return { data: { publisher } };
  },
});
