import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data table primitives — docs/07 §18. Semantic <table>, sticky header, 44px
 * rows, row-hover `surface-2`, sortable headers with a caret.
 *
 * Responsive collapse (table → stacked cards below `md`) is per-screen: which
 * fields survive the collapse differs by table, so each screen renders its own
 * mobile card list and hides this table with `hidden md:block`.
 */

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-surface-2 text-ink-700 sticky top-0 z-10 text-[13px]",
        className,
      )}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-border hover:bg-surface-2 border-b last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-11 px-3 align-middle", className)} {...props} />;
}

type SortDir = "asc" | "desc" | null;

export function TH({
  children,
  className,
  sortable,
  sortDir = null,
  onSort,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  sortable?: boolean;
  sortDir?: SortDir;
  onSort?: () => void;
}) {
  return (
    <th
      scope="col"
      aria-sort={
        sortable
          ? sortDir === "asc"
            ? "ascending"
            : sortDir === "desc"
              ? "descending"
              : "none"
          : undefined
      }
      className={cn("h-11 px-3 font-medium", className)}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="hover:text-ink-900 -mx-1 inline-flex items-center gap-1 rounded px-1"
        >
          {children}
          {sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : sortDir === "desc" ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-30" aria-hidden />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}
