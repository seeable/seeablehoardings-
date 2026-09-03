import {
  Activity,
  Building2,
  ClipboardList,
  Compass,
  Inbox,
  LayoutDashboard,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Role = "VIEWER" | "PUBLISHER" | "ADMIN";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Viewer IA — docs/01 §4.1. No Shortlist (Decision D9). */
export const VIEWER_NAV: NavItem[] = [
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "My requests", href: "/requests", icon: ClipboardList },
  { label: "Account", href: "/account", icon: User },
];

/** Publisher IA — docs/01 §4.2. */
export const PUBLISHER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/publisher/dashboard", icon: LayoutDashboard },
  { label: "My hoardings", href: "/publisher/hoardings", icon: Building2 },
  { label: "Requests", href: "/publisher/requests", icon: Inbox },
  { label: "Account", href: "/account", icon: User },
];

/** Admin IA — docs/01 §4.3. Desktop-only. */
export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin/overview", icon: LayoutDashboard },
  { label: "Publishers & inventory", href: "/admin/inventory", icon: Users },
  { label: "Activity", href: "/admin/activity", icon: Activity },
];

export function navForRole(role: Role): NavItem[] {
  if (role === "PUBLISHER") return PUBLISHER_NAV;
  if (role === "ADMIN") return ADMIN_NAV;
  return VIEWER_NAV;
}

/** Longest-prefix match so drill-in routes keep their parent tab active. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
