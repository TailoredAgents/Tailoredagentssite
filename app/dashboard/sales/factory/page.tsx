import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { FactoryQueue } from "@/components/factory/queue";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getFactoryBuildSettings } from "@/lib/factory/build-data";
import { getFactoryWorkspace } from "@/lib/factory/data";

export const metadata: Metadata = { title: "Website planning" };

export default async function FactoryPage() {
  const context = await requireDashboardContext();
  const [data, buildSettings] = await Promise.all([getFactoryWorkspace(context), getFactoryBuildSettings(context)]);
  return <><header className="dashboard-topbar"><div><span>Tailored Agents / Sales</span><strong>Website planning</strong></div></header><div className="factory-body"><Link className="factory-back" href="/dashboard/sales/mockups"><ArrowLeft size={14} />Website mockups</Link><div className="factory-heading"><div><span className="factory-eyebrow"><Sparkles size={14} />Website studio</span><h1>From first lead to a clear plan.</h1><p>Research the opportunity, shape the direction together, and approve the plan when it feels right.</p></div></div><FactoryQueue data={data} buildSettings={buildSettings} /></div></>;
}
