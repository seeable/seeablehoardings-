import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "My requests" };

export default function MyRequestsPage() {
  return (
    <PhasePlaceholder
      title="My requests"
      screen="My requests (VW-05)"
      phase={7}
    />
  );
}
