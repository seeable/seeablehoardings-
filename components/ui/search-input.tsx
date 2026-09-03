"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

/**
 * Search field with a leading icon and a clear "×" — docs/02 §10.2.
 * Controlled: parent owns `value`. Debouncing (VW-01) is the caller's job.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, placeholder = "Search", ...props }, ref) => (
    <div className="relative">
      <Search
        className="text-ink-500 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "bg-surface-1 text-ink-900 placeholder:text-ink-500 h-10 w-full rounded-md border pr-9 pl-9 text-sm",
          "border-border focus-visible:outline-2 focus-visible:outline-offset-2",
          "[&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          aria-label="Clear search"
          className="text-ink-500 hover:text-ink-900 absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
