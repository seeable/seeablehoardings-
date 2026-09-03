import * as React from "react";
import type { Metadata } from "next";
import { DesktopOnly } from "@/components/admin/desktop-only-notice";
import { PublishersInventoryView } from "@/components/admin/publishers-inventory-view";

export const metadata: Metadata = { title: "Publishers & inventory" };

export default function AdminInventoryPage() {
  return (
    <DesktopOnly>
      <React.Suspense fallback={null}>
        <PublishersInventoryView />
      </React.Suspense>
    </DesktopOnly>
  );
}
