import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { optionalReasonSchema } from "@/lib/admin/schema";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/publishers/{id}/reject-verification — api-spec §26.4, AD-03.
 * Maps to `reject_publisher_verification()`. `reason` is optional per the spec
 * (ADMIN-003 governs *listing* rejection only) but recommended — §22.2 returns
 * it to the Publisher, and a rejection with no reason leaves nothing to act on.
 */
export const POST = defineRoute<undefined, z.infer<typeof optionalReasonSchema>, { id: string }>({
  path: "/api/v1/admin/publishers/{id}/reject-verification",
  auth: "ADMIN",
  body: optionalReasonSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, body, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("reject_publisher_verification", {
      p_publisher_id: params.id,
      p_reason: body.reason,
    });
    if (error) throw pgErrorToApiError(error);
    const publisher = Array.isArray(data) ? data[0] : data;
    return { data: { publisher } };
  },
});
