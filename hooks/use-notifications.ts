"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import type { NotificationRow } from "@/lib/notifications";

interface NotificationsState {
  items: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const PAGE_SIZE = 30;

/**
 * SH-02 data layer — docs/07 §20, IMPLEMENTATION-PLAN.md §Phase 4.
 * Loads the recent notifications for the signed-in user, then keeps the list
 * live via Supabase Realtime (Postgres Changes on `notifications`, RLS-filtered
 * to the recipient — proven in `scripts/verify-authz.mjs`).
 */
export function useNotifications(): NotificationsState {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  // Reset view state when the user or the reload nonce changes — done during
  // render (React's sanctioned "adjust state on prop change"), not in an effect.
  const key = `${userId ?? ""}:${nonce}`;
  const [prevKey, setPrevKey] = React.useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setItems([]);
    setError(null);
    setLoading(!!userId);
  }

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .get<{ notifications: NotificationRow[] }>(
        `/api/v1/notifications?pageSize=${PAGE_SIZE}`,
      )
      .then((res) => {
        if (!cancelled) {
          setItems(res.data.notifications);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ApiClientError
              ? e.message
              : "Couldn't load notifications.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, nonce]);

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((cur) =>
            cur.some((n) => n.id === row.id) ? cur : [row, ...cur],
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const setRead = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setItems((cur) =>
        cur.map((n) => (idSet.has(n.id) ? { ...n, is_read: true } : n)),
      );
      const results = await Promise.allSettled(
        ids.map((id) =>
          api.patch(`/api/v1/notifications/${id}`, { is_read: true }),
        ),
      );
      if (results.some((r) => r.status === "rejected")) reload();
    },
    [reload],
  );

  const markRead = React.useCallback((id: string) => setRead([id]), [setRead]);
  const markAllRead = React.useCallback(
    () => setRead(items.filter((n) => !n.is_read).map((n) => n.id)),
    [items, setRead],
  );

  const unreadCount = items.reduce((n, x) => n + (x.is_read ? 0 : 1), 0);

  return { items, unreadCount, loading, error, reload, markRead, markAllRead };
}
