import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/v1/hoardings/{id}/availability/blocks/{blockId} — the "unblock"
 * half of PB-05. `hab_delete_own` RLS scopes it to the owning Publisher.
 */
export const DELETE = defineRoute<
  undefined,
  undefined,
  { id: string; blockId: string }
>({
  path: "/api/v1/hoardings/{id}/availability/blocks/{blockId}",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 60 },
  status: 204,
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id) || !UUID.test(params.blockId))
      throw ApiError.of("VALIDATION_ERROR");
    logResource(params.blockId);

    const { data, error } = await supabase
      .from("hoarding_availability_blocks")
      .delete()
      .eq("id", params.blockId)
      .eq("hoarding_id", params.id)
      .select("id");
    if (error) throw pgErrorToApiError(error);
    requireRow(data && data.length ? data[0] : null, "RESOURCE_NOT_FOUND");
    return { data: null };
  },
});
