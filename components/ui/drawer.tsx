"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap, useBodyScrollLock } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

/**
 * Drawer — docs/02 §10.7 / docs/07 §19. Slides in from the right on desktop,
 * full-screen push on mobile. For richer, browsable content the user benefits
 * from seeing alongside the list it came from (Request Detail, Notifications
 * SH-02). Traps focus, closes on Esc / backdrop click, returns focus on close.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const ref = useFocusTrap<HTMLDivElement>(open, onClose);
  useBodyScrollLock(open);
  const mounted = useMounted();
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-ink-900/40 animate-fade-in absolute inset-0" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        className={cn(
          "bg-surface-1 animate-slide-left relative flex h-dvh w-full flex-col shadow-lg outline-none",
          width === "sm" && "sm:max-w-sm",
          width === "md" && "sm:max-w-md",
          width === "lg" && "sm:max-w-lg",
        )}
      >
        <div className="border-border flex items-center justify-between gap-4 border-b p-4">
          <h2 id="drawer-title" className="text-h3 text-ink-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:bg-surface-2 hover:text-ink-900 -m-1 rounded-md p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-border border-t p-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
