import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/badge";
import { AvailabilityEditor } from "@/components/inventory/availability-editor";
import { effectiveStatus } from "@/lib/inventory/types";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: hoarding } = await supabase
    .from("hoardings")
    .select("id, title, publisher_id, approval_status, is_paused, is_delisted")
    .eq("id", id)
    .maybeSingle();
  if (!hoarding) notFound();

  const user = await getSessionUser();
  if (!user || hoarding.publisher_id !== user.id) {
    redirect("/publisher/hoardings");
  }

  return (
    <section>
      <Link
        href="/publisher/hoardings"
        className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> My hoardings
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-h1 text-ink-900">{hoarding.title}</h1>
        <StatusBadge status={effectiveStatus(hoarding)} />
      </div>
      <AvailabilityEditor hoardingId={id} showBookings />
    </section>
  );
}
