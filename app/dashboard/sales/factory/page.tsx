import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { FactoryNavigation } from "@/components/factory/navigation";
import { FactoryQueue } from "@/components/factory/queue";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getFactoryBuildSettings } from "@/lib/factory/build-data";
import { getFactoryWorkspace } from "@/lib/factory/data";
import { getFactoryWorkNotices } from "@/lib/factory/work-notices";
import { FactoryWorkNotices } from "@/components/factory/work-notices";

export const metadata: Metadata = { title: "Website Builder" };

export default async function FactoryPage() {
  const context = await requireDashboardContext();
  const [data, buildSettings, notices] = await Promise.all([getFactoryWorkspace(context), getFactoryBuildSettings(context), getFactoryWorkNotices(context,"team")]);
  return <><header className="dashboard-topbar"><div><span>Tailored Agents / Sales</span><strong>Website Builder</strong></div></header><div className="factory-body"><div className="factory-heading"><div><span className="factory-eyebrow"><Sparkles size={14}/>From lead to website</span><h1>Website Builder</h1><p>Choose a lead. Shape the plan. Approve the build. Share the site.</p></div>{data.canEdit?<Link className="factory-button is-primary" href="/dashboard/sales/factory/new"><Plus size={16}/>Create website mockup</Link>:null}</div><FactoryNavigation/><FactoryWorkNotices data={notices} team/><FactoryQueue data={data} buildSettings={buildSettings}/></div></>;
}
