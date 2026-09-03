"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { RequestStatusPill } from "@/components/requests/request-status-pill";
import { SlaCountdown } from "@/components/requests/sla-countdown";
import { formatDateRange } from "@/lib/format";
import type { RequestActorRole, RequestResource } from "@/lib/requests/types";

/**
 * Request Card — docs/02 §10.4. One row in VW-05 (My Requests) or PB-06
 * (Incoming Requests). Shows enough to recognise the listing without reopening
 * it, the requested dates, the role-scoped status, and a context line
 * (SLA countdown while Pending, the counterparty otherwise).
 */
export function RequestCard({
  request: r,
  role,
  onOpen,
}: {
  request: RequestResource;
  role: RequestActorRole;
  onOpen: () => void;
}) {
  const [imgBroken, setImgBroken] = React.useState(false);
  const counterparty =
    role === "PUBLISHER"
      ? (r.viewer?.full_name ?? "A viewer")
      : (r.publisher.business_name ?? "SEEABLE Publisher");

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="border-border bg-surface-1 hover:border-ink-300 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
      >
        <div className="bg-surface-2 text-ink-300 flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded">
          {r.hoarding.primary_media_url && !imgBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.hoarding.primary_media_url}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <ImageOff className="h-5 w-5" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-ink-900 truncate text-sm font-semibold">
            {r.hoarding.title}
          </p>
          <p className="text-ink-700 text-xs">
            {formatDateRange(r.start_date, r.end_date)} · {counterparty}
          </p>
          {r.status === "REQUESTED" && r.sla_deadline ? (
            <SlaCountdown
              deadline={r.sla_deadline}
              prefix={role === "PUBLISHER" ? "Respond " : "Awaiting a response · "}
              className="mt-0.5 block"
            />
          ) : r.status === "REJECTED" && r.rejection_reason ? (
            <p className="text-ink-500 mt-0.5 truncate text-xs">
              “{r.rejection_reason}”
            </p>
          ) : !r.hoarding.is_currently_listed ? (
            <p className="text-ink-500 mt-0.5 text-xs">
              This listing is no longer available.
            </p>
          ) : null}
        </div>

        <RequestStatusPill
          status={r.status}
          role={role}
          label={r.status_label}
        />
      </button>
    </li>
  );
}
