"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationsDrawer } from "@/components/notifications/notifications-drawer";
import type { Role } from "@/components/nav/nav-config";

/**
 * SH-02 bell — docs/05. A `gold-500` badge marks unread (a dot would do, but a
 * small number is clearer once there are a few); the `aria-label` always states
 * the count so it isn't a visual-only signal. Viewer + Publisher only — Admin
 * has no notification panel (docs/05 SH-02).
 */
export function NotificationBell({ role }: { role: Role }) {
  const [open, setOpen] = React.useState(false);
  const n = useNotifications();
  const { unreadCount } = n;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="text-ink-700 hover:bg-surface-2 relative flex h-9 w-9 items-center justify-center rounded-full"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="bg-gold-500 text-gold-800 absolute top-1 right-1 flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <NotificationsDrawer
        open={open}
        onClose={() => setOpen(false)}
        role={role}
        items={n.items}
        loading={n.loading}
        error={n.error}
        unreadCount={unreadCount}
        reload={n.reload}
        markRead={n.markRead}
        markAllRead={n.markAllRead}
      />
    </>
  );
}
