"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/card";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { CheckCircle2 } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";
import {
  listAdminHoardings,
  listAdminPublishers,
  suspendPublisher,
  unsuspendPublisher,
} from "@/lib/admin/client";
import { PublisherVerificationDrawer } from "@/components/admin/publisher-verification-drawer";
import { ListingReviewDrawer } from "@/components/admin/listing-review-drawer";
import { formatDate } from "@/lib/format";
import {
  LISTING_TABS,
  PUBLISHER_TABS,
  type AdminListingRow,
  type AdminPublisherRow,
  type ListingTab,
  type PublisherTab,
} from "@/lib/admin/types";

const PUB_TAB_LABEL: Record<PublisherTab, string> = {
  ALL: "All",
  PENDING: "Pending verification",
  VERIFIED: "Verified",
  SUSPENDED: "Suspended",
};
const LIST_TAB_LABEL: Record<ListingTab, string> = {
  ALL: "All",
  PENDING_REVIEW: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DELISTED: "Delisted",
};

const ALL_APPROVAL = ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"];

function pubQuery(tab: PublisherTab) {
  if (tab === "PENDING") return { verification_status: ["PENDING"] };
  if (tab === "VERIFIED")
    return { verification_status: ["VERIFIED"], suspended: "false" as const };
  if (tab === "SUSPENDED") return { suspended: "true" as const };
  return {};
}
function listQuery(tab: ListingTab) {
  if (tab === "PENDING_REVIEW") return { approval_status: ["PENDING_REVIEW"] };
  if (tab === "APPROVED")
    return { approval_status: ["APPROVED"], delisted: "false" as const };
  if (tab === "REJECTED") return { approval_status: ["REJECTED"] };
  if (tab === "DELISTED") return { delisted: "true" as const };
  return { approval_status: ALL_APPROVAL };
}

export function PublishersInventoryView() {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view") === "listings" ? "listings" : "publishers";
  const rawTab = params.get("tab") ?? "";

  const setView = (v: "publishers" | "listings") =>
    router.push(`/admin/inventory?view=${v}`);
  const setTab = (t: string) =>
    router.push(`/admin/inventory?view=${view}&tab=${t}`);

  return (
    <section>
      <h1 className="text-h1 text-ink-900">Publishers &amp; inventory</h1>

      <div
        role="radiogroup"
        aria-label="View"
        className="border-border mt-4 inline-flex rounded-md border p-0.5"
      >
        {(["publishers", "listings"] as const).map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={view === v}
            type="button"
            onClick={() => setView(v)}
            className={
              "rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors " +
              (view === v
                ? "bg-gold-500 text-gold-800"
                : "text-ink-700 hover:text-ink-900")
            }
          >
            {v}
          </button>
        ))}
      </div>

      {view === "publishers" ? (
        <PublishersTable
          tab={(PUBLISHER_TABS as readonly string[]).includes(rawTab) ? (rawTab as PublisherTab) : "ALL"}
          onTab={setTab}
        />
      ) : (
        <ListingsTable
          tab={(LISTING_TABS as readonly string[]).includes(rawTab) ? (rawTab as ListingTab) : "ALL"}
          onTab={setTab}
        />
      )}
    </section>
  );
}

// --- Publishers ----------------------------------------------------------

function PublishersTable({
  tab,
  onTab,
}: {
  tab: PublisherTab;
  onTab: (t: string) => void;
}) {
  const toast = useToast();
  const [rows, setRows] = React.useState<AdminPublisherRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  const [review, setReview] = React.useState<AdminPublisherRow | null>(null);
  const [suspendTarget, setSuspendTarget] = React.useState<AdminPublisherRow | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = React.useState<AdminPublisherRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listAdminPublishers({ ...pubQuery(tab), pageSize: 100 })
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load publishers.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [tab, nonce]);

  const tabItems: TabItem[] = PUBLISHER_TABS.map((t) => ({
    value: t,
    label: PUB_TAB_LABEL[t],
  }));

  async function doSuspend(reason: string) {
    if (!suspendTarget) return;
    setBusy(true);
    try {
      await suspendPublisher(suspendTarget.id, reason.trim() || undefined);
      toast.success(`${suspendTarget.business_name ?? "Publisher"} suspended.`);
      setSuspendTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Couldn't suspend.");
    } finally {
      setBusy(false);
    }
  }

  async function doUnsuspend() {
    if (!unsuspendTarget) return;
    setBusy(true);
    try {
      await unsuspendPublisher(unsuspendTarget.id);
      toast.success("Publisher restored.");
      setUnsuspendTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Couldn't un-suspend.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Tabs
        className="mt-4"
        items={tabItems}
        value={tab}
        onValueChange={onTab}
        aria-label="Publisher status"
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
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={CheckCircle2}
            tone="positive"
            headline={
              tab === "PENDING"
                ? "No publishers waiting for verification"
                : "No publishers here"
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          <Table>
            <THead>
              <tr>
                <TH>Business</TH>
                <TH>Contact</TH>
                <TH>Status</TH>
                <TH className="text-right">Listings</TH>
                <TH>Joined</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <span className="text-ink-900 font-medium">
                      {p.business_name ?? p.full_name ?? "—"}
                    </span>
                    {p.business_type && (
                      <span className="text-ink-500 block text-xs">
                        {p.business_type}
                      </span>
                    )}
                  </TD>
                  <TD className="text-ink-700">
                    <span className="block">{p.email ?? "—"}</span>
                    <span className="text-ink-500 text-xs">{p.phone ?? "—"}</span>
                  </TD>
                  <TD>
                    <StatusBadge
                      status={p.suspended ? "SUSPENDED" : p.verification_status}
                    />
                  </TD>
                  <TD className="text-ink-700 text-right tabular-nums">
                    {p.listing_counts.draft +
                      p.listing_counts.pending_review +
                      p.listing_counts.approved +
                      p.listing_counts.rejected}
                  </TD>
                  <TD className="text-ink-500">{formatDate(p.created_at)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {(p.verification_status === "PENDING" ||
                        p.verification_status === "UNVERIFIED" ||
                        p.verification_status === "REJECTED") && (
                        <Button size="sm" variant="ghost" onClick={() => setReview(p)}>
                          Review
                        </Button>
                      )}
                      {p.suspended ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setUnsuspendTarget(p)}
                        >
                          Un-suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSuspendTarget(p)}
                        >
                          Suspend
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <PublisherVerificationDrawer
        key={review?.id ?? "none"}
        publisher={review}
        onClose={() => setReview(null)}
        onResolved={reload}
      />

      <SuspendDialog
        key={suspendTarget?.id ?? "none"}
        publisher={suspendTarget}
        busy={busy}
        onClose={() => setSuspendTarget(null)}
        onConfirm={doSuspend}
      />

      <ConfirmDialog
        open={!!unsuspendTarget}
        onClose={() => setUnsuspendTarget(null)}
        onConfirm={doUnsuspend}
        loading={busy}
        confirmLabel="Un-suspend"
        title={`Restore ${unsuspendTarget?.business_name ?? "this publisher"}?`}
        message="Their approved listings return to Discover and they can create new listings again."
      />
    </>
  );
}

function SuspendDialog({
  publisher,
  busy,
  onClose,
  onConfirm,
}: {
  publisher: AdminPublisherRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  // Remounted per target via `key` at the call site — no reset effect needed.
  const [reason, setReason] = React.useState("");
  const liveCount = publisher?.listing_counts.approved ?? 0;

  return (
    <Modal
      open={!!publisher}
      onClose={onClose}
      title={`Suspend ${publisher?.business_name ?? "this publisher"}?`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" loading={busy} onClick={() => onConfirm(reason)}>
            Suspend publisher
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-ink-700">
          This blocks new listings and new submissions. It does{" "}
          <strong>not</strong> delist their {liveCount} approved listing
          {liveCount === 1 ? "" : "s"} and does <strong>not</strong> cancel any
          confirmed request — those campaigns continue as agreed (ADMIN-002).
        </p>
        <Textarea
          rows={3}
          placeholder="Reason (optional, recorded in the activity log)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// --- Listings ----------------------------------------------------------

function ListingsTable({
  tab,
  onTab,
}: {
  tab: ListingTab;
  onTab: (t: string) => void;
}) {
  const [rows, setRows] = React.useState<AdminListingRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  const [active, setActive] = React.useState<AdminListingRow | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listAdminHoardings({ ...listQuery(tab), pageSize: 100 })
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load listings.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [tab, nonce]);

  const tabItems: TabItem[] = LISTING_TABS.map((t) => ({
    value: t,
    label: LIST_TAB_LABEL[t],
  }));

  return (
    <>
      <Tabs
        className="mt-4"
        items={tabItems}
        value={tab}
        onValueChange={onTab}
        aria-label="Listing status"
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
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={CheckCircle2}
            tone="positive"
            headline={
              tab === "PENDING_REVIEW"
                ? "No listings waiting for approval"
                : "No listings here"
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          <Table>
            <THead>
              <tr>
                <TH>Listing</TH>
                <TH>Publisher</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((h) => (
                <TR key={h.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-surface-2 h-9 w-12 shrink-0 overflow-hidden rounded">
                        {h.primary_media_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.primary_media_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                      <span className="text-ink-900 font-medium">{h.title}</span>
                    </div>
                  </TD>
                  <TD className="text-ink-700">
                    <span className="inline-flex items-center gap-1">
                      {h.publisher.business_name ?? "—"}
                      {h.publisher.verification_status === "VERIFIED" && (
                        <VerifiedBadge />
                      )}
                    </span>
                  </TD>
                  <TD className="text-ink-700">{h.type.display_name}</TD>
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge status={h.display_status} />
                      {h.secondary_annotation && (
                        <span className="text-ink-500 max-w-[15rem] truncate text-xs">
                          {h.secondary_annotation}
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD className="text-ink-500">
                    {formatDate(h.submitted_at ?? h.created_at)}
                  </TD>
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setActive(h)}>
                      Review
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <p className="text-ink-500 mt-2 text-xs">
            Showing up to 100. {rows.length} shown.
          </p>
        </div>
      )}

      <ListingReviewDrawer
        key={active?.id ?? "none"}
        item={active}
        onClose={() => setActive(null)}
        onResolved={reload}
      />
    </>
  );
}
