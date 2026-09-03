import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "My hoardings" };

export default function MyHoardingsPage() {
  return (
    <PhasePlaceholder
      title="My hoardings"
      screen="My hoardings (PB-02) and the Add Hoarding wizard (PB-03)"
      phase={5}
    />
  );
}
