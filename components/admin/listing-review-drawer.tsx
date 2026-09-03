"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api/client";
import { formatPrice, formatDate } from "@/lib/format";
import { humanizeAttributeKey } from "@/lib/inventory/attributes";

export interface QueueItem {
  id: string;
  title: string;
  type_display_name: string;
  price: number | null;
  price_unit: string;
  locality: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  size: string | null;
  attributes: Record<string, unknown>;
  site_intelligence: Record<string, unknown>;
  site_intelligence_complete: boolean;
  created_at: string;
  publisher_business_name: string | null;
  publisher_is_verified: boolean;
  primary_media_url: string | null;
  media_count: number;
}

/**
 * AD-04 (minimal) — the listing approval drawer. Approve is one click; Reject
 * requires a reason (ADMIN-003), shown as an inline expansion rather than a
 * stacked modal (docs/07 §19). Full AD-02 is Phase 9.
 */
export function ListingReviewDrawer({
  item,
  onClose,
  onResolved,
}: {
  item: QueueItem | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const toast = useToast();
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<"approve" | "reject" | null>(null);

  if (!item) return null;

  async function act(kind: "approve" | "reject") {
    setBusy(kind);
    try {
      if (kind === "approve") {
        await api.post(`/api/v1/admin/hoardings/${item!.id}/approve`);
        toast.success("Listing approved.");
      } else {
        await api.post(`/api/v1/admin/hoardings/${item!.id}/reject`, {
          reason: reason.trim(),
        });
        toast.success("Listing rejected.");
      }
      onResolved();
      onClose();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "That didn't work.",
      );
    } finally {
      setBusy(null);
    }
  }

  const attrs = Object.entries(item.attributes ?? {}).filter(
    ([, v]) => v !== null && v !== "",
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title="Review listing"
      width="lg"
      footer={
        rejecting ? (
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
                Reject listing
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
            <Button loading={busy === "approve"} onClick={() => act("approve")}>
              Approve
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 p-4">
        {item.primary_media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.primary_media_url}
            alt=""
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}
        <div>
          <h3 className="text-h3 text-ink-900">{item.title}</h3>
          <p className="text-ink-700 text-sm">
            {item.type_display_name} · {formatPrice(item.price, item.price_unit)}
          </p>
          <p className="text-ink-500 mt-0.5 flex items-center gap-1.5 text-sm">
            {item.publisher_business_name ?? "Unknown publisher"}
            {item.publisher_is_verified && <VerifiedBadge />}
          </p>
        </div>

        {!item.site_intelligence_complete && (
          <p className="bg-warning-50 text-warning-700 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <CircleAlert className="h-4 w-4" /> Site intelligence incomplete
            (INVENTORY-002) — not a blocker.
          </p>
        )}

        <dl className="text-sm">
          <Row label="Location" value={[item.locality, item.city].filter(Boolean).join(", ")} />
          <Row
            label="Coordinates"
            value={
              item.latitude != null ? `${item.latitude}, ${item.longitude}` : "—"
            }
          />
          <Row label="Size" value={item.size ?? "—"} />
          <Row label="Photos" value={String(item.media_count)} />
          <Row label="Submitted" value={formatDate(item.created_at)} />
          {attrs.map(([k, v]) => (
            <Row key={k} label={humanizeAttributeKey(k)} value={String(v)} />
          ))}
        </dl>

        {item.description && (
          <p className="text-ink-700 text-sm">{item.description}</p>
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
