import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { asJson, createHoardingSchema } from "@/lib/inventory/schema";
import { buildOwnerView } from "@/lib/inventory/projection";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/hoardings — api-specification.md §12. Creates a DRAFT. Only
 * `type_code` + `title` are required; the rest fills in over the wizard and is
 * gated at `/submit`. `publisher_id` is `auth.uid()`, never the body
 * (`hoardings_insert_own` RLS + the column grant enforce it).
 */
export const POST = defineRoute<undefined, z.infer<typeof createHoardingSchema>>({
  path: "/api/v1/hoardings",
  auth: "PUBLISHER",
  body: createHoardingSchema,
  rateLimit: { perMinute: 30 },
  status: 201,
  handler: async ({ supabase, user, body, logResource }) => {
    const { data: type, error: typeErr } = await supabase
      .from("hoarding_types")
      .select("code, is_digital")
      .eq("code", body.type_code)
      .maybeSingle();
    if (typeErr) throw pgErrorToApiError(typeErr);
    if (!type) throw ApiError.of("HOARDING_TYPE_UNKNOWN");
    if (type.is_digital) throw ApiError.of("HOARDING_TYPE_NOT_LISTABLE");

    const { data, error } = await supabase
      .from("hoardings")
      .insert({
        publisher_id: user!.id,
        type_code: body.type_code,
        title: body.title,
        description: body.description ?? null,
        size: body.size ?? null,
        price: body.price ?? null,
        price_unit: body.price_unit ?? "MONTH",
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        locality: body.locality ?? null,
        city: body.city ?? "Bengaluru",
        address_text: body.address_text ?? null,
        attributes: asJson(body.attributes),
        site_intelligence: asJson(body.site_intelligence),
      })
      .select("*")
      .single();
    if (error) throw pgErrorToApiError(error);

    logResource(data.id);
    return { data: { hoarding: await buildOwnerView(supabase, data) } };
  },
});
