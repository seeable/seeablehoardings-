/**
 * The owner/Admin listing projection — api-specification.md §11.3.
 *
 * `submission_readiness.blockers` mirrors gates 4–9 of
 * `submit_hoarding_for_review()` (database-design.md §41.7) so the wizard's
 * Step-6 checklist and a `409` at submit render from the same shape. Gates 1–3
 * (exists / owns / state) are the route's job, not a blocker.
 *
 * Every read here is one the owning Publisher (or an Admin) can already make
 * under RLS — this runs as the caller's JWT, never the service role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ERROR_MESSAGE } from "@/lib/api/errors";
import { MEDIA_MIN_TO_SUBMIT, PUBLIC_BUCKET } from "@/lib/inventory/media";
import type {
  Blocker,
  HoardingOwnerView,
  HoardingRow,
  MediaAsset,
} from "@/lib/inventory/types";

type Supa = SupabaseClient<Database>;

export function mediaUrl(supabase: Supa, storagePath: string): string {
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

export async function buildOwnerView(
  supabase: Supa,
  hoarding: HoardingRow,
): Promise<HoardingOwnerView> {
  const [typeRes, mediaRes, ppRes, pendingRes] = await Promise.all([
    supabase
      .from("hoarding_types")
      .select("display_name, is_digital, required_attribute_keys")
      .eq("code", hoarding.type_code)
      .maybeSingle(),
    supabase
      .from("hoarding_media")
      .select(
        "id, media_type, storage_path, is_primary, display_order, processing_status, watermarked_at, created_at",
      )
      .eq("hoarding_id", hoarding.id)
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true }),
    supabase
      .from("publisher_profiles")
      .select("verification_status, suspended")
      .eq("id", hoarding.publisher_id)
      .maybeSingle(),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("hoarding_id", hoarding.id)
      .eq("status", "REQUESTED"),
  ]);

  const requiredKeys: string[] =
    typeRes.data?.required_attribute_keys ?? [];
  const attributes = (hoarding.attributes ?? {}) as Record<string, unknown>;
  const missingAttributeKeys = requiredKeys.filter((k) => {
    const v = attributes[k];
    return v === undefined || v === null || v === "";
  });

  const media: MediaAsset[] = (mediaRes.data ?? []).map((m) => ({
    id: m.id,
    media_type: m.media_type,
    url:
      m.processing_status === "WATERMARKED"
        ? mediaUrl(supabase, m.storage_path)
        : null,
    is_primary: m.is_primary,
    display_order: m.display_order,
    processing_status: m.processing_status,
    watermarked_at: m.watermarked_at,
    has_original: false, // Variant B keeps no original at MVP (api-spec §14.2)
    created_at: m.created_at,
  }));

  const pendingCount = pendingRes.count ?? 0;
  const watermarkedCount = media.filter(
    (m) => m.processing_status === "WATERMARKED",
  ).length;
  const processingCount = media.filter(
    (m) => m.processing_status !== "WATERMARKED" && m.processing_status !== "FAILED",
  ).length;
  const failedCount = media.filter(
    (m) => m.processing_status === "FAILED",
  ).length;

  const blockers: Blocker[] = [];
  const push = (code: string, message?: string) =>
    blockers.push({ code, message: message ?? ERROR_MESSAGE[code as never] ?? code });

  if (ppRes.data?.verification_status !== "VERIFIED") {
    push(
      "PUBLISHER_NOT_VERIFIED",
      "Your publisher account must be verified before this listing can go live.",
    );
  }
  if (ppRes.data?.suspended) push("PUBLISHER_SUSPENDED");
  if (hoarding.price == null || hoarding.latitude == null || hoarding.longitude == null) {
    push("HOARDING_MISSING_CORE_FIELDS");
  }
  if (missingAttributeKeys.length > 0) {
    push(
      "HOARDING_INCOMPLETE_ATTRIBUTES",
      `Missing ${missingAttributeKeys.length} required field${missingAttributeKeys.length > 1 ? "s" : ""} for this hoarding type.`,
    );
  }
  if (media.length === 0) {
    push("HOARDING_MISSING_MEDIA");
  } else if (failedCount > 0) {
    push(
      "MEDIA_PROCESSING_FAILED",
      `${failedCount} photo${failedCount > 1 ? "s" : ""} failed to process — delete and re-upload.`,
    );
  } else if (processingCount > 0 || watermarkedCount < MEDIA_MIN_TO_SUBMIT) {
    push(
      "HOARDING_MEDIA_NOT_WATERMARKED",
      `${Math.max(processingCount, 1)} photo${processingCount > 1 ? "s" : ""} still processing.`,
    );
  }

  return {
    ...hoarding,
    type: {
      code: hoarding.type_code,
      display_name: typeRes.data?.display_name ?? hoarding.type_code,
      is_digital: typeRes.data?.is_digital ?? false,
    },
    media,
    missing_attribute_keys: missingAttributeKeys,
    submission_readiness: {
      is_submittable: blockers.length === 0,
      blockers,
    },
    pending_request_count: pendingCount,
    is_edit_frozen: pendingCount > 0,
  };
}
