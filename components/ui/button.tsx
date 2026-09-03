import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Minimal button — Phase 2 only needs primary / secondary / ghost + a loading
 * state. Phase 4 replaces this with the full docs/02 §10 component (5 variants,
 * 3 sizes, every state).
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink-900 text-surface-1 hover:bg-ink-800",
        secondary:
          "border border-border bg-surface-1 text-ink-900 hover:bg-surface-2",
        ghost: "text-ink-700 hover:bg-surface-2",
        danger: "bg-danger-700 text-surface-1 hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
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
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
