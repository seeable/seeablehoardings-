import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { optionalReasonSchema } from "@/lib/admin/schema";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/publishers/{id}/suspend — api-specification.md §26.5.
 * Maps to `suspend_publisher()`. ADMIN-002: blocks new listings, does NOT
 * cancel or alter any request, does NOT delist anything (ADMIN-004). A repeat
 * suspend returns 409 PUBLISHER_VERIFICATION_STATE_CONFLICT (Phase 9 guard).
 */
export const POST = defineRoute<undefined, z.infer<typeof optionalReasonSchema>, { id: string }>({
  path: "/api/v1/admin/publishers/{id}/suspend",
  auth: "ADMIN",
  body: optionalReasonSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, body, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("suspend_publisher", {
      p_publisher_id: params.id,
      p_reason: body.reason,
    });
    if (error) throw pgErrorToApiError(error);
    const publisher = Array.isArray(data) ? data[0] : data;
    return { data: { publisher } };
  },
});
