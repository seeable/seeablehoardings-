import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  /** Disabled leading option shown when no value is selected. */
  placeholder?: string;
}

/**
 * Native select — docs/02 §10.2. Native is deliberate: it's accessible for free,
 * works with the mobile OS picker, and adds no bundle weight. Pass <option>s as
 * children; use `placeholder` for a disabled leading option.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, placeholder, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "bg-surface-1 text-ink-900 h-10 w-full appearance-none rounded-md border pr-9 pl-3 text-sm transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:border-gold-700",
          "disabled:bg-surface-2 disabled:text-ink-500",
          invalid ? "border-danger-700" : "border-border",
          className,
        )}
        {...props}
      >
        {placeholder != null && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        className="text-ink-500 pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";
