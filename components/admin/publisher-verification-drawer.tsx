"use client";

import * as React from "react";
import { FileText, ExternalLink, ShieldAlert } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api/client";
import {
  verifyPublisher,
  rejectVerification,
  getVerificationDocumentUrl,
} from "@/lib/admin/client";
import { formatDate } from "@/lib/format";
import type { AdminPublisherRow } from "@/lib/admin/types";

/**
 * AD-03 — Publisher verification detail. Business info + the submitted document
 * + full contact detail (Admin is allowed to see it). Approve is one click;
 * Reject opens an inline required reason (a UX assumption — ADMIN-003 names the
 * listing-rejection reason rule; applying it here keeps the feedback consistent).
 * Approving lifts the OWNER-004 submission gate.
 */
export function PublisherVerificationDrawer({
  publisher,
  onClose,
  onResolved,
}: {
  publisher: AdminPublisherRow | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const toast = useToast();
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<"verify" | "reject" | "doc" | null>(null);

  if (!publisher) return null;
  const p = publisher;
  const decidable =
    p.verification_status === "PENDING" || p.verification_status === "UNVERIFIED";

  async function openDocument() {
    setBusy("doc");
    try {
      const url = await getVerificationDocumentUrl(p.id);
      if (!url) {
        toast.error("No document was submitted.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Couldn't open the document.");
    } finally {
      setBusy(null);
    }
  }

  async function act(kind: "verify" | "reject") {
    setBusy(kind);
    try {
      if (kind === "verify") {
        await verifyPublisher(p.id);
        toast.success(`${p.business_name ?? "Publisher"} verified.`);
      } else {
        await rejectVerification(p.id, reason.trim() || undefined);
        toast.success("Verification rejected.");
      }
      onResolved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Review verification"
      width="md"
      footer={
        !decidable ? (
          <p className="text-ink-500 text-sm">
            This publisher is {p.verification_status.toLowerCase()} — no action needed.
          </p>
        ) : rejecting ? (
          <div className="space-y-2">
            <Textarea
              rows={3}
              placeholder="Reason (shown to the Publisher) — required"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setRejecting(false)}
                disabled={busy !== null}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={reason.trim().length === 0}
                loading={busy === "reject"}
                onClick={() => act("reject")}
              >
                Reject verification
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              onClick={() => setRejecting(true)}
              disabled={busy !== null}
            >
              Reject…
            </Button>
            <Button loading={busy === "verify"} onClick={() => act("verify")}>
              Verify publisher
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 p-4">
        <div>
          <h3 className="text-h3 text-ink-900">
            {p.business_name ?? p.full_name ?? "Unnamed publisher"}
          </h3>
          <div className="mt-1">
            <StatusBadge status={p.suspended ? "SUSPENDED" : p.verification_status} />
          </div>
        </div>

        {p.suspended && (
          <Alert tone="warning">
            This publisher is suspended
            {p.suspension_reason ? ` — ${p.suspension_reason}` : ""}.
          </Alert>
        )}

        {p.verification_status === "REJECTED" && p.verification_rejection_reason && (
          <Alert tone="danger">
            Previously rejected: {p.verification_rejection_reason}
          </Alert>
        )}

        <dl className="text-sm">
          <Row label="Business name" value={p.business_name ?? "—"} />
          <Row label="Business type" value={p.business_type ?? "—"} />
          <Row label="Contact name" value={p.full_name ?? "—"} />
          <Row label="Phone" value={p.phone ?? "—"} />
          <Row label="Email" value={p.email ?? "—"} />
          <Row label="City" value={p.city ?? "—"} />
          <Row
            label="Submitted"
            value={
              p.verification_submitted_at
                ? formatDate(p.verification_submitted_at)
                : "—"
            }
          />
          <Row
            label="Listings"
            value={`${p.listing_counts.draft} draft · ${p.listing_counts.pending_review} pending · ${p.listing_counts.approved} approved`}
          />
        </dl>

        {p.has_verification_document ? (
          <Button
            variant="secondary"
            size="sm"
            loading={busy === "doc"}
            onClick={openDocument}
          >
            <FileText className="h-4 w-4" /> View document
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <p className="text-warning-700 flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4" /> No verification document submitted.
          </p>
        )}
      </div>
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border flex justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 text-right">{value}</dd>
    </div>
  );
}
