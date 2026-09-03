import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { buildOwnerView } from "@/lib/inventory/projection";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/hoardings/{id}/submit — api-specification.md §12.5.
 * `submit_hoarding_for_review()` is the transactional authority for the gate
 * (DRAFT/REJECTED -> PENDING_REVIEW). On a gate failure we enrich the error with
 * the actionable detail the Publisher needs (which attribute keys, how many
 * photos still processing) — the codes themselves come straight from the D7
 * SEEABLE_CODE tags.
 */
export const POST = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/hoardings/{id}/submit",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 30 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data, error } = await supabase.rpc("submit_hoarding_for_review", {
      p_hoarding_id: params.id,
    });

    if (error) {
      const mapped = pgErrorToApiError(error);
      throw await enrich(supabase, params.id, mapped);
    }

    const hoarding = Array.isArray(data) ? data[0] : data;
    return { data: { hoarding: await buildOwnerView(supabase, hoarding) } };
  },
});

async function enrich(
  supabase: Parameters<typeof buildOwnerView>[0],
  hoardingId: string,
  err: ApiError,
): Promise<ApiError> {
  if (err.code === "HOARDING_INCOMPLETE_ATTRIBUTES") {
    const { data: h } = await supabase
      .from("hoardings")
      .select("type_code")
      .eq("id", hoardingId)
      .maybeSingle();
    const [{ data: missing }, { data: type }] = await Promise.all([
      supabase.rpc("hoarding_missing_attribute_keys", {
        p_hoarding_id: hoardingId,
      }),
      supabase
        .from("hoarding_types")
        .select("required_attribute_keys")
        .eq("code", h?.type_code ?? "")
        .maybeSingle(),
    ]);
    return new ApiError(err.code, err.message, err.status, {
      type_code: h?.type_code,
      required_attribute_keys: type?.required_attribute_keys ?? [],
      missing_attribute_keys: missing ?? [],
    });
  }

  if (
    err.code === "HOARDING_MEDIA_NOT_WATERMARKED" ||
    err.code === "MEDIA_PROCESSING_FAILED"
  ) {
    const { data: media } = await supabase
      .from("hoarding_media")
      .select("processing_status")
      .eq("hoarding_id", hoardingId);
    const rows = media ?? [];
    const failed = rows.filter((m) => m.processing_status === "FAILED").length;
    const pending = rows.filter(
      (m) =>
        m.processing_status !== "WATERMARKED" &&
        m.processing_status !== "FAILED",
    ).length;
    return new ApiError(err.code, err.message, err.status, {
      total_media: rows.length,
      pending_media: pending,
      failed_media: failed,
      retryable: failed === 0,
    });
  }

  return err;
}
