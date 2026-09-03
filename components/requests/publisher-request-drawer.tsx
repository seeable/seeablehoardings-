"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { RequestStatusPill } from "@/components/requests/request-status-pill";
import { SlaCountdown } from "@/components/requests/sla-countdown";
import { actOnRequest } from "@/lib/requests/client";
import { ApiClientError } from "@/lib/api/client";
import { formatDateRange, formatDateTime, formatPrice } from "@/lib/format";
import type { RequestResource } from "@/lib/requests/types";

/**
 * PB-07 Request Detail (docs/04 PB-07). Accept is one click (no second modal);
 * Reject is an inline expansion with an optional reason. The accept-race
 * (`REQUEST_DATE_CONFLICT`) is a named state — per api-spec §19.3 the losing
 * request stays `REQUESTED`, so the copy says "still pending", not "auto-rejected"
 * (a deliberate divergence from docs/04's older wording).
 */
export function PublisherRequestDrawer({
  request,
  open,
  onClose,
  onChanged,
}: {
  request: RequestResource | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={request?.hoarding.title ?? "Request"}
      width="md"
    >
      {request && (
        <Body key={request.id} request={request} onClose={onClose} onChanged={onChanged} />
      )}
    </Drawer>
  );
}

function Body({
  request: r,
  onClose,
  onChanged,
}: {
  request: RequestResource;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [conflict, setConflict] = React.useState(false);

  const can = (a: string) => r.available_actions.includes(a as never);
  const dates = formatDateRange(r.start_date, r.end_date);

  async function run(
    action: "ACCEPT" | "REJECT" | "COMPLETE",
    extra?: { reason?: string },
  ) {
    setBusy(true);
    setConflict(false);
    try {
      await actOnRequest(r.id, action, extra);
      toast.success(
        action === "ACCEPT"
          ? `Request confirmed — ${dates} is now booked.`
          : action === "REJECT"
            ? "Request declined."
            : "Request marked completed.",
      );
      onChanged();
      onClose();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "REQUEST_DATE_CONFLICT") {
        setConflict(true);
      } else if (e instanceof ApiClientError && e.code === "REQUEST_STATE_CONFLICT") {
        toast.error("This request already changed — refreshing.");
        onChanged();
        onClose();
      } else {
        toast.error(
          e instanceof ApiClientError ? e.message : "Couldn't complete that.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RequestStatusPill status={r.status} role="PUBLISHER" label={r.status_label} />
          {r.status === "REQUESTED" && r.sla_deadline && (
            <SlaCountdown deadline={r.sla_deadline} prefix="Respond " />
          )}
        </div>

        {conflict && (
          <Alert tone="warning">
            These dates were just confirmed for a different request. This one is
            still pending — you can decline it, or leave it to expire.
          </Alert>
        )}

        <div>
          <p className="text-ink-500 text-xs">Requested by</p>
          <p className="text-ink-900 text-sm font-medium">
            {r.viewer?.full_name ?? "A viewer"}
          </p>
        </div>

        <dl className="divide-border divide-y text-sm">
          <Row label="Dates">
            {dates} · {r.duration_days} day{r.duration_days === 1 ? "" : "s"}
          </Row>
          <Row label="Listing">{r.hoarding.title}</Row>
          <Row label="Listed price">
            {formatPrice(r.hoarding.price, r.hoarding.price_unit)}
          </Row>
          {r.amount_agreed != null && (
            <Row label="Amount agreed">{formatPrice(r.amount_agreed, null)}</Row>
          )}
          {r.status === "REQUESTED" && r.sla_deadline && (
            <Row label="SLA deadline">{formatDateTime(r.sla_deadline)}</Row>
          )}
        </dl>

        {r.message ? (
          <div>
            <p className="text-ink-500 text-xs">Message</p>
            <p className="text-ink-800 text-sm whitespace-pre-line">{r.message}</p>
          </div>
        ) : (
          <p className="text-ink-500 text-sm">No message from the viewer.</p>
        )}

        {rejecting && (
          <div className="border-border space-y-2 rounded-lg border p-3">
            <label
              htmlFor="reject-reason"
              className="text-ink-700 block text-sm font-medium"
            >
              Reason <span className="text-ink-500 font-normal">(optional)</span>
            </label>
            <Textarea
              id="reject-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shared with the viewer."
            />
            <Button
              variant="destructive"
              loading={busy}
              onClick={() => run("REJECT", { reason: reason.trim() || undefined })}
            >
              Confirm rejection
            </Button>
          </div>
        )}
      </div>

      {(can("ACCEPT") || can("REJECT") || can("COMPLETE")) && !rejecting && (
        <div className="border-border flex gap-2 border-t p-4">
          {can("REJECT") && (
            <Button
              variant="destructive"
              className="flex-1"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          )}
          {can("ACCEPT") && (
            <Button className="flex-1" loading={busy} onClick={() => run("ACCEPT")}>
              Accept
            </Button>
          )}
          {can("COMPLETE") && (
            <Button className="flex-1" loading={busy} onClick={() => run("COMPLETE")}>
              Mark completed
            </Button>
          )}
        </div>
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
