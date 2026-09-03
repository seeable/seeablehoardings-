import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import {
  emptyListingCounts,
  tallyListingCounts,
  toAdminPublisherRow,
} from "@/lib/admin/projection";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/admin/publishers/{id} — api-specification.md §26.3, AD-03.
 * A VIEWER id (no `publisher_profiles` row) returns 404 PUBLISHER_NOT_FOUND,
 * not a partial record.
 */
export const GET = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/admin/publishers/{id}",
  auth: "ADMIN",
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data: pp, error } = await supabase
      .from("publisher_profiles")
      .select(
        "id, business_name, business_type, verification_status, verified_at, verification_submitted_at, verification_rejection_reason, verification_document_path, suspended, suspended_at, suspension_reason, suspended_by, created_at, profiles!publisher_profiles_id_fkey(full_name, phone, email, city, created_at)",
      )
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw pgErrorToApiError(error);
    if (!pp) throw ApiError.of("PUBLISHER_NOT_FOUND");

    const [{ data: hoardings }, adminLabel] = await Promise.all([
      supabase
        .from("hoardings")
        .select("publisher_id, approval_status")
        .eq("publisher_id", params.id),
      pp.suspended_by
        ? supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", pp.suspended_by)
            .maybeSingle()
            .then((r) => r.data?.full_name ?? r.data?.email ?? "SEEABLE")
        : Promise.resolve(null),
    ]);

    const counts =
      tallyListingCounts(hoardings ?? []).get(params.id) ?? emptyListingCounts();
    const prof = Array.isArray(pp.profiles) ? pp.profiles[0] : pp.profiles;

    return {
      data: {
        publisher: toAdminPublisherRow(
          {
            id: pp.id,
            full_name: prof?.full_name ?? null,
            phone: prof?.phone ?? null,
            email: prof?.email ?? null,
            city: prof?.city ?? null,
            created_at: pp.created_at,
          },
          pp,
          counts,
          adminLabel,
        ),
      },
    };
  },
});
