import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { buildOwnerView } from "@/lib/inventory/projection";
import { listTypeViews } from "@/lib/inventory/server";
import { HoardingWizard } from "@/components/inventory/hoarding-wizard";

export const metadata: Metadata = { title: "Edit hoarding" };
export const dynamic = "force-dynamic";

export default async function EditHoardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: hoarding } = await supabase
    .from("hoardings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!hoarding) notFound();

  const user = await getSessionUser();
  if (!user || hoarding.publisher_id !== user.id) {
    redirect("/publisher/hoardings");
  }

  const [view, types] = await Promise.all([
    buildOwnerView(supabase, hoarding),
    listTypeViews(supabase),
  ]);

  return <HoardingWizard types={types} initial={view} />;
}
