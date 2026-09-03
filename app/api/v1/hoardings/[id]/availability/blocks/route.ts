import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { createBlockSchema } from "@/lib/inventory/schema";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/hoardings/{id}/availability/blocks — api-specification.md §15,
 * docs/04 PB-05. A Publisher-authored unavailable range. Refused when it
 * overlaps a confirmed booking (PB-05 business rule / REQUEST-004) — a
 * maintenance block can't erase a paying campaign.
 */
export const POST = defineRoute<undefined, z.infer<typeof createBlockSchema>, { id: string }>({
  path: "/api/v1/hoardings/{id}/availability/blocks",
  auth: "PUBLISHER",
  body: createBlockSchema,
  rateLimit: { perMinute: 60 },
  status: 201,
  handler: async ({ supabase, user, params, body, logResource }) => {
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

    const { data: clash, error: cErr } = await supabase
      .from("requests")
      .select("id")
      .eq("hoarding_id", params.id)
      .in("status", ["CONFIRMED", "LIVE", "COMPLETED"])
      .lte("start_date", body.end_date)
      .gte("end_date", body.start_date)
      .limit(1);
    if (cErr) throw pgErrorToApiError(cErr);
    if (clash && clash.length > 0) {
      throw ApiError.of(
        "REQUEST_DATE_CONFLICT",
        "Those dates already have a confirmed booking and can't be blocked.",
      );
    }

    const { data, error } = await supabase
      .from("hoarding_availability_blocks")
      .insert({
        hoarding_id: params.id,
        start_date: body.start_date,
        end_date: body.end_date,
        reason: body.reason ?? null,
      })
      .select("id, start_date, end_date, reason")
      .single();
    if (error) throw pgErrorToApiError(error);
    return { data: { block: data } };
  },
});
