import type { Metadata } from "next";
import { Suspense } from "react";
import { MyRequestsView } from "@/components/requests/my-requests-view";

export const metadata: Metadata = { title: "My requests" };
export const dynamic = "force-dynamic";

export default function MyRequestsPage() {
  return (
    <Suspense fallback={null}>
      <MyRequestsView />
    </Suspense>
  );
}
