import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireProfile } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  return <DashboardView data={await loadDashboard(profile)} />;
}
