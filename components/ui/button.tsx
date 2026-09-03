import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — docs/02 §10.1. Five variants, three sizes, every state.
 *   primary      one per screen/section — the single most important action
 *   secondary    "Cancel", "Save as draft"
 *   ghost        low-emphasis, dense rows (table row actions)
 *   destructive  "Reject", "Suspend", "Delist" — never a filled red button
 *   accent       the single highest-affinity brand moment per flow (rare)
 * Sizes: sm 32px · md 40px (default) · lg 48px (mobile thumb targets).
 */
const button = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-md font-semibold " +
    "transition-[background-color,color,transform] duration-[120ms] ease-[var(--ease-standard)] " +
    "active:scale-[0.98] " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700 " +
    "disabled:pointer-events-none disabled:bg-surface-2 disabled:text-ink-300 disabled:border-transparent",
  {
    variants: {
      variant: {
        primary: "bg-ink-900 text-surface-1 hover:bg-ink-800",
        secondary:
          "border border-border bg-surface-1 text-ink-900 hover:bg-surface-2",
        ghost: "text-ink-900 hover:bg-surface-2",
        destructive:
          "border border-danger-700/30 bg-surface-1 text-danger-700 hover:bg-danger-50",
        accent: "bg-gold-100 text-gold-800 hover:brightness-95",
      },
      size: {
        sm: "h-8 px-3 text-[13px] leading-[18px]",
        md: "h-10 px-4 text-[14px] leading-[20px]",
        lg: "h-12 px-6 text-[14px] leading-[20px]",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, loading, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* Label swapped for a centered spinner; width is preserved by the
          invisible label underneath (no layout shift). docs/02 §10.1 */}
      {loading ? (
        <span className="grid">
          <span
            className="col-start-1 row-start-1 h-4 w-4 animate-spin justify-self-center rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          <span className="col-start-1 row-start-1 invisible flex items-center gap-2">
            {children}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  ),
);
Button.displayName = "Button";
