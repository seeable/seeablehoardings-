"use client";

import { Check, Lock } from "lucide-react";
import type { HoardingTypeView } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

/**
 * PB-03 Step 1 — the type grid. Static types are selectable; digital types are
 * shown with a "Coming soon" tag and disabled (api-specification.md §12.3:
 * `is_digital` -> HOARDING_TYPE_NOT_LISTABLE, so they can't be drafted at MVP).
 */
export function TypeGrid({
  types,
  value,
  onChange,
  disabled,
}: {
  types: HoardingTypeView[];
  value: string | null;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {types.map((t) => {
        const selected = t.code === value;
        const locked = !t.is_listable || disabled;
        return (
          <button
            key={t.code}
            type="button"
            disabled={locked && !selected}
            aria-pressed={selected}
            onClick={() => onChange(t.code)}
            className={cn(
              "relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
              selected
                ? "border-gold-500 bg-gold-100/40 ring-gold-500 ring-1"
                : "border-border bg-surface-1 hover:bg-surface-2",
              locked && !selected && "cursor-not-allowed opacity-55",
            )}
          >
            <span className="text-h4 text-ink-900 flex items-center gap-1.5">
              {t.display_name}
              {selected && <Check className="text-gold-700 h-4 w-4" />}
              {!t.is_listable && (
                <Lock className="text-ink-500 h-3.5 w-3.5" aria-hidden />
              )}
            </span>
            {t.description && (
              <span className="text-ink-700 mt-1 text-sm">{t.description}</span>
            )}
            {!t.is_listable && (
              <span className="bg-surface-2 text-ink-700 mt-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                Coming soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
