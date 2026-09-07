"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import {
  notificationHref,
  notificationIcon,
  type NotificationRow,
} from "@/lib/notifications";
import type { Role } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  role: Role;
  items: NotificationRow[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  reload: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/**
 * SH-02 Notifications panel — docs/05. Reverse-chronological, unread rows carry
 * a `surface-2` tint + a `gold-500` dot, tapping a row marks it read and deep
 * links to the relevant screen (docs/05 SH-02 "Interactions").
 */
export function NotificationsDrawer({
  open,
  onClose,
  role,
  items,
  loading,
  error,
  unreadCount,
  reload,
  markRead,
  markAllRead,
}: Props) {
  const router = useRouter();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Notifications"
      width="sm"
      footer={
        unreadCount > 0 ? (
          <Button variant="secondary" size="sm" block onClick={markAllRead}>
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <ul className="divide-border divide-y">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="p-4">
          <p className="text-ink-700 text-sm">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={reload}
          >
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Bell}
            headline="No notifications yet"
            body="Updates about your requests and listings will show up here."
          />
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {items.map((n) => {
            const Icon = notificationIcon(n.type);
            const href = notificationHref(n, role);
            const body = (
              <div className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    n.is_read
                      ? "bg-surface-2 text-ink-500"
                      : "bg-gold-100 text-gold-500",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900 text-sm font-semibold">
                    {n.title}
                    {!n.is_read && (
                      <span
                        className="bg-gold-500 ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        aria-label="unread"
                      />
                    )}
                  </p>
                  <p className="text-ink-700 text-sm">{n.message}</p>
                  <p className="text-ink-500 mt-0.5 text-xs">
                    {formatRelative(n.created_at)}
                  </p>
                </div>
              </div>
            );

            const onActivate = () => {
              if (!n.is_read) markRead(n.id);
              if (href) {
                onClose();
                router.push(href);
              }
            };

            return (
              <li
                key={n.id}
                className={cn(!n.is_read && "bg-surface-2/60")}
              >
                {href ? (
                  <Link
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      onActivate();
                    }}
                    className="hover:bg-surface-2 block p-4"
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onActivate}
                    className="hover:bg-surface-2 block w-full p-4 text-left"
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
