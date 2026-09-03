import type { Metadata } from "next";
import { DesktopOnly } from "@/components/admin/desktop-only-notice";
import { OverviewView } from "@/components/admin/overview-view";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <DesktopOnly>
      <OverviewView />
    </DesktopOnly>
  );
}
