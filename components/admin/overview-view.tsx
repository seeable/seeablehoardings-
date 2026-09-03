"use client";

import * as React from "react";
import Link from "next/link";
import { MetricCard, Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminDashboard } from "@/lib/admin/client";
import { ApiClientError } from "@/lib/api/client";
import type { AdminDashboard } from "@/lib/admin/types";

/**
 * AD-01 — the deliberately narrow operational snapshot. Four counts, no charts,
 * no date range. Each card that has a working destination deep-links into AD-02
 * pre-filtered; "Live campaigns" has none (Admin has no request browser — D10).
 * A zero shows as "0", never hidden — an Admin needs a real all-clear.
 */
export function OverviewView() {
  const [data, setData] = React.useState<AdminDashboard | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    getAdminDashboard()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load the dashboard.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return (
    <section>
      <h1 className="text-h1 text-ink-900">Overview</h1>

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
          <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardLink href="/admin/inventory?view=publishers&tab=PENDING">
            <MetricCard
              label="Pending publisher verifications"
              value={data.publishers.pending_verification}
              hint="awaiting your review"
            />
          </CardLink>
          <CardLink href="/admin/inventory?view=listings&tab=PENDING_REVIEW">
            <MetricCard
              label="Pending listing approvals"
              value={data.listings.pending_approval}
              hint="awaiting your review"
            />
          </CardLink>
          <CardLink href="/admin/inventory?view=publishers&tab=VERIFIED">
            <MetricCard
              label="Active publishers"
              value={data.publishers.active}
              hint={`${data.publishers.verified} verified`}
            />
          </CardLink>
          <MetricCard
            label="Live campaigns"
            value={data.requests.live}
            hint={`${data.requests.confirmation_rate_pct}% confirmation rate`}
          />
        </div>
      )}
    </section>
  );
}

function CardLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg transition-shadow hover:shadow-md motion-reduce:transition-none"
    >
      {children}
    </Link>
  );
}
