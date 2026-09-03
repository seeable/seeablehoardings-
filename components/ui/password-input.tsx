"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Text input with an accessible show/hide toggle (AUTH-02 requirement). */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [shown, setShown] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={shown ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="text-ink-500 hover:text-ink-700 absolute inset-y-0 right-0 flex w-10 items-center justify-center"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
