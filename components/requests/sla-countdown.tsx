"use client";

import * as React from "react";
import { formatCountdown, formatDateTime } from "@/lib/format";
import { SLA_URGENT_HOURS } from "@/lib/requests/types";
import { cn } from "@/lib/utils";

/**
 * SLA countdown — docs/04 PB-06 / docs/03 VW-05 / docs/07 §Accessibility.
 * The live "in 3 h" text is `aria-hidden` and refreshes each minute; a static
 * "Respond by 2 Sep, 6:00 PM" is always present for assistive tech. Turns
 * `warning-700` inside the final-hours window (colour + text, never colour
 * alone).
 */
export function SlaCountdown({
  deadline,
  prefix = "",
  className,
}: {
  deadline: string;
  prefix?: string;
  className?: string;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hoursLeft = (new Date(deadline).getTime() - nowMs) / 3_600_000;
  const overdue = hoursLeft <= 0;
  const urgent = !overdue && hoursLeft <= SLA_URGENT_HOURS;

  return (
    <span
      className={cn(
        "text-xs",
        urgent ? "text-warning-700 font-medium" : "text-ink-500",
        className,
      )}
    >
      <span aria-hidden="true">
        {prefix}
        {overdue ? "response overdue" : formatCountdown(deadline, new Date(nowMs))}
      </span>
      <span className="sr-only">Respond by {formatDateTime(deadline)}</span>
    </span>
  );
}
