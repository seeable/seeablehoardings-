"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestCard } from "@/components/requests/request-card";
import { PublisherRequestDrawer } from "@/components/requests/publisher-request-drawer";
import { useRequestRealtime } from "@/hooks/use-request-realtime";
import { listIncomingRequests } from "@/lib/requests/client";
import { ApiClientError } from "@/lib/api/client";
import type { RequestResource, RequestStatus } from "@/lib/requests/types";

const TABS: { key: string; label: string; status?: RequestStatus }[] = [
  { key: "REQUESTED", label: "Pending", status: "REQUESTED" },
  { key: "CONFIRMED", label: "Confirmed", status: "CONFIRMED" },
  { key: "LIVE", label: "Live", status: "LIVE" },
  { key: "COMPLETED", label: "Completed", status: "COMPLETED" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
  { key: "EXPIRED", label: "Expired", status: "EXPIRED" },
];

const EMPTY: Record<string, string> = {
  REQUESTED: "No requests are waiting on you right now.",
  CONFIRMED: "No confirmed requests yet.",
  LIVE: "No campaigns are currently running.",
  COMPLETED: "No completed requests yet.",
  REJECTED: "You haven't declined any requests.",
  EXPIRED: "No requests have expired.",
};

export function IncomingRequestsView() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("status") ?? "REQUESTED";
  const openId = params.get("open");

  const [rows, setRows] = React.useState<RequestResource[] | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    listIncomingRequests()
      .then((r) => {
        if (cancelled) return;
        setRows(r.requests);
        setCounts(r.counts_by_status);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load your requests.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  useRequestRealtime(reload);

  const visible = (rows ?? []).filter((r) => r.status === tab);
  const opened = (rows ?? []).find((r) => r.id === openId) ?? null;

  const tabItems: TabItem[] = TABS.map((t) => ({
    value: t.key,
    label: t.label,
    count: counts[t.key] ?? 0,
  }));

  const setOpen = (id: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (id) q.set("open", id);
    else q.delete("open");
    router.replace(`/publisher/requests${q.toString() ? `?${q}` : ""}`);
  };

  return (
    <section>
      <h1 className="text-h1 text-ink-900 mb-4">Requests</h1>

      <Tabs
        items={tabItems}
        value={tab}
        onValueChange={(v) => router.push(`/publisher/requests?status=${v}`)}
        aria-label="Request status"
      />

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
          <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : rows === null ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            headline="Nothing here"
            body={EMPTY[tab] ?? "No requests in this state."}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              role="PUBLISHER"
              onOpen={() => setOpen(r.id)}
            />
          ))}
        </ul>
      )}

      <PublisherRequestDrawer
        request={opened}
        open={!!opened}
        onClose={() => setOpen(null)}
        onChanged={reload}
      />
    </section>
  );
}
