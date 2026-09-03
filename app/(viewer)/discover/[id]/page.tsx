import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { buildOwnerView } from "@/lib/inventory/projection";
import { toPublicDetail } from "@/lib/inventory/public-view";
import { EmptyState } from "@/components/ui/empty-state";
import { DetailView } from "@/components/discovery/detail-view";

export const metadata: Metadata = { title: "Hoarding" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HoardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  if (!UUID.test(id)) return <Unavailable />;

  const { data: detail } = await supabase
    .from("public_hoarding_detail")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Not in the view: never existed, or paused/delisted since the list loaded.
  // docs/03 VW-03 — a Viewer sees "no longer available", not a 404 page.
  if (!detail) {
    // If the caller owns it, send them to their editor instead.
    const user = await getSessionUser();
    if (user) {
      const { data: owned } = await supabase
        .from("hoardings")
        .select("*")
        .eq("id", id)
        .eq("publisher_id", user.id)
        .maybeSingle();
      if (owned) {
        const view = await buildOwnerView(supabase, owned);
        return (
          <section>
            <h1 className="text-h1 text-ink-900">{view.title}</h1>
            <p className="text-ink-700 mt-2 text-sm">
              This is your listing ({view.approval_status.toLowerCase()}). Manage
              it from{" "}
              <Link
                href="/publisher/hoardings"
                className="font-medium underline"
              >
                My hoardings
              </Link>
              .
            </p>
          </section>
        );
      }
    }
    return <Unavailable />;
  }

  const { data: types } = await supabase
    .from("hoarding_types")
    .select("code, display_name");
  const typeName = new Map((types ?? []).map((t) => [t.code, t.display_name]));

  return (
    <DetailView
      hoarding={toPublicDetail(supabase, detail, { typeName, distanceKm: null })}
    />
  );
}

function Unavailable() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <EmptyState
        headline="This hoarding is no longer available"
        body="It may have been paused or removed by the Publisher."
        action={
          <Link
            href="/discover"
            className="bg-ink-900 text-surface-1 hover:bg-ink-800 inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold"
          >
            Back to Discover
          </Link>
        }
      />
    </div>
  );
}
