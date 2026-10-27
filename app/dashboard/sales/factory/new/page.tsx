import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { StartFactoryButton } from "@/components/factory/start-button";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getFactoryLeadChoices } from "@/lib/factory/data";

export const metadata: Metadata = { title: "Create website mockup" };
export default async function NewWebsitePage({searchParams}:{searchParams:Promise<{q?:string|string[]}>}) {
  const context=await requireDashboardContext(),params=await searchParams;
  const query=(typeof params.q==="string"?params.q:"").trim().slice(0,120);
  const data=await getFactoryLeadChoices(context,query);
  return <><header className="dashboard-topbar"><div><span>Tailored Agents / Website Builder</span><strong>Choose a lead</strong></div></header><div className="factory-body">
    <Link className="factory-back" href="/dashboard/sales/factory"><ArrowLeft size={14}/>Website Builder</Link>
    <div className="factory-heading"><div><span className="factory-eyebrow">Step 1 of 4</span><h1>Create website mockup</h1><p>Choose a lead. We’ll use the details you already have to research and propose a site. You approve the plan before anything is built.</p></div></div>
    <form className="factory-lead-search" action="/dashboard/sales/factory/new" method="get"><label htmlFor="lead-search">Find a lead</label><div><input id="lead-search" name="q" defaultValue={query} maxLength={120} placeholder="Name, company, email or phone"/><button className="factory-button is-primary"><Search size={16}/>Search</button></div></form>
    <section className="factory-panel" aria-label="Choose a lead"><header className="factory-panel-heading"><div><h2>{query?"Matching leads":"Recent leads"}</h2><p>Missing business details are okay. Existing website projects open where you left off.</p></div></header>
      {data.leads.map(lead=><article className="factory-project-row" key={lead.id}><div><strong>{lead.name}</strong>{lead.company?<p>{lead.company}</p>:null}<small>{[lead.email,lead.phone].filter(Boolean).join(" · ") || "Add more details later"}</small></div><div>{lead.projectId?<Link className="factory-button" href={`/dashboard/sales/factory/${lead.projectId}`}>Open website project</Link>:<StartFactoryButton leadId={lead.id} disabled={!data.canEdit}/>}</div></article>)}
      {!data.leads.length?<div className="factory-empty"><h3>No leads found</h3><p>Try a different name or add the lead first.</p><Link className="factory-button" href="/dashboard/leads">Open leads</Link></div>:null}
      {data.leads.length===50?<p className="factory-settings-copy">Showing 50 leads. Search to narrow the results.</p>:null}
    </section></div></>;
}
