import * as React from "react";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "prefix"> {
  invalid?: boolean;
}

/**
 * Phone input with a fixed "+91" prefix — docs/02 §10.2 (single-country MVP).
 * Emits just the local digits; callers pass the value through
 * `normaliseMobile()` (lib/validation/auth.ts) to store E.164.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, invalid, ...props }, ref) => (
    <div
      className={cn(
        "bg-surface-1 flex h-10 w-full items-center rounded-md border text-sm",
        "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-700",
        invalid ? "border-danger-700" : "border-border",
        className,
      )}
    >
      <span className="text-ink-500 border-border border-r px-3 select-none">
        +91
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        aria-invalid={invalid || undefined}
        className="text-ink-900 placeholder:text-ink-500 h-full min-w-0 flex-1 rounded-r-md bg-transparent px-3 outline-none"
        {...props}
      />
    </div>
  ),
);
PhoneInput.displayName = "PhoneInput";
