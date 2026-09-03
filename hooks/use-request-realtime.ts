"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * Keep request-derived server components fresh — IMPLEMENTATION-PLAN.md §Phase 4.
 * Subscribes to Postgres Changes on `requests` (RLS scopes the stream to the
 * caller's rows — a Viewer's own requests, a Publisher's inbox). On any change
 * it calls `router.refresh()` so the current route's server data re-fetches;
 * `onChange` runs too for anything client-side (a toast, a list invalidation).
 *
 * Mount this once per route that shows request state (My Requests, the
 * Publisher inbox, a request detail drawer).
 */
export function useRequestRealtime(onChange?: () => void) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const cb = React.useRef(onChange);
  React.useEffect(() => {
    cb.current = onChange;
  });

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`requests:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => {
          router.refresh();
          cb.current?.();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);
}
