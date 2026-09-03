import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { asJson, updateHoardingSchema } from "@/lib/inventory/schema";
import { buildOwnerView } from "@/lib/inventory/projection";
import { haversineKm, toPublicDetail } from "@/lib/inventory/public-view";
import type { UpdateHoardingInput } from "@/lib/inventory/schema";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/hoardings/{id} — api-specification.md §11.4.
 * Owner / Admin get the full owner view (§11.3); everyone else gets the
 * disintermediation-safe public projection (`public_hoarding_detail`). A row
 * that fails INVENTORY-003 for a non-owner reads as 404, not "delisted"
 * (§6.5 — no inventory oracle).
 */
export const GET = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/hoardings/{id}",
  auth: true,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user, params, searchParams, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const { data: hoarding, error } = await supabase
      .from("hoardings")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw pgErrorToApiError(error);
    const row = requireRow(hoarding, "HOARDING_NOT_FOUND");

    const isOwner = row.publisher_id === user!.id;
    const isAdmin = user!.role === "ADMIN";
    if (isOwner || isAdmin) {
      return { data: { hoarding: await buildOwnerView(supabase, row) } };
    }

    // Non-owner: the disintermediation-safe projection. A paused/delisted row
    // exists in `hoardings` but not in the view -> 404 (§6.5, no oracle).
    const [{ data: pub, error: pubErr }, { data: types }] = await Promise.all([
      supabase
        .from("public_hoarding_detail")
        .select("*")
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("hoarding_types").select("code, display_name"),
    ]);
    if (pubErr) throw pgErrorToApiError(pubErr);
    const detail = requireRow(pub, "HOARDING_NOT_FOUND");

    const qLat = Number(searchParams.get("latitude"));
    const qLng = Number(searchParams.get("longitude"));
    const distanceKm =
      Number.isFinite(qLat) &&
      Number.isFinite(qLng) &&
      searchParams.has("latitude") &&
      detail.latitude != null &&
      detail.longitude != null
        ? haversineKm(qLat, qLng, detail.latitude, detail.longitude)
        : null;

    const typeName = new Map((types ?? []).map((t) => [t.code, t.display_name]));
    return {
      data: {
        hoarding: toPublicDetail(supabase, detail, { typeName, distanceKm }),
      },
    };
  },
});

/**
 * PATCH /api/v1/hoardings/{id} — api-specification.md §13. Owner-only partial
 * update of the editable columns (the grant + `.strict()` reject the rest).
 * `enforce_hoarding_edit_freeze` (OWNER-003) may reject with HOARDING_EDIT_FROZEN.
 */
export const PATCH = defineRoute<undefined, UpdateHoardingInput, { id: string }>({
  path: "/api/v1/hoardings/{id}",
  auth: "PUBLISHER",
  body: updateHoardingSchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user, params, body, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    if (Object.keys(body).length === 0) throw ApiError.of("VALIDATION_ERROR");

    const { data: existing, error: exErr } = await supabase
      .from("hoardings")
      .select("id, publisher_id")
      .eq("id", params.id)
      .maybeSingle();
    if (exErr) throw pgErrorToApiError(exErr);
    const found = requireRow(existing, "HOARDING_NOT_FOUND");
    if (found.publisher_id !== user!.id) throw ApiError.of("FORBIDDEN_NOT_OWNER");

    const { attributes, site_intelligence, ...rest } = body;
    const patch: Database["public"]["Tables"]["hoardings"]["Update"] = { ...rest };
    if ("attributes" in body) patch.attributes = asJson(attributes);
    if ("site_intelligence" in body)
      patch.site_intelligence = asJson(site_intelligence);

    const { data, error } = await supabase
      .from("hoardings")
      .update(patch)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw pgErrorToApiError(error);

    return { data: { hoarding: await buildOwnerView(supabase, data) } };
  },
});

/**
 * DELETE /api/v1/hoardings/{id} — api-specification.md §13.5. Hard delete via
 * `delete_hoarding()`; a listing with any request history is refused by the
 * RESTRICT FK -> HOARDING_HAS_REQUEST_HISTORY. Orphaned storage objects are a
 * cleanup-job concern (§28.6), not handled here.
 */
export const DELETE = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/hoardings/{id}",
  auth: ["PUBLISHER", "ADMIN"],
  rateLimit: { perMinute: 30 },
  status: 204,
  handler: async ({ supabase, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    const { error } = await supabase.rpc("delete_hoarding", {
      p_hoarding_id: params.id,
    });
    if (error) throw pgErrorToApiError(error);
    return { data: null };
  },
});
