import type { Metadata } from "next";
import { DesktopOnly } from "@/components/admin/desktop-only-notice";
import { ActivityView } from "@/components/admin/activity-view";

export const metadata: Metadata = { title: "Activity" };

export default function AdminActivityPage() {
  return (
    <DesktopOnly>
      <ActivityView />
    </DesktopOnly>
  );
}
