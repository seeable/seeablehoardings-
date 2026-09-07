import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Status Badge / Pill — docs/02 §10.3 + the §9.1 status→color mapping.
 * Text-first, always: the word carries the meaning, colour only reinforces it
 * (docs/07 §24.1). Pass the raw DB enum value as `status`.
 */

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-700",
  neutral: "bg-neutral-50 text-neutral-700",
};

/** Raw status enum → { label (sentence case), tone }. Covers listing, request
 *  and publisher statuses. §25: a listing's "Pending approval" and a request's
 *  "Pending" never collapse to the same bare word. */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  // Listing (hoardings.approval_status) + Paused/Delisted derived states
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_REVIEW: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  PAUSED: { label: "Paused", tone: "neutral" },
  DELISTED: { label: "Delisted", tone: "danger" },
  // Request (requests.status)
  REQUESTED: { label: "Pending", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  LIVE: { label: "Live", tone: "info" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  // Shared
  REJECTED: { label: "Rejected", tone: "danger" },
  // Publisher (publisher_profiles.verification_status)
  UNVERIFIED: { label: "Pending verification", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Override the derived label (e.g. a server-supplied `status_label`). */
  label?: string;
  className?: string;
}) {
  const meta = STATUS[status] ?? { label: label ?? status, tone: "neutral" as Tone };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-3 text-[13px] font-medium whitespace-nowrap",
        TONE[meta.tone],
        className,
      )}
    >
      {label ?? meta.label}
    </span>
  );
}

/**
 * Verified badge — docs/02 §10.3. A compact, pill-less mark that sits inline
 * next to a Publisher's name; visually lighter than a full status pill so it
 * doesn't compete with the listing/request status on the same card.
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-gold-500 inline-flex items-center gap-1 text-xs font-semibold",
        className,
      )}
    >
      <span
        className="bg-gold-500 flex h-4 w-4 items-center justify-center rounded-full"
        aria-hidden
      >
        <Check className="text-gold-800 h-3 w-3" strokeWidth={3} />
      </span>
      Verified
    </span>
  );
}
