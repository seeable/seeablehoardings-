import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { publisherPatchSchema } from "@/lib/publisher/schema";
import { buildPublisherProfile } from "@/lib/publisher/projection";
import type { PublisherPatchInput } from "@/lib/publisher/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/publishers/me — api-specification.md §22.2. `profiles` + the
 * `publisher_profiles` trust fields + `can_submit_listings`. `suspended_by` is
 * not returned (it identifies internal staff).
 */
export const GET = defineRoute({
  path: "/api/v1/publishers/me",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user }) => {
    const profile = await buildPublisherProfile(supabase, user!.id);
    requireRow(profile, "PUBLISHER_NOT_FOUND");
    return { data: { publisher: profile } };
  },
});

/**
 * PATCH /api/v1/publishers/me — api-specification.md §22.3. `business_name` →
 * `publisher_profiles`; the contact fields → `profiles`. One PATCH may span
 * both; either both writes land or neither does isn't guaranteed across two
 * PostgREST calls, so the contact write goes first and a failure on the second
 * surfaces without having touched `business_name`.
 */
export const PATCH = defineRoute<undefined, PublisherPatchInput>({
  path: "/api/v1/publishers/me",
  auth: "PUBLISHER",
  body: publisherPatchSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, user, body }) => {
    const { business_name, ...profileFields } = body;
    if (Object.keys(body).length === 0) throw ApiError.of("VALIDATION_ERROR");

    if (Object.keys(profileFields).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(profileFields)
        .eq("id", user!.id);
      if (error) throw pgErrorToApiError(error);
    }
    if (business_name !== undefined) {
      const { error } = await supabase
        .from("publisher_profiles")
        .update({ business_name })
        .eq("id", user!.id);
      if (error) throw pgErrorToApiError(error);
    }

    const profile = await buildPublisherProfile(supabase, user!.id);
    requireRow(profile, "PUBLISHER_NOT_FOUND");
    return { data: { publisher: profile } };
  },
});
