"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast — docs/07 §20. Transient confirmation of an action the user just took.
 * One visible at a time (§20 "Toast queueing"); the rest wait in line.
 * Auto-dismisses after ~4s. Never used for information the user didn't cause —
 * that's a banner or the notification panel.
 */

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);
const DURATION = 4000;
let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<Toast[]>([]);

  const push = React.useCallback((message: string, tone: ToastTone = "success") => {
    setQueue((q) => [...q, { id: ++seq, tone, message }]);
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  const current = queue[0];
  React.useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dismiss(current.id), DURATION);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  const api = React.useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:inset-x-auto sm:right-4 sm:justify-end"
      >
        {current && <ToastCard toast={current} onDismiss={() => dismiss(current.id)} />}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;
const TONE_CLASS = {
  success: "text-success-700",
  error: "text-danger-700",
  info: "text-info-700",
} as const;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.tone];
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "border-border bg-surface-1 animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_CLASS[toast.tone])} aria-hidden />
      <p className="text-ink-900 flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-ink-500 hover:text-ink-900 -m-1 rounded p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
