import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Label + control + error/hint, with aria wiring. `error` takes precedence over
 * `hint` for the described-by text; `error` also flips the control's styling
 * when the child reads `aria-invalid` (Input does).
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const describedBy = error
    ? `${htmlFor}-error`
    : hint
      ? `${htmlFor}-hint`
      : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-ink-800 text-sm font-medium">
        {label}
        {required && (
          <span className="text-danger-700" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
              id: htmlFor,
              "aria-describedby": describedBy,
            },
          )
        : children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-danger-700 text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-ink-500 text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
