"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useRequestRealtime } from "@/hooks/use-request-realtime";
import { api, ApiClientError } from "@/lib/api/client";
import { formatPrice, formatDate } from "@/lib/format";
import type { HoardingListItem, ListingTab } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

const TABS: { key: ListingTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING_REVIEW", label: "Pending approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAUSED", label: "Paused" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DELISTED", label: "Delisted" },
];

const EMPTY: Record<ListingTab, { head: string; body: string }> = {
  ALL: { head: "No hoardings yet", body: "Add your first hoarding to start receiving requests." },
  DRAFT: { head: "No drafts", body: "Drafts you haven't submitted will appear here." },
  PENDING_REVIEW: { head: "Nothing awaiting approval", body: "Submitted listings waiting on SEEABLE show up here." },
  APPROVED: { head: "No live listings", body: "Approved, active listings appear here." },
  PAUSED: { head: "Nothing paused", body: "Listings you've temporarily hidden from Discover appear here." },
  REJECTED: { head: "Nothing rejected", body: "Listings SEEABLE sent back with a reason appear here." },
  DELISTED: { head: "Nothing delisted", body: "Listings SEEABLE removed from Discover appear here." },
};

type Row = HoardingListItem & { rejection_reason: string | null };

export function HoardingTable() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const tab = (params.get("status") as ListingTab) ?? "ALL";

  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const load = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<{ hoardings: Row[] }>("/api/v1/publishers/me/hoardings?pageSize=100")
      .then((r) => {
        if (cancelled) return;
        setRows(r.data.hoardings);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError
              ? e.message
              : "Couldn't load your hoardings.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  useRequestRealtime(load);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows ?? []) {
      c.ALL = (c.ALL ?? 0) + 1;
      c[r.effective_status] = (c[r.effective_status] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const visible = (rows ?? []).filter(
    (r) => tab === "ALL" || r.effective_status === tab,
  );

  async function togglePause(r: Row) {
    setBusyId(r.id);
    setMenuId(null);
    const nextPaused = !r.is_paused;
    setRows((cur) =>
      (cur ?? []).map((x) =>
        x.id === r.id
          ? {
              ...x,
              is_paused: nextPaused,
              effective_status: nextPaused ? "PAUSED" : "APPROVED",
            }
          : x,
      ),
    );
    try {
      await api.patch(`/api/v1/hoardings/${r.id}`, { is_paused: nextPaused });
      toast.success(nextPaused ? "Listing paused." : "Listing live again.");
    } catch (e) {
      await load();
      toast.error(e instanceof ApiClientError ? e.message : "Couldn't update.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: Row) {
    setBusyId(r.id);
    setMenuId(null);
    try {
      await api.delete(`/api/v1/hoardings/${r.id}`);
      setRows((cur) => (cur ?? []).filter((x) => x.id !== r.id));
      toast.success("Draft deleted.");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Couldn't delete.");
    } finally {
      setBusyId(null);
    }
  }

  const rowHref = (r: Row) =>
    r.approval_status === "DRAFT" || r.approval_status === "REJECTED"
      ? `/publisher/hoardings/${r.id}/edit`
      : `/publisher/hoardings/${r.id}/calendar`;

  const tabItems: TabItem[] = TABS.map((t) => ({
    value: t.key,
    label: t.label,
    count: counts[t.key] ?? 0,
  }));

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-h1 text-ink-900">My hoardings</h1>
        <Button onClick={() => router.push("/publisher/hoardings/new")}>
          <Plus className="h-4 w-4" /> Add hoarding
        </Button>
      </div>

      <Tabs
        items={tabItems}
        value={tab}
        onValueChange={(v) =>
          router.push(v === "ALL" ? "/publisher/hoardings" : `/publisher/hoardings?status=${v}`)
        }
        aria-label="Listing status"
      />

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
          <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </div>
      ) : rows === null ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            headline={EMPTY[tab].head}
            body={EMPTY[tab].body}
            action={
              tab === "ALL" || tab === "DRAFT" ? (
                <Button onClick={() => router.push("/publisher/hoardings/new")}>
                  Add hoarding
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((r) => (
            <li
              key={r.id}
              className="border-border bg-surface-1 relative flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="bg-surface-2 h-12 w-16 shrink-0 overflow-hidden rounded">
                {r.primary_media_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.primary_media_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <Link href={rowHref(r)} className="min-w-0 flex-1">
                <p className="text-ink-900 truncate text-sm font-semibold">
                  {r.title}
                </p>
                <p className="text-ink-500 text-xs">
                  {r.type_display_name} · {formatPrice(r.price, r.price_unit)} ·
                  updated {formatDate(r.updated_at)}
                </p>
                {r.effective_status === "REJECTED" && r.rejection_reason && (
                  <p className="text-danger-700 mt-0.5 truncate text-xs">
                    {r.rejection_reason}
                  </p>
                )}
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                {r.pending_request_count > 0 && (
                  <span
                    className="bg-warning-50 text-warning-700 rounded-full px-2 py-0.5 text-xs font-medium"
                    aria-label={`${r.pending_request_count} pending request${r.pending_request_count === 1 ? "" : "s"}`}
                  >
                    {r.pending_request_count} pending
                  </span>
                )}
                <StatusBadge status={r.effective_status} />
                <button
                  type="button"
                  aria-label="Actions"
                  onClick={() => setMenuId(menuId === r.id ? null : r.id)}
                  className="text-ink-500 hover:bg-surface-2 rounded p-1"
                  disabled={busyId === r.id}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {menuId === r.id && (
                <div className="border-border bg-surface-1 absolute top-12 right-3 z-20 w-44 rounded-md border p-1 text-sm shadow-md">
                  {(r.approval_status === "APPROVED" || r.is_paused) &&
                    !r.is_delisted && (
                      <button
                        type="button"
                        className={menuItem}
                        onClick={() => togglePause(r)}
                      >
                        {r.is_paused ? "Unpause" : "Pause"}
                      </button>
                    )}
                  {(r.approval_status === "APPROVED" || r.is_paused) && (
                    <Link
                      href={`/publisher/hoardings/${r.id}/calendar`}
                      className={cn(menuItem, "block")}
                      onClick={() => setMenuId(null)}
                    >
                      View calendar
                    </Link>
                  )}
                  {r.approval_status === "DRAFT" && (
                    <button
                      type="button"
                      className={cn(menuItem, "text-danger-700")}
                      onClick={() => remove(r)}
                    >
                      Delete draft
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const menuItem = "w-full rounded px-3 py-2 text-left hover:bg-surface-2";
