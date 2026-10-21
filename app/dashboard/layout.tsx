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
      <div className="dashboard-main">
        {context.role === "viewer" ? <p className="dashboard-readonly" role="status">You have view-only access. You can read reports and records. Ask an owner or administrator if you need to make changes.</p> : null}
        {children}
      </div>
    </div>
  );
}
