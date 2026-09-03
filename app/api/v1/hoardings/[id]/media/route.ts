import { randomUUID } from "node:crypto";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/inventory/projection";
import {
  ALLOWED_IMAGE_MIME,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_LONG_EDGE,
  MEDIA_MAX_PER_LISTING,
  MEDIA_MIN_HEIGHT,
  MEDIA_MIN_WIDTH,
  PUBLIC_BUCKET,
  imageDimensions,
  publicStoragePath,
  sniffImageMime,
} from "@/lib/inventory/media";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/hoardings/{id}/media — api-specification.md §14.5.
 * `is_primary DESC, display_order ASC`. Owner/Admin see pipeline fields; a
 * Viewer sees the watermarked public projection only.
 */
export const GET = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/hoardings/{id}/media",
  auth: true,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data: hoarding, error: hErr } = await supabase
      .from("hoardings")
      .select("id, publisher_id")
      .eq("id", params.id)
      .maybeSingle();
    if (hErr) throw pgErrorToApiError(hErr);
    const row = requireRow(hoarding, "HOARDING_NOT_FOUND");
    const privileged =
      row.publisher_id === user!.id || user!.role === "ADMIN";

    const { data, error } = await supabase
      .from("hoarding_media")
      .select(
        "id, media_type, storage_path, is_primary, display_order, processing_status, watermarked_at, created_at",
      )
      .eq("hoarding_id", params.id)
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true });
    if (error) throw pgErrorToApiError(error);

    const media = (data ?? [])
      .filter((m) => privileged || m.processing_status === "WATERMARKED")
      .map((m) => {
        const url =
          m.processing_status === "WATERMARKED"
            ? mediaUrl(supabase, m.storage_path)
            : null;
        return privileged
          ? {
              id: m.id,
              media_type: m.media_type,
              url,
              is_primary: m.is_primary,
              display_order: m.display_order,
              processing_status: m.processing_status,
              watermarked_at: m.watermarked_at,
              has_original: false,
              created_at: m.created_at,
            }
          : {
              id: m.id,
              media_type: m.media_type,
              url,
              is_primary: m.is_primary,
              display_order: m.display_order,
            };
      });

    return { data: { media } };
  },
});

/**
 * POST /api/v1/hoardings/{id}/media — api-specification.md §14.3 (Variant B).
 * The client sends the Canvas-watermarked derivative as multipart. The server
 * re-validates the bytes (MIME from magic bytes, size, dimensions), then writes
 * to `hoarding-public` **with the service role** — the browser never writes to
 * storage directly (§14.2). The row is inserted only after the object persists
 * (§14.3 storage-then-row).
 */
export const POST = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/hoardings/{id}/media",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 10 },
  status: 201,
  handler: async ({ req, supabase, user, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data: hoarding, error: hErr } = await supabase
      .from("hoardings")
      .select("id, publisher_id")
      .eq("id", params.id)
      .maybeSingle();
    if (hErr) throw pgErrorToApiError(hErr);
    const row = requireRow(hoarding, "HOARDING_NOT_FOUND");
    if (row.publisher_id !== user!.id) throw ApiError.of("FORBIDDEN_NOT_OWNER");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw ApiError.of("BAD_REQUEST", "Expected multipart/form-data.");
    }
    const file = form.get("file");
    if (!(file instanceof Blob)) throw ApiError.of("VALIDATION_ERROR");
    if (file.size > MEDIA_MAX_BYTES) throw ApiError.of("MEDIA_TOO_LARGE");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageMime(bytes);
    if (!mime || !ALLOWED_IMAGE_MIME.includes(mime as never)) {
      throw ApiError.of("MEDIA_TYPE_UNSUPPORTED");
    }
    const dims = imageDimensions(bytes, mime);
    if (dims) {
      const longEdge = Math.max(dims.width, dims.height);
      if (
        dims.width < MEDIA_MIN_WIDTH ||
        dims.height < MEDIA_MIN_HEIGHT ||
        longEdge > MEDIA_MAX_LONG_EDGE
      ) {
        throw ApiError.of("MEDIA_DIMENSIONS_INVALID", undefined, {
          width: dims.width,
          height: dims.height,
          min: [MEDIA_MIN_WIDTH, MEDIA_MIN_HEIGHT],
          max_long_edge: MEDIA_MAX_LONG_EDGE,
        });
      }
    }

    const { count } = await supabase
      .from("hoarding_media")
      .select("id", { count: "exact", head: true })
      .eq("hoarding_id", params.id);
    if ((count ?? 0) >= MEDIA_MAX_PER_LISTING) {
      throw ApiError.of("MEDIA_LIMIT_EXCEEDED");
    }

    const wantPrimary =
      form.get("is_primary") === "true" || (count ?? 0) === 0;
    const orderRaw = form.get("display_order");
    const displayOrder =
      typeof orderRaw === "string" && /^\d+$/.test(orderRaw)
        ? Number(orderRaw)
        : (count ?? 0);

    const mediaId = randomUUID();
    const storagePath = publicStoragePath(params.id, mediaId, mime);
    const admin = createAdminClient();

    const up = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (up.error) {
      throw ApiError.of("STORAGE_UNAVAILABLE", undefined, {
        detail: up.error.message,
      });
    }

    if (wantPrimary) {
      await admin
        .from("hoarding_media")
        .update({ is_primary: false })
        .eq("hoarding_id", params.id);
    }

    const { data: inserted, error: insErr } = await admin
      .from("hoarding_media")
      .insert({
        id: mediaId,
        hoarding_id: params.id,
        media_type: "IMAGE",
        storage_path: storagePath,
        is_primary: wantPrimary,
        display_order: displayOrder,
        processing_status: "WATERMARKED",
        watermarked_at: new Date().toISOString(),
      })
      .select(
        "id, media_type, is_primary, display_order, processing_status, watermarked_at, created_at",
      )
      .single();

    if (insErr) {
      await admin.storage.from(PUBLIC_BUCKET).remove([storagePath]);
      throw pgErrorToApiError(insErr);
    }

    return {
      data: {
        id: inserted.id,
        hoarding_id: params.id,
        media_type: inserted.media_type,
        url: mediaUrl(supabase, storagePath),
        is_primary: inserted.is_primary,
        display_order: inserted.display_order,
        processing_status: inserted.processing_status,
        watermarked_at: inserted.watermarked_at,
        has_original: false,
        created_at: inserted.created_at,
      },
    };
  },
});
