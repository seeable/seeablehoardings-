/**
 * PB-01 dashboard derivations — pure, so they unit-test without the server
 * bundle. The counts come from the Publisher's own `hoardings` and `requests`
 * collections (api-spec §22.6 — "no new aggregate/analytics endpoint").
 */
import type {
  AttentionItem,
  PublisherSummary,
  VerificationStatus,
} from "@/lib/publisher/types";

export interface ListingRow {
  approval_status: string;
  is_paused: boolean;
  is_delisted: boolean;
}
export interface RequestRow {
  status: string;
  amount_agreed: number | null;
  confirmed_at: string | null;
}

/** "YYYY-MM" of a timestamp in IST. */
export function istMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date(iso))
    .slice(0, 7);
}

export function deriveSummary(
  listings: ListingRow[],
  requests: RequestRow[],
  verification_status: VerificationStatus,
  suspended: boolean,
  now = new Date(),
): PublisherSummary {
  const isLive = (l: ListingRow) =>
    l.approval_status === "APPROVED" && !l.is_paused && !l.is_delisted;
  const thisMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .slice(0, 7);

  const held = requests.filter((r) =>
    ["CONFIRMED", "LIVE", "COMPLETED"].includes(r.status),
  );

  return {
    listings: {
      total: listings.length,
      live_in_search: listings.filter(isLive).length,
      pending_approval: listings.filter((l) => l.approval_status === "PENDING_REVIEW").length,
      draft: listings.filter((l) => l.approval_status === "DRAFT").length,
      rejected: listings.filter((l) => l.approval_status === "REJECTED").length,
    },
    requests: {
      awaiting_response: requests.filter((r) => r.status === "REQUESTED").length,
      confirmed: requests.filter((r) => r.status === "CONFIRMED").length,
      live: requests.filter((r) => r.status === "LIVE").length,
      completed: requests.filter((r) => r.status === "COMPLETED").length,
      expired: requests.filter((r) => r.status === "EXPIRED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    },
    confirmed_value: {
      amount: held.reduce((s, r) => s + (r.amount_agreed ?? 0), 0),
      currency: "INR",
      basis: "SUM of amount_agreed where recorded",
    },
    confirmed_this_month: held.filter(
      (r) => r.confirmed_at && istMonth(r.confirmed_at) === thisMonth,
    ).length,
    verification_status,
    suspended,
  };
}

/** "Needs Your Attention" (docs/04 PB-01): requests near their SLA deadline +
 *  Admin-rejected listings. Ordered most-urgent first. */
export function selectNeedsAttention(
  pending: {
    id: string;
    hoarding: { title: string };
    viewer: { full_name: string | null } | null;
    sla_deadline: string | null;
  }[],
  rejectedListings: { id: string; title: string; rejection_reason: string | null }[],
  now = new Date(),
): AttentionItem[] {
  const nowMs = now.getTime();
  const sla: AttentionItem[] = pending
    .filter((r) => r.sla_deadline)
    .map((r) => {
      const hrs =
        (new Date(r.sla_deadline as string).getTime() - nowMs) / 3_600_000;
      return {
        kind: "sla" as const,
        id: r.id,
        title: r.hoarding.title,
        detail: `Request from ${r.viewer?.full_name ?? "a viewer"} — ${
          hrs <= 0
            ? "response overdue"
            : `respond within ${Math.max(1, Math.round(hrs))}h`
        }`,
        href: `/publisher/requests?status=REQUESTED&open=${r.id}`,
        hrs,
      };
    })
    .filter((x) => x.hrs <= 24) // within a day of the deadline, or overdue
    .sort((a, b) => a.hrs - b.hrs)
    .map(
      (x): AttentionItem => ({
        kind: x.kind,
        id: x.id,
        title: x.title,
        detail: x.detail,
        href: x.href,
      }),
    );

  const rejected: AttentionItem[] = rejectedListings.map((l) => ({
    kind: "rejected_listing",
    id: l.id,
    title: l.title,
    detail: l.rejection_reason
      ? `Rejected by SEEABLE — “${l.rejection_reason}”`
      : "Rejected by SEEABLE — edit and resubmit",
    href: `/publisher/hoardings/${l.id}/edit`,
  }));

  return [...sla, ...rejected];
}
