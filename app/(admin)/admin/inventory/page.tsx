"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatPrice, formatDate } from "@/lib/format";
import {
  ListingReviewDrawer,
  type QueueItem,
} from "@/components/admin/listing-review-drawer";

/**
 * AD-04 (minimal) — the listing approval queue. Oldest-waiting first. Full
 * Publishers & Inventory management (AD-02) is Phase 9.
 */
export default function AdminInventoryPage() {
  const [items, setItems] = React.useState<QueueItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState<QueueItem | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const load = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<{ hoardings: QueueItem[] }>("/api/v1/admin/hoardings?pageSize=100")
      .then((r) => {
        if (cancelled) return;
        setItems(r.data.hoardings);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load the queue.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return (
    <section>
      <h1 className="text-h1 text-ink-900">Publishers &amp; inventory</h1>
      <p className="text-ink-700 mt-1 text-sm">
        Listings awaiting approval. Publisher verification and the full inventory
        table arrive in Phase 9.
      </p>

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
          <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </div>
      ) : items === null ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={CheckCircle2}
            tone="positive"
            headline="You're all caught up"
            body="No listings are waiting for review."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => setActive(h)}
                className="border-border bg-surface-1 hover:bg-surface-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left"
              >
                <div className="bg-surface-2 h-12 w-16 shrink-0 overflow-hidden rounded">
                  {h.primary_media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.primary_media_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900 truncate text-sm font-semibold">
                    {h.title}
                  </p>
                  <p className="text-ink-500 flex items-center gap-1.5 text-xs">
                    {h.publisher_business_name ?? "Unknown"}
                    {h.publisher_is_verified && <VerifiedBadge />}
                    · {h.type_display_name} ·{" "}
                    {formatPrice(h.price, h.price_unit)}
                  </p>
                </div>
                <span className="text-ink-500 shrink-0 text-xs">
                  {formatDate(h.created_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ListingReviewDrawer
        key={active?.id ?? "none"}
        item={active}
        onClose={() => setActive(null)}
        onResolved={load}
      />
    </section>
  );
}
