import type { Metadata } from "next";
import { FactoryNavigation } from "@/components/factory/navigation";
import { FactorySettingsForm } from "@/components/factory/queue";
import { FactoryBuildSettingsPanel } from "@/components/factory/build-panel";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getFactoryWorkspace } from "@/lib/factory/data";
import { getFactoryBuildSettings } from "@/lib/factory/build-data";
export const metadata: Metadata = { title: "Builder settings" };
export default async function BuilderSettingsPage() {
  const context=await requireDashboardContext();
  const [data,buildSettings]=await Promise.all([getFactoryWorkspace(context),getFactoryBuildSettings(context)]);
  return <><header className="dashboard-topbar"><div><span>Tailored Agents / Website Builder</span><strong>Builder settings</strong></div></header><div className="factory-body"><div className="factory-heading"><div><h1>Builder settings</h1><p>Research, building, and spending limits for your workspace.</p></div></div><FactoryNavigation active="settings"/><section id="research-settings" className="factory-panel"><header className="factory-panel-heading"><h2>Research settings</h2></header>{data.canManage?<FactorySettingsForm data={data}/>:<p className="factory-settings-copy">An owner or administrator manages research and spending settings.</p>}</section><FactoryBuildSettingsPanel data={buildSettings}/></div></>;
}
