import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HoardingTypeView } from "@/lib/inventory/types";

/** The taxonomy for the wizard, server-side (mirrors GET /api/v1/hoarding-types). */
export async function listTypeViews(
  supabase: SupabaseClient<Database>,
): Promise<HoardingTypeView[]> {
  const { data } = await supabase
    .from("hoarding_types")
    .select("code, display_name, is_digital, required_attribute_keys, description")
    .order("is_digital", { ascending: true })
    .order("display_name", { ascending: true });
  return (data ?? []).map((t) => ({
    code: t.code,
    display_name: t.display_name,
    is_digital: t.is_digital,
    is_listable: !t.is_digital,
    required_attribute_keys: t.required_attribute_keys ?? [],
    description: t.description,
  }));
}
