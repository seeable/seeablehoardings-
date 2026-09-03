import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/hoardings/{id}/relist — api-specification.md §25.4.
 * Maps to `relist_hoarding()`. RECOMMENDED, not sourced — leaving an Admin no
 * way to undo a mistaken delist is operationally untenable. `approval_status`
 * is untouched by delist, so this restores visibility with no re-approval.
 */
export const POST = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/admin/hoardings/{id}/relist",
  auth: "ADMIN",
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { data, error } = await supabase.rpc("relist_hoarding", {
      p_hoarding_id: params.id,
    });
    if (error) throw pgErrorToApiError(error);
    const hoarding = Array.isArray(data) ? data[0] : data;
    return { data: { hoarding } };
  },
});
