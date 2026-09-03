import type { Metadata } from "next";
import { DashboardView } from "@/components/publisher/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function PublisherDashboardPage() {
  return <DashboardView />;
}
