import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateMediaSchema } from "@/lib/inventory/schema";
import { PUBLIC_BUCKET } from "@/lib/inventory/media";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = { id: string; mediaId: string };

/**
 * PATCH /api/v1/hoardings/{id}/media/{mediaId} — api-specification.md §14.5.
 * Exactly `is_primary` / `display_order` (the two client-grantable columns).
 * Setting `is_primary: true` clears it on every other asset of the listing.
 */
export const PATCH = defineRoute<undefined, z.infer<typeof updateMediaSchema>, Params>({
  path: "/api/v1/hoardings/{id}/media/{mediaId}",
  auth: "PUBLISHER",
  body: updateMediaSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, body, logResource }) => {
    if (!UUID.test(params.id) || !UUID.test(params.mediaId))
      throw ApiError.of("VALIDATION_ERROR");
    logResource(params.mediaId);

    const { data: media, error: mErr } = await supabase
      .from("hoarding_media")
      .select("id, hoarding_id")
      .eq("id", params.mediaId)
      .eq("hoarding_id", params.id)
      .maybeSingle();
    if (mErr) throw pgErrorToApiError(mErr);
    requireRow(media, "MEDIA_NOT_FOUND");

    if (body.is_primary === true) {
      const { error } = await supabase
        .from("hoarding_media")
        .update({ is_primary: false })
        .eq("hoarding_id", params.id);
      if (error) throw pgErrorToApiError(error);
    }

    const { data, error } = await supabase
      .from("hoarding_media")
      .update(body)
      .eq("id", params.mediaId)
      .select("id, is_primary, display_order, processing_status")
      .single();
    if (error) throw pgErrorToApiError(error);
    return { data };
  },
});

/**
 * DELETE /api/v1/hoardings/{id}/media/{mediaId} — api-specification.md §14.5.
 * Refused (`MEDIA_LAST_ASSET` -> HOARDING_MISSING_MEDIA) if it is the only asset
 * on an APPROVED / PENDING_REVIEW listing (INVENTORY-003 would keep it visible
 * with no image). A DRAFT may go to zero freely. Storage object is removed
 * best-effort after the row delete.
 */
export const DELETE = defineRoute<undefined, undefined, Params>({
  path: "/api/v1/hoardings/{id}/media/{mediaId}",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 60 },
  status: 204,
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id) || !UUID.test(params.mediaId))
      throw ApiError.of("VALIDATION_ERROR");
    logResource(params.mediaId);

    const { data: media, error: mErr } = await supabase
      .from("hoarding_media")
      .select("id, storage_path, hoarding_id")
      .eq("id", params.mediaId)
      .eq("hoarding_id", params.id)
      .maybeSingle();
    if (mErr) throw pgErrorToApiError(mErr);
    const row = requireRow(media, "MEDIA_NOT_FOUND");

    const [{ count }, { data: hoarding }] = await Promise.all([
      supabase
        .from("hoarding_media")
        .select("id", { count: "exact", head: true })
        .eq("hoarding_id", params.id),
      supabase
        .from("hoardings")
        .select("approval_status")
        .eq("id", params.id)
        .maybeSingle(),
    ]);
    if (
      (count ?? 0) <= 1 &&
      (hoarding?.approval_status === "APPROVED" ||
        hoarding?.approval_status === "PENDING_REVIEW")
    ) {
      throw ApiError.of(
        "HOARDING_MISSING_MEDIA",
        "A listed hoarding must keep at least one photo. Add another before removing this one.",
      );
    }

    const { error } = await supabase
      .from("hoarding_media")
      .delete()
      .eq("id", params.mediaId);
    if (error) throw pgErrorToApiError(error);

    await createAdminClient()
      .storage.from(PUBLIC_BUCKET)
      .remove([row.storage_path])
      .catch(() => {});

    return { data: null };
  },
});
