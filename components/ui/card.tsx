import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-surface-1 rounded-lg border p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  tone = "danger",
  className,
  children,
}: {
  tone?: "danger" | "success" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    danger: "bg-danger-50 text-danger-700",
    success: "bg-success-50 text-success-700",
    info: "bg-info-50 text-info-700",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-md px-3 py-2 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}
