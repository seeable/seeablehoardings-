import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listTypeViews } from "@/lib/inventory/server";
import { HoardingWizard } from "@/components/inventory/hoarding-wizard";

export const metadata: Metadata = { title: "Add a hoarding" };
export const dynamic = "force-dynamic";

export default async function NewHoardingPage() {
  const supabase = await createClient();
  const types = await listTypeViews(supabase);
  return <HoardingWizard types={types} />;
}
