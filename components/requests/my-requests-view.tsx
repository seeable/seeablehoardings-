"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Drawer } from "@/components/ui/drawer";
import { RequestCard } from "@/components/requests/request-card";
import { RequestStatusPill } from "@/components/requests/request-status-pill";
import { useRequestRealtime } from "@/hooks/use-request-realtime";
import { listMyRequests } from "@/lib/requests/client";
import { ApiClientError } from "@/lib/api/client";
import { formatDateRange, formatDateTime, formatPrice } from "@/lib/format";
import type { RequestResource, RequestStatus } from "@/lib/requests/types";

const TABS: { key: string; label: string; match: RequestStatus[] }[] = [
  { key: "ALL", label: "All", match: [] },
  { key: "REQUESTED", label: "Pending", match: ["REQUESTED"] },
  { key: "CONFIRMED", label: "Confirmed", match: ["CONFIRMED"] },
  { key: "LIVE", label: "Live", match: ["LIVE"] },
  { key: "COMPLETED", label: "Completed", match: ["COMPLETED"] },
  { key: "CLOSED", label: "Rejected / Expired", match: ["REJECTED", "EXPIRED"] },
];

const EXPLAINER: Record<RequestStatus, (p: string, dates: string) => string> = {
  REQUESTED: (p) =>
    `Waiting for ${p} to respond. They'll confirm availability and pricing directly with you.`,
  CONFIRMED: (p, d) =>
    `Your campaign is booked for ${d}. Coordinate creative and installation details directly with ${p}.`,
  REJECTED: (p) =>
    `${p} declined this request. You can browse similar hoardings nearby.`,
  EXPIRED: () =>
    "This request wasn't answered in time and has expired. You're welcome to submit a new request.",
  LIVE: (_p, d) => `Your campaign is currently running (${d}).`,
  COMPLETED: (_p, d) => `This campaign ran ${d} and has been marked complete.`,
};

export function MyRequestsView() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("status") ?? "ALL";
  const openId = params.get("open");

  const [rows, setRows] = React.useState<RequestResource[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    listMyRequests()
      .then((r) => {
        if (cancelled) return;
        setRows(r.requests);
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

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: rows?.length ?? 0 };
    for (const t of TABS)
      if (t.key !== "ALL")
        c[t.key] = (rows ?? []).filter((r) => t.match.includes(r.status)).length;
    return c;
  }, [rows]);

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const visible = (rows ?? []).filter(
    (r) => active.match.length === 0 || active.match.includes(r.status),
  );
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
    router.replace(`/requests${q.toString() ? `?${q}` : ""}`);
  };

  return (
    <section>
      <h1 className="text-h1 text-ink-900 mb-4">My requests</h1>

      <Tabs
        items={tabItems}
        value={tab}
        onValueChange={(v) =>
          router.push(v === "ALL" ? "/requests" : `/requests?status=${v}`)
        }
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
            headline="No requests here yet"
            body="Browse Discover to find a hoarding and send your first request."
            action={
              <Button onClick={() => router.push("/discover")}>
                Browse Discover
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              role="VIEWER"
              onOpen={() => setOpen(r.id)}
            />
          ))}
        </ul>
      )}

      <Drawer
        open={!!opened}
        onClose={() => setOpen(null)}
        title={opened?.hoarding.title ?? "Request"}
        width="md"
      >
        {opened && (
          <ViewerRequestDetail request={opened} onClose={() => setOpen(null)} />
        )}
      </Drawer>
    </section>
  );
}

function ViewerRequestDetail({
  request: r,
  onClose,
}: {
  request: RequestResource;
  onClose: () => void;
}) {
  const dates = formatDateRange(r.start_date, r.end_date);
  return (
    <div className="space-y-4 p-4">
      <button
        type="button"
        onClick={onClose}
        className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 text-sm lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center gap-2">
        <RequestStatusPill status={r.status} role="VIEWER" label={r.status_label} />
        {r.status === "REQUESTED" && r.sla_deadline && (
          <span className="text-ink-500 text-xs">
            Respond by {formatDateTime(r.sla_deadline)}
          </span>
        )}
      </div>

      <p className="text-ink-700 text-sm">
        {EXPLAINER[r.status](r.publisher.business_name ?? "the Publisher", dates)}
      </p>

      <dl className="divide-border divide-y text-sm">
        <Row label="Dates">{dates}</Row>
        <Row label="Publisher">{r.publisher.business_name ?? "—"}</Row>
        <Row label="Price">{formatPrice(r.hoarding.price, r.hoarding.price_unit)}</Row>
        {r.amount_agreed != null && (
          <Row label="Amount agreed">
            {formatPrice(r.amount_agreed, null)}
          </Row>
        )}
        {r.rejection_reason && <Row label="Reason">{r.rejection_reason}</Row>}
      </dl>

      {r.message && (
        <div>
          <p className="text-ink-500 text-xs">Your message</p>
          <p className="text-ink-800 text-sm whitespace-pre-line">{r.message}</p>
        </div>
      )}

      {r.hoarding.is_currently_listed ? (
        <Link
          href={`/discover/${r.hoarding.id}`}
          className="text-gold-500 inline-block text-sm font-medium hover:underline"
        >
          View hoarding
        </Link>
      ) : (
        <p className="text-ink-500 text-xs">This listing is no longer available.</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 text-right">{children}</dd>
    </div>
  );
}
