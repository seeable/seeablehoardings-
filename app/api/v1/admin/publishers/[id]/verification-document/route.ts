import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
// Sanctioned service-role use (eslint.config.mjs allowlist): mints a short-lived
// signed URL for the Admin-only verification document (bucket has no RLS policy).
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "publisher-private";
const TTL_SECONDS = 300;

/**
 * GET /api/v1/admin/publishers/{id}/verification-document — AD-03.
 * `get_verification_document_path()` (self-or-Admin, runs as the caller) is the
 * authorization boundary; the `publisher-private` bucket has NO storage policy,
 * so the signed URL is minted with the service role. Never a public URL, always
 * short-lived. `{ url: null }` when the Publisher submitted no document.
 */
export const GET = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/admin/publishers/{id}/verification-document",
  auth: "ADMIN",
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data: path, error } = await supabase.rpc(
      "get_verification_document_path",
      { p_publisher_id: params.id },
    );
    if (error) throw pgErrorToApiError(error);
    if (!path) return { data: { url: null } };

    const admin = createAdminClient();
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL_SECONDS);
    if (signErr || !signed) throw ApiError.of("STORAGE_UNAVAILABLE");

    return { data: { url: signed.signedUrl } };
  },
});
