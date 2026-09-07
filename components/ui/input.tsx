import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "bg-surface-1 text-ink-900 placeholder:text-ink-500 h-11 w-full rounded-md border px-3 text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:border-gold-700",
        invalid ? "border-danger-700" : "border-border",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
