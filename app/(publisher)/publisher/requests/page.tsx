import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Requests" };

export default function IncomingRequestsPage() {
  return (
    <PhasePlaceholder
      title="Requests"
      screen="Incoming requests (PB-06) and request detail (PB-07)"
      phase={7}
    />
  );
}
