import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverview() {
  return (
    <PhasePlaceholder
      title="Overview"
      screen="The admin overview dashboard (AD-01)"
      phase={9}
    />
  );
}
