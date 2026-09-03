import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { listTypeViews } from "@/lib/inventory/server";
import { DiscoverView } from "@/components/discovery/discover-view";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const types = await listTypeViews(supabase);
  return (
    <Suspense fallback={null}>
      <DiscoverView types={types} />
    </Suspense>
  );
}
