"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { MetricCard, Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestRealtime } from "@/hooks/use-request-realtime";
import { getPublisherSummary } from "@/lib/publisher/client";
import { listIncomingRequests } from "@/lib/requests/client";
import { selectNeedsAttention } from "@/lib/publisher/summary";
import { VerificationBanner } from "@/components/publisher/verification-banner";
import { api, ApiClientError } from "@/lib/api/client";
import { formatINR, formatRelative } from "@/lib/format";
import { notificationHref, type NotificationRow } from "@/lib/notifications";
import type { AttentionItem, PublisherSummary } from "@/lib/publisher/types";
import type { RequestResource } from "@/lib/requests/types";

interface RejectedListing {
  id: string;
  title: string;
  rejection_reason: string | null;
}

export function DashboardView() {
  const router = useRouter();
  const [summary, setSummary] = React.useState<PublisherSummary | null>(null);
  const [attention, setAttention] = React.useState<AttentionItem[]>([]);
  const [activity, setActivity] = React.useState<NotificationRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      getPublisherSummary(),
      listIncomingRequests(["REQUESTED"]),
      api.get<{ hoardings: RejectedListing[] }>(
        "/api/v1/publishers/me/hoardings?status=REJECTED&pageSize=50",
      ),
      // Own fetch — the notification bell owns the realtime channel; a second
      // subscriber on the same topic throws. This feed refreshes on `reload`.
      api
        .get<{ notifications: NotificationRow[] }>(
          "/api/v1/notifications?pageSize=10",
        )
        .catch(() => ({ data: { notifications: [] as NotificationRow[] } })),
    ])
      .then(([s, pending, rejected, notes]) => {
        if (cancelled) return;
        setSummary(s);
        setAttention(
          selectNeedsAttention(
            pending.requests as RequestResource[],
            rejected.data.hoardings,
          ),
        );
        setActivity(notes.data.notifications);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load your dashboard.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  useRequestRealtime(reload);

  if (error) {
    return (
      <section>
        <h1 className="text-h1 text-ink-900 mb-4">Dashboard</h1>
        <Alert tone="danger">{error}</Alert>
        <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
          Retry
        </Button>
      </section>
    );
  }

  if (!summary) {
    return (
      <section>
        <h1 className="text-h1 text-ink-900 mb-4">Dashboard</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </section>
    );
  }

  const brandNew = summary.listings.total === 0;

  return (
    <section className="space-y-6">
      <h1 className="text-h1 text-ink-900">Dashboard</h1>

      {summary.suspended && (
        <Alert tone="danger">
          Your publisher account is suspended. Existing confirmed campaigns
          continue as agreed, but you can&apos;t create new listings. Contact
          SEEABLE support.
        </Alert>
      )}
      {!summary.suspended && (
        <VerificationBanner status={summary.verification_status} />
      )}

      {brandNew ? (
        <div className="border-border bg-surface-1 flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <h2 className="text-h3 text-ink-900">Add your first hoarding</h2>
          <p className="text-ink-500 max-w-sm text-sm">
            List a site to start receiving date requests from advertisers. You
            can save it as a draft while your account is being verified.
          </p>
          <Button onClick={() => router.push("/publisher/hoardings/new")}>
            <Plus className="h-4 w-4" /> Add hoarding
          </Button>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-overline text-ink-500 mb-2">Overview</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Active listings"
                value={summary.listings.live_in_search}
                hint={`${summary.listings.total} total`}
              />
              <CardLink href="/publisher/hoardings?status=PENDING_REVIEW">
                <MetricCard
                  label="Pending approval"
                  value={summary.listings.pending_approval}
                  hint="awaiting SEEABLE review"
                />
              </CardLink>
              <CardLink href="/publisher/requests?status=REQUESTED">
                <MetricCard
                  label="Open requests"
                  value={summary.requests.awaiting_response}
                  hint="need your response"
                />
              </CardLink>
              <MetricCard
                label="Confirmed this month"
                value={summary.confirmed_this_month}
                hint={
                  summary.confirmed_value.amount > 0
                    ? `${formatINR(summary.confirmed_value.amount)} agreed (recorded)`
                    : "campaigns confirmed"
                }
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-overline text-ink-500 mb-2">
                Needs your attention
              </h2>
              {attention.length === 0 ? (
                <p className="text-ink-500 text-sm">
                  Nothing needs action right now.
                </p>
              ) : (
                <ul className="space-y-2">
                  {attention.map((a) => (
                    <li key={`${a.kind}-${a.id}`}>
                      <Link
                        href={a.href}
                        className="border-border bg-surface-1 hover:border-ink-300 flex items-start gap-2 rounded-lg border p-3 text-sm transition-colors"
                      >
                        <AlertTriangle
                          className={
                            a.kind === "sla"
                              ? "text-warning-700 mt-0.5 h-4 w-4 shrink-0"
                              : "text-danger-700 mt-0.5 h-4 w-4 shrink-0"
                          }
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="text-ink-900 block font-medium">
                            {a.title}
                          </span>
                          <span className="text-ink-500">{a.detail}</span>
                        </span>
                        <ArrowRight className="text-ink-300 ml-auto mt-0.5 h-4 w-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-overline text-ink-500 mb-2">Recent activity</h2>
              {activity === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <p className="text-ink-500 text-sm">No activity yet.</p>
              ) : (
                <ul className="divide-border divide-y">
                  {activity.slice(0, 8).map((n) => {
                    const href = notificationHref(n, "PUBLISHER");
                    const body = (
                      <>
                        <span className="text-ink-900">{n.title}</span>
                        <span className="text-ink-500 block text-xs">
                          {formatRelative(n.created_at)}
                        </span>
                      </>
                    );
                    return (
                      <li key={n.id} className="py-2 text-sm">
                        {href ? (
                          <Link href={href} className="hover:bg-surface-2 block">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
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
    <Link href={href} className="block rounded-lg transition-shadow hover:shadow-md">
      {children}
    </Link>
  );
}
