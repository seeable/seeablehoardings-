import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { profilePatchSchema } from "@/lib/publisher/schema";
import type { ProfilePatchInput } from "@/lib/publisher/schema";
import type { ProfileResource } from "@/lib/publisher/types";

export const dynamic = "force-dynamic";

const SELECT = "id, role, full_name, phone, email, city, created_at, updated_at";

/**
 * GET /api/v1/profiles/me — the shared contact-profile resource for every role
 * (SH-01 Viewer + Publisher). RLS `profiles_select_own_or_admin` scopes it.
 */
export const GET = defineRoute({
  path: "/api/v1/profiles/me",
  auth: true,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(SELECT)
      .eq("id", user!.id)
      .single();
    if (error) throw pgErrorToApiError(error);
    return { data: { profile: data as ProfileResource } };
  },
});

/**
 * PATCH /api/v1/profiles/me — `full_name` / `phone` / `email` / `city` only
 * (api-spec §23.5). `GRANT UPDATE (full_name, phone, email, city)` +
 * `.strict()` reject `role` / `verification_status` etc. at both layers.
 */
export const PATCH = defineRoute<undefined, ProfilePatchInput>({
  path: "/api/v1/profiles/me",
  auth: true,
  body: profilePatchSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, user, body }) => {
    if (Object.keys(body).length === 0) throw ApiError.of("VALIDATION_ERROR");
    const { data, error } = await supabase
      .from("profiles")
      .update(body)
      .eq("id", user!.id)
      .select(SELECT)
      .single();
    if (error) throw pgErrorToApiError(error);
    return { data: { profile: data as ProfileResource } };
  },
});
