import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <PhasePlaceholder
      title="Account"
      screen="Account & profile settings (SH-01)"
      phase={8}
    />
  );
}
