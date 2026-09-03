import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { optionalReasonSchema } from "@/lib/admin/schema";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/hoardings/{id}/delist — api-specification.md §25.4.
 * Maps to `delist_hoarding()`. `ADMIN-004`: independent of Publisher suspension.
 * `reason` is optional but recommended — `delist_reason` is the only record of
 * why a live listing vanished, and it is what the AD-05 feed carries.
 */
export const POST = defineRoute<undefined, z.infer<typeof optionalReasonSchema>, { id: string }>({
  path: "/api/v1/admin/hoardings/{id}/delist",
  auth: "ADMIN",
  body: optionalReasonSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, body, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("delist_hoarding", {
      p_hoarding_id: params.id,
      p_reason: body.reason,
    });
    if (error) throw pgErrorToApiError(error);
    const hoarding = Array.isArray(data) ? data[0] : data;
    return { data: { hoarding } };
  },
});
