import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { rejectListingSchema } from "@/lib/inventory/schema";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/hoardings/{id}/reject — api-specification.md §16.
 * Reason is mandatory (ADMIN-003). `reject_listing()` sets REJECTED + reason,
 * notifies the Publisher, and logs the action. The Publisher edits the same
 * record and resubmits (api-spec §12.5).
 */
export const POST = defineRoute<undefined, z.infer<typeof rejectListingSchema>, { id: string }>({
  path: "/api/v1/admin/hoardings/{id}/reject",
  auth: "ADMIN",
  body: rejectListingSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, body, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("reject_listing", {
      p_hoarding_id: params.id,
      p_reason: body.reason,
    });
    if (error) throw pgErrorToApiError(error);
    const hoarding = Array.isArray(data) ? data[0] : data;
    return { data: { hoarding } };
  },
});
