"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap, useBodyScrollLock } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

/**
 * Modal — docs/02 §10.7 / docs/07 §19. A centered card on desktop, a bottom
 * sheet on mobile. For a single focused decision with a small amount of content
 * (Submit Request, Approve/Reject). Traps focus, closes on Esc / backdrop click,
 * returns focus to the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useFocusTrap<HTMLDivElement>(open, onClose);
  useBodyScrollLock(open);
  const mounted = useMounted();
  if (!mounted || !open) return null;

  const titleId = "modal-title";
  const descId = description ? "modal-desc" : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-ink-900/40 animate-fade-in absolute inset-0" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={cn(
          "bg-surface-1 animate-slide-up relative flex max-h-[90dvh] w-full flex-col rounded-t-xl shadow-lg outline-none sm:rounded-xl",
          size === "sm" && "sm:max-w-[420px]",
          size === "md" && "sm:max-w-[520px]",
          size === "lg" && "sm:max-w-[640px]",
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
          <div>
            <h2 id={titleId} className="text-h3 text-ink-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-ink-700 mt-1 text-sm">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:bg-surface-2 hover:text-ink-900 -m-1 rounded-md p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children != null && (
          <div className="overflow-y-auto p-5 text-sm">{children}</div>
        )}
        {footer && (
          <div className="border-border flex justify-end gap-2 border-t p-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation dialog — a minimal Modal variant (docs/07 §19). One yes/no
 * decision whose consequence needs spelling out; no form fields.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
