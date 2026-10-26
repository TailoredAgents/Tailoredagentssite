import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { FactoryProject } from "@/components/factory/project";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getFactoryProject } from "@/lib/factory/data";

export const metadata: Metadata = { title: "Website plan" };

export default async function FactoryProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireDashboardContext();
  const { id } = await params;
  const data = await getFactoryProject(context, id);
  if (!data) notFound();
  return <><header className="dashboard-topbar"><div><span>Tailored Agents / Sales</span><strong>Website plan</strong></div><Link className="factory-back" style={{ marginBottom: 0 }} href={`/dashboard/leads/${data.project.leadId}`}>Open lead<ArrowUpRight size={14} /></Link></header><div className="factory-body"><Link className="factory-back" href="/dashboard/sales/factory"><ArrowLeft size={14} />All website plans</Link><FactoryProject data={data} actorId={context.user.id} /></div></>;
}
