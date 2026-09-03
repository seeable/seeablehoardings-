"use client";

import * as React from "react";
import { Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import { listAdminActions } from "@/lib/admin/client";
import { ApiClientError } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AdminActionRow } from "@/lib/admin/types";

/**
 * AD-05 — a lightweight recent-events feed, explicitly NOT a compliance-grade
 * audit log (no filters, no search, no export, no per-entry drill-down). Rows
 * are plain past-tense sentences with an absolute IST timestamp.
 */
export function ActivityView() {
  const [rows, setRows] = React.useState<AdminActionRow[] | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listAdminActions({ page, pageSize: 30 })
      .then((r) => {
        if (cancelled) return;
        setRows((prev) => (page === 1 ? r.rows : [...(prev ?? []), ...r.rows]));
        setHasMore(r.pagination ? r.pagination.has_next : false);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load activity.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <section>
      <h1 className="text-h1 text-ink-900">Activity</h1>
      <p className="text-ink-500 mt-1 text-sm">
        Recent moderation actions. Not a full audit log.
      </p>

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setPage(1)}
          >
            Retry
          </Button>
        </div>
      ) : rows === null ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Activity} headline="No activity yet" />
        </div>
      ) : (
        <>
          <ul className="divide-border mt-6 divide-y">
            {rows.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-ink-800 text-sm">{a.description}</span>
                <time
                  dateTime={a.created_at}
                  title={formatDateTime(a.created_at)}
                  className="text-ink-500 shrink-0 text-xs whitespace-nowrap"
                >
                  {formatDate(a.created_at)}
                </time>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                loading={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  setPage((p) => p + 1);
                }}
              >
                Load older
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
