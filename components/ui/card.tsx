import * as React from "react";
import { cn } from "@/lib/utils";

/** Card — docs/02 §10.4. `radius-lg`, 1px border, `shadow-sm` at rest. */
export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "border-border bg-surface-1 rounded-lg border p-4 shadow-sm sm:p-6",
        // hover lift is desktop-only; no elevation change on touch (§10.4)
        interactive &&
          "transition-shadow hover:shadow-md motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Dashboard Metric Card — docs/02 §10.4. Large number, label above, optional
 * trend/hint caption below.
 */
export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface-1 rounded-lg border p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <p className="text-label text-ink-700">{label}</p>
      <p className="text-h1 text-ink-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-ink-500 mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function Alert({
  tone = "danger",
  className,
  children,
}: {
  tone?: "danger" | "success" | "info" | "warning";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    danger: "bg-danger-50 text-danger-700",
    success: "bg-success-50 text-success-700",
    info: "bg-info-50 text-info-700",
    warning: "bg-warning-50 text-warning-700",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-md px-3 py-2 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}
