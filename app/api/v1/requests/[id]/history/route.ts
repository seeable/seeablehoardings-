import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { toHistoryEntries } from "@/lib/requests/projection";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/requests/{id}/history — api-specification.md §21.3. The owning
 * Viewer, the owning Publisher, or an Admin (matches `rsh_select_via_request`).
 * `get_request_history()` is `SECURITY DEFINER` — it gates the caller and
 * resolves the counterparty's role, which `profiles` RLS otherwise forbids.
 * `changed_by: null` → a pg_cron transition; surfaced as `note: "system"`.
 */
export const GET = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/requests/{id}/history",
  auth: true,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data, error } = await supabase.rpc("get_request_history", {
      p_request_id: params.id,
    });
    if (error) throw pgErrorToApiError(error);

    return {
      data: {
        request_id: params.id,
        history: toHistoryEntries(data ?? []),
      },
    };
  },
});
