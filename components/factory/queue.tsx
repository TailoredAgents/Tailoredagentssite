"use client";

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, LoaderCircle, Settings2 } from "lucide-react";
import { LocalTime } from "@/components/sales/date-time-field";
import { saveFactorySettingsAction } from "@/lib/factory/actions";
import { factoryProjectView, factoryViews } from "@/lib/factory/workflow";
import type { FactoryProjectBuilds } from "@/lib/factory/build-types";
import type { FactoryActionState, FactoryWorkspace } from "@/lib/factory/types";
import { FactorySetupNotice, factoryMoney } from "./shared";

export function FactoryQueue({ data, buildSettings }: { data: FactoryWorkspace; buildSettings: Omit<FactoryProjectBuilds, "versions" | "uploads"> }) {
  const [filter, setFilter] = useState("all");
  const router = useRouter();
  const active = (data.projects.some((project) => ["research_queued", "researching"].includes(project.status)) && data.config.configured && data.settings.researchEnabled) || (buildSettings.settings.enabled && buildSettings.config.configured && data.projects.some((project) => project.latestBuild && ["queued", "running"].includes(project.latestBuild.status)));
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 8000); return () => window.clearInterval(timer); }, [active, router]);
  const filtered = data.projects.filter(project => filter === "all" || factoryProjectView(project) === filter);
  return <>
    <FactorySetupNotice {...data} />
    <div className="factory-stats">{Object.entries(factoryViews).map(([key,label])=><button className={`factory-stat ${filter===key?"is-selected":""}`} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)} key={key}><span>{label}</span><strong>{data.projects.filter(p=>factoryProjectView(p)===key).length}</strong><small>{key==="review"?"Research, chat and approval":key==="building"?"Approved sites in progress":key==="ready"?"Open the site and share its link":"A teammate’s help is needed"}</small></button>)}</div>
    <section className="factory-panel"><header className="factory-panel-heading"><div><h2>Your website projects</h2><p>Pick up where you left off.</p></div><button type="button" className="factory-button" onClick={()=>setFilter("all")} aria-pressed={filter==="all"}>All projects</button></header>
      <div className="factory-queue-filter" aria-label="Filter website projects">{Object.entries(factoryViews).map(([value,label])=><button type="button" key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value}>{label}</button>)}</div>
      {filtered.map(project=>{const view=factoryProjectView(project),url=`/dashboard/sales/factory/${project.id}`;return <article className="factory-project-row" key={project.id}><div><Link href={url}><strong>{project.leadName || "Untitled lead"}</strong></Link><p>{project.companyName || "Business details can be added in chat"}</p><small>Updated <LocalTime value={project.updatedAt}/></small></div><div className="factory-project-actions"><span className={`factory-status ${view==="attention"?"is-error":view==="ready"?"is-approved":""}`}><i/>{factoryViews[view]}</span>{project.latestBuild?.previewUrl?<a className="factory-button is-primary" href={project.latestBuild.previewUrl} target="_blank" rel="noreferrer">View website<ArrowRight size={14}/></a>:null}<Link className={`factory-button ${!project.latestBuild?.previewUrl?"is-primary":""}`} href={url}>{view==="ready"?"Open project":view==="attention"?"Review issue":view==="building"?"View progress":project.status==="plan_ready"?"Review plan":"Open project"}</Link></div></article>})}
      {!filtered.length?<div className="factory-empty"><FolderOpen size={24}/><h3>{filter==="all"?"Your next website starts with a lead":"No projects in this view"}</h3><p>{filter==="all"?"Choose a lead, shape the plan, approve the build, then share the site.":"Try All projects to see the rest of your work."}</p>{data.canEdit?<Link className="factory-button is-primary" href="/dashboard/sales/factory/new">Create website mockup<ArrowRight size={15}/></Link>:null}</div>:null}
    </section>
  </>;
}

export function FactorySettingsForm({ data }: { data: FactoryWorkspace }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(async (previous: FactoryActionState, form: FormData) => {
    try { return await saveFactorySettingsAction(previous, form); }
    catch { return { status: "error", message: "Settings could not be saved. Your changes are still here; please try again." } as FactoryActionState; }
  }, { status: "idle" });
  return <form className="factory-settings" action={action} aria-label="Website research settings"><p>Enabling research starts waiting requests and allows paid AI usage within your monthly limit. It never starts website builds.</p><div className="factory-check"><input id={`${fieldId}-enabled`} aria-describedby={`${fieldId}-enabled-help`} type="checkbox" name="researchEnabled" defaultChecked={data.settings.researchEnabled} disabled={pending} /><span><label htmlFor={`${fieldId}-enabled`}>Enable AI research</label><small id={`${fieldId}-enabled-help`}>Generate and revise plans for queued workspaces.</small></span></div><div className="factory-check"><input id={`${fieldId}-automatic`} aria-describedby={`${fieldId}-automatic-help`} type="checkbox" name="autoResearch" defaultChecked={data.settings.autoResearch} disabled={pending} /><span><label htmlFor={`${fieldId}-automatic`}>Research new leads automatically</label><small id={`${fieldId}-automatic-help`}>Applies to new leads only. Existing leads stay untouched until you start their plans.</small></span></div><div className="factory-field"><label htmlFor={`${fieldId}-budget`}>Monthly research limit (USD)</label><input id={`${fieldId}-budget`} aria-describedby={`${fieldId}-budget-help`} type="number" name="monthlyBudgetDollars" required min={1} max={1000} step="0.01" defaultValue={data.settings.monthlyBudgetMicros ? data.settings.monthlyBudgetMicros / 1_000_000 : ""} placeholder="Choose a limit" disabled={pending} /><small id={`${fieldId}-budget-help`}>{factoryMoney(data.monthSpentMicros)} estimated or reserved this month. Website building and images use the separate limit below.</small></div><button className="factory-button is-primary" disabled={pending}>{pending ? <LoaderCircle className="factory-spin" size={15} /> : <Settings2 size={15} />}{pending ? "Saving…" : "Save research settings"}</button>{state.message ? <p className={`factory-form-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</form>;
}
