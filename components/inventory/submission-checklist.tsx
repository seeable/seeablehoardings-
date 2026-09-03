"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import type { Blocker } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

/**
 * PB-03 Step 6 — the Submission Readiness checklist. Rendered straight from
 * `submission_readiness.blockers` (api-specification.md §11.3), so the same
 * component shows the pre-check and a `409` at submit.
 */
export function SubmissionChecklist({
  blockers,
  className,
}: {
  blockers: Blocker[];
  className?: string;
}) {
  if (blockers.length === 0) {
    return (
      <div
        className={cn(
          "border-success-700/30 bg-success-50 text-success-700 flex items-center gap-2 rounded-lg border p-3 text-sm",
          className,
        )}
      >
        <CircleCheck className="h-4 w-4 shrink-0" />
        Everything&apos;s ready — you can submit this listing for approval.
      </div>
    );
  }
  return (
    <ul className={cn("space-y-2", className)}>
      {blockers.map((b, i) => (
        <li
          key={`${b.code}-${i}`}
          className="border-border flex items-start gap-2 rounded-lg border p-3 text-sm"
        >
          <CircleAlert className="text-warning-700 mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-ink-800">{b.message}</span>
        </li>
      ))}
    </ul>
  );
}
