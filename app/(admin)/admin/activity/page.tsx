import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <PhasePlaceholder title="Activity" screen="Activity log (AD-05)" phase={9} />
  );
}
