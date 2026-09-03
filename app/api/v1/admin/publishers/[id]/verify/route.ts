import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/publishers/{id}/verify — api-specification.md §26.4, AD-03.
 * Maps to `verify_publisher()`. Sets VERIFIED, clears the rejection reason,
 * writes a PUBLISHER_VERIFIED audit row. Lifts the OWNER-004 submission gate.
 */
export const POST = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/admin/publishers/{id}/verify",
  auth: "ADMIN",
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("verify_publisher", {
      p_publisher_id: params.id,
    });
    if (error) throw pgErrorToApiError(error);
    const publisher = Array.isArray(data) ? data[0] : data;
    return { data: { publisher } };
  },
});
