import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Empty state — docs/07 §21.2. One anatomy everywhere: a specific headline
 * (never "No data"), one sentence of context/next step, and at most one action.
 * No illustrations. Tone is set by the caller:
 *   neutral  — a genuinely empty list (new account)
 *   positive — "you're all caught up" (an approval queue at zero)
 *   filtered — narrowed to nothing; the action is usually "Clear filters"
 */
export function EmptyState({
  icon: Icon,
  headline,
  body,
  action,
  tone = "neutral",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  headline: string;
  body?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "positive" | "filtered";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "mb-3 h-6 w-6",
            tone === "positive" ? "text-success-700" : "text-ink-500",
          )}
        />
      )}
      <p className="text-h4 text-ink-900">{headline}</p>
      {body && <p className="text-ink-700 mt-1 max-w-sm text-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
