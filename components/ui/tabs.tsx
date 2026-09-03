"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  /** Optional count shown after the label, e.g. "Pending approval (3)". */
  count?: number;
}

/**
 * Underline tabs / status filters — docs/02 §10.5. Active = `ink-900` text +
 * `gold-500` 2px underline; each tab may carry a count. Controlled: a screen
 * that wants the filter in the URL passes `onValueChange={v => router.push(…)}`.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const i = items.findIndex((t) => t.value === value);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onValueChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "border-border flex gap-1 overflow-x-auto border-b",
        className,
      )}
    >
      {items.map((tab, i) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
              selected
                ? "border-gold-500 text-ink-900"
                : "text-ink-700 hover:text-ink-900 border-transparent",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn("ml-1", selected ? "text-ink-700" : "text-ink-500")}>
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
