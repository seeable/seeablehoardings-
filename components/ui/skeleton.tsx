import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton block — docs/07 §21.1. Skeletons (shaped like the eventual content),
 * never spinners, for content-bearing views. Respects `prefers-reduced-motion`
 * via the global rule in globals.css (the pulse animation collapses).
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("bg-surface-2 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

/** N lines of text placeholder; the last line is shorter. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
