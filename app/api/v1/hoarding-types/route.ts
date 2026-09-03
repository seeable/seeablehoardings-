import { defineRoute } from "@/lib/api/facade";
import { pgErrorToApiError } from "@/lib/db/errors";
import type { HoardingTypeView } from "@/lib/inventory/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/hoarding-types — api-specification.md §11.5. The listing form's
 * source of truth for the taxonomy and each type's `required_attribute_keys`
 * (INVENTORY-001). `is_listable = NOT is_digital` is derived, not a column
 * (mvp-brd.md §5.1 — static types only at MVP).
 */
export const GET = defineRoute({
  path: "/api/v1/hoarding-types",
  auth: true,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase }) => {
    const { data, error } = await supabase
      .from("hoarding_types")
      .select(
        "code, display_name, is_digital, required_attribute_keys, description",
      )
      .order("is_digital", { ascending: true })
      .order("display_name", { ascending: true });
    if (error) throw pgErrorToApiError(error);

    const hoarding_types: HoardingTypeView[] = (data ?? []).map((t) => ({
      code: t.code,
      display_name: t.display_name,
      is_digital: t.is_digital,
      is_listable: !t.is_digital,
      required_attribute_keys: t.required_attribute_keys ?? [],
      description: t.description,
    }));
    return { data: { hoarding_types } };
  },
});
