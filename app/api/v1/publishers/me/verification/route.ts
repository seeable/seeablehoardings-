import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPublisherProfile } from "@/lib/publisher/projection";
import { verificationFieldsSchema } from "@/lib/publisher/schema";
import {
  DOC_ALLOWED_MIME,
  DOC_BUCKET,
  DOC_MAX_BYTES,
  documentStoragePath,
  sniffDocumentMime,
} from "@/lib/publisher/verification";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/publishers/me/verification — PB-08. Multipart: `business_name`,
 * optional `business_type`, and a `document` file. The document is written to
 * `publisher-private` **with the service role** (that bucket has no
 * storage.objects policy — the browser cannot touch it, only an Admin ever
 * reads it), then `submit_publisher_verification()` flips the profile to
 * `PENDING`. Storage-then-row; the object is removed if the RPC rejects.
 */
export const POST = defineRoute({
  path: "/api/v1/publishers/me/verification",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 5 },
  handler: async ({ req, supabase, user, logResource }) => {
    logResource(user!.id);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw ApiError.of("BAD_REQUEST", "Expected multipart/form-data.");
    }

    const fields = verificationFieldsSchema.safeParse({
      business_name: form.get("business_name"),
      business_type: form.get("business_type") ?? undefined,
    });
    if (!fields.success) throw ApiError.of("VALIDATION_ERROR");

    const file = form.get("document");
    if (!(file instanceof Blob) || file.size === 0) {
      throw ApiError.of("VALIDATION_ERROR", "A verification document is required.");
    }
    if (file.size > DOC_MAX_BYTES) throw ApiError.of("PAYLOAD_TOO_LARGE");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffDocumentMime(bytes);
    if (!mime || !DOC_ALLOWED_MIME.includes(mime as never)) {
      throw ApiError.of("UNSUPPORTED_MEDIA_TYPE", "Upload a PDF or an image.");
    }

    const stamp = Date.now().toString(36);
    const path = documentStoragePath(user!.id, mime, stamp);
    const admin = createAdminClient();

    const up = await admin.storage
      .from(DOC_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (up.error) {
      throw ApiError.of("STORAGE_UNAVAILABLE", undefined, {
        detail: up.error.message,
      });
    }

    const { error } = await supabase.rpc("submit_publisher_verification", {
      p_business_name: fields.data.business_name,
      p_business_type: fields.data.business_type ?? "",
      p_document_path: path,
    });
    if (error) {
      await admin.storage.from(DOC_BUCKET).remove([path]);
      throw pgErrorToApiError(error);
    }

    const profile = await buildPublisherProfile(supabase, user!.id);
    return { data: { publisher: profile }, status: 202 };
  },
});
