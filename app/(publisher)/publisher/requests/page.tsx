import type { Metadata } from "next";
import { Suspense } from "react";
import { IncomingRequestsView } from "@/components/requests/incoming-requests-view";

export const metadata: Metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default function IncomingRequestsPage() {
  return (
    <Suspense fallback={null}>
      <IncomingRequestsView />
    </Suspense>
  );
}
