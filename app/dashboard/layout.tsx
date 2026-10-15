import type { Metadata } from "next";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { requireDashboardContext } from "@/lib/dashboard/data";
import "./dashboard.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s — Tailored Agents Dashboard" },
  description: "Private Tailored Agents operating workspace.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireDashboardContext();

  return (
    <div className="dashboard-shell">
      <DashboardNavigation context={context} />
      <div className="dashboard-main">{children}</div>
    </div>
  );
}
