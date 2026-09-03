import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ is_read: z.boolean() }).strict();

/**
 * PATCH /api/v1/notifications/{id} — mark read/unread. api-specification.md §6.6:
 * `is_read` is the only mutable field. RLS `notifications_update_own` +
 * the column GRANT `(is_read, read_at)` are the enforcement; a row that isn't
 * the caller's returns zero rows -> 404 (§6.5), never "exists but not yours".
 */
export const PATCH = defineRoute<
  undefined,
  z.infer<typeof bodySchema>,
  { id: string }
>({
  path: "/api/v1/notifications/{id}",
  auth: true,
  body: bodySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, params, body, logResource }) => {
    logResource(params.id);
    const { data, error } = await supabase
      .from("notifications")
      .update({
        is_read: body.is_read,
        read_at: body.is_read ? new Date(Date.now()).toISOString() : null,
      })
      .eq("id", params.id)
      .select("id, is_read, read_at")
      .maybeSingle();

    if (error) throw pgErrorToApiError(error);
    return requireRow(data);
  },
});
