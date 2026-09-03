import type { Metadata } from "next";
import { Suspense } from "react";
import { HoardingTable } from "@/components/inventory/hoarding-table";

export const metadata: Metadata = { title: "My hoardings" };
export const dynamic = "force-dynamic";

export default function MyHoardingsPage() {
  return (
    <Suspense fallback={null}>
      <HoardingTable />
    </Suspense>
  );
}
