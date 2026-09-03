import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Publishers & inventory" };

export default function PublishersInventoryPage() {
  return (
    <PhasePlaceholder
      title="Publishers & inventory"
      screen="Publishers & inventory management (AD-02)"
      phase={9}
    />
  );
}
