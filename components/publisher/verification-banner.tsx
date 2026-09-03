import Link from "next/link";
import type { VerificationStatus } from "@/lib/publisher/types";

/**
 * Slim verification bar (docs/04 PB-08 "Pending" state) — shown on PB-01 / PB-02
 * / the wizard while a Publisher is not yet verified. Silent once VERIFIED
 * (the steady state should recede, not keep announcing itself).
 */
export function VerificationBanner({ status }: { status: VerificationStatus }) {
  if (status === "VERIFIED") return null;

  const copy: Record<Exclude<VerificationStatus, "VERIFIED">, string> = {
    UNVERIFIED: "Verify your business to publish listings — drafts are always fine.",
    PENDING: "Your account is pending verification. Listings stay as drafts until it's approved.",
    REJECTED: "Your verification needs another look.",
  };
  const cta = status === "PENDING" ? "Learn more" : "Get verified";

  return (
    <div
      role="status"
      className="bg-warning-50 text-warning-700 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
    >
      <span>{copy[status]}</span>
      <Link href="/publisher/verify" className="shrink-0 font-medium underline">
        {cta}
      </Link>
    </div>
  );
}
