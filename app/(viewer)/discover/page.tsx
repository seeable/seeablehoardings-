import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <PhasePlaceholder
      title="Discover"
      screen="Marketplace browse, map, and hoarding detail (VW-01–VW-04)"
      phase={6}
    />
  );
}
