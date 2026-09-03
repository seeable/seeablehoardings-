"use client";

import * as React from "react";
import { CircleAlert, Info } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/card";
import { PhotoCarousel } from "@/components/discovery/photo-carousel";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api/client";
import {
  approveListing,
  rejectListing,
  delistHoarding,
  relistHoarding,
} from "@/lib/admin/client";
import { formatPrice, formatDate } from "@/lib/format";
import { humanizeAttributeKey } from "@/lib/inventory/attributes";
import type { AdminListingRow } from "@/lib/admin/types";

const SI_LABEL: Record<string, string> = {
  traffic_volume: "Traffic volume",
  visibility_rating: "Visibility rating",
  nearby_landmarks: "Nearby landmarks",
};
const titleCase = (s: string) => (s.length <= 3 ? s : s[0] + s.slice(1).toLowerCase());

type Action = "approve" | "reject" | "delist" | "relist";

/**
 * AD-04 — the single-listing review surface. Same content blocks a Viewer sees
 * (photos, details, Site Intelligence, specs) plus an Admin header. Approve is
 * one click; Reject requires a reason (ADMIN-003). For an approved listing the
 * footer offers Delist (reason optional, ADMIN-004); for a delisted one, Re-list.
 * DRAFT / REJECTED listings are read-only here.
 */
export function ListingReviewDrawer({
  item,
  onClose,
  onResolved,
}: {
  item: AdminListingRow | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const toast = useToast();
  // Remounted per listing via `key` at the call site — no reset effect needed.
  const [mode, setMode] = React.useState<"idle" | "reject" | "delist">("idle");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<Action | null>(null);

  if (!item) return null;
  const h = item;

  async function act(kind: Action) {
    setBusy(kind);
    try {
      if (kind === "approve") {
        await approveListing(h.id);
        toast.success("Listing approved — it's live in Discover now.");
      } else if (kind === "reject") {
        await rejectListing(h.id, reason.trim());
        toast.success("Listing rejected.");
      } else if (kind === "delist") {
        await delistHoarding(h.id, reason.trim() || undefined);
        toast.success("Listing delisted.");
      } else {
        await relistHoarding(h.id);
        toast.success("Listing re-listed.");
      }
      onResolved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  const attrs = Object.entries(h.attributes ?? {}).filter(
    ([, v]) => v !== null && v !== "" && v !== undefined,
  );
  const si = Object.entries(h.site_intelligence ?? {}).filter(
    ([, v]) => v !== null && v !== "" && v !== undefined,
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title="Review listing"
      width="lg"
      footer={<Footer />}
    >
      <div className="space-y-4 p-4">
        <PhotoCarousel
          images={h.media.map((m, i) => ({ id: String(i), url: m.url }))}
          title={h.title}
        />

        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-h3 text-ink-900">{h.title}</h3>
            <StatusBadge status={h.display_status} />
          </div>
          <p className="text-ink-700 text-sm">
            {h.type.display_name} · {formatPrice(h.price, h.price_unit)}
          </p>
          <p className="text-ink-500 mt-0.5 flex items-center gap-1.5 text-sm">
            Submitted by {h.publisher.business_name ?? "Unknown publisher"}
            {h.publisher.verification_status === "VERIFIED" && <VerifiedBadge />}
            {" · "}
            {formatDate(h.submitted_at ?? h.created_at)}
          </p>
        </div>

        {h.secondary_annotation && (
          <Alert tone={h.is_delisted ? "danger" : "warning"}>
            {h.secondary_annotation}
          </Alert>
        )}

        {h.review_flags.map((f) => (
          <p
            key={f.code}
            className={
              (f.severity === "WARN"
                ? "bg-warning-50 text-warning-700"
                : "bg-info-50 text-info-700") +
              " flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            }
          >
            {f.severity === "WARN" ? (
              <CircleAlert className="h-4 w-4 shrink-0" />
            ) : (
              <Info className="h-4 w-4 shrink-0" />
            )}
            {f.message}
          </p>
        ))}

        <dl className="text-sm">
          <Row
            label="Location"
            value={[h.locality, h.city].filter(Boolean).join(", ") || "—"}
          />
          <Row
            label="Coordinates"
            value={h.latitude != null ? `${h.latitude}, ${h.longitude}` : "—"}
          />
          <Row label="Size" value={h.size ?? "—"} />
          <Row
            label="Photos"
            value={`${h.media_summary.watermarked} ready${
              h.media_summary.processing
                ? ` · ${h.media_summary.processing} processing`
                : ""
            }${h.media_summary.failed ? ` · ${h.media_summary.failed} failed` : ""}`}
          />
          {si.map(([k, v]) => (
            <Row
              key={k}
              label={SI_LABEL[k] ?? humanizeAttributeKey(k)}
              value={typeof v === "string" ? titleCase(v) : String(v)}
            />
          ))}
          {attrs.map(([k, v]) => (
            <Row key={k} label={humanizeAttributeKey(k)} value={String(v)} />
          ))}
        </dl>

        {h.description && <p className="text-ink-700 text-sm">{h.description}</p>}
      </div>
    </Drawer>
  );

  function Footer() {
    if (mode === "reject" || mode === "delist") {
      const isReject = mode === "reject";
      return (
        <div className="space-y-2">
          <Textarea
            rows={3}
            placeholder={
              isReject
                ? "Reason (shown to the Publisher) — required"
                : "Reason (optional, recorded in the activity log)"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setMode("idle")}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isReject && reason.trim().length === 0}
              loading={busy === (isReject ? "reject" : "delist")}
              onClick={() => act(isReject ? "reject" : "delist")}
            >
              {isReject ? "Reject listing" : "Delist listing"}
            </Button>
          </div>
        </div>
      );
    }

    if (h.approval_status === "PENDING_REVIEW") {
      return (
        <div className="flex justify-end gap-2">
          <Button
            variant="destructive"
            onClick={() => setMode("reject")}
            disabled={busy !== null}
          >
            Reject…
          </Button>
          <Button loading={busy === "approve"} onClick={() => act("approve")}>
            Approve
          </Button>
        </div>
      );
    }

    if (h.is_delisted) {
      return (
        <div className="flex justify-end">
          <Button loading={busy === "relist"} onClick={() => act("relist")}>
            Re-list
          </Button>
        </div>
      );
    }

    if (h.approval_status === "APPROVED") {
      return (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setMode("delist")}
            disabled={busy !== null}
          >
            Delist…
          </Button>
        </div>
      );
    }

    return (
      <p className="text-ink-500 text-sm">
        {h.display_status === "DRAFT"
          ? "This listing is still a draft."
          : "This listing was rejected. The Publisher can edit and resubmit it."}
      </p>
    );
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border flex justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 text-right">{value}</dd>
    </div>
  );
}
