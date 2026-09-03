/**
 * Notification presentation — the SH-02 panel (docs/05) and the bell.
 * Maps the DB `notifications.type` + related ids to an in-app destination and an
 * icon. Deep links are role-aware: the same "REQUEST_ACCEPTED" row points a
 * Viewer at their request list and a Publisher at theirs.
 */
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Inbox,
  ShieldCheck,
  ShieldX,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type Role = "VIEWER" | "PUBLISHER" | "ADMIN";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_request_id: string | null;
  related_hoarding_id: string | null;
}

const ICONS: Record<string, LucideIcon> = {
  REQUEST_CREATED: Inbox,
  REQUEST_ACCEPTED: CheckCircle2,
  REQUEST_REJECTED: XCircle,
  REQUEST_EXPIRED: CalendarClock,
  REQUEST_EXPIRING_SOON: CalendarClock,
  LISTING_APPROVED: CheckCircle2,
  LISTING_REJECTED: XCircle,
  PUBLISHER_VERIFIED: ShieldCheck,
  PUBLISHER_VERIFICATION_REJECTED: ShieldX,
  PUBLISHER_SUSPENDED: ShieldX,
  PUBLISHER_UNSUSPENDED: ShieldCheck,
};

export function notificationIcon(type: string): LucideIcon {
  return ICONS[type] ?? Bell;
}

/** Where tapping a notification goes (docs/05 SH-02). Null → not navigable. */
export function notificationHref(
  n: NotificationRow,
  role: Role,
): string | null {
  if (n.related_request_id) {
    return role === "PUBLISHER"
      ? `/publisher/requests?id=${n.related_request_id}`
      : `/requests?id=${n.related_request_id}`;
  }
  if (n.type.startsWith("PUBLISHER_")) return "/publisher/verify";
  if (n.related_hoarding_id && role === "PUBLISHER") {
    return `/publisher/hoardings?id=${n.related_hoarding_id}`;
  }
  return null;
}
