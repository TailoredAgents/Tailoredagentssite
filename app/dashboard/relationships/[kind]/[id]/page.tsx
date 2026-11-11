import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowUpRight,MessageSquareText,UsersRound} from 'lucide-react';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {targetSchema} from '@/lib/relationships/contract';
import {getRelationshipOverview,recordHref} from '@/lib/relationships/overview';
import {handoffHistory} from '@/lib/relationships/handoffs';
import {SalesAccessError} from '@/lib/sales/data';
import {DiscoveryPanel} from '@/components/relationships/discovery-panel';
import {HandoffCard,RequestHandoff} from '@/components/relationships/handoffs';
import {LocalTime} from '@/components/sales/date-time-field';

export const metadata:Metadata={title:'Relationship overview'};
export default async function RelationshipPage({params}:{params:Promise<{kind:string;id:string}>}){
 const parsed=targetSchema.safeParse(await params);if(!parsed.success)notFound();
 const context=await requireDashboardContext(),target=parsed.data;
 const data=await getRelationshipOverview(context,target,true).catch(e=>{if(e instanceof SalesAccessError)notFound();throw e;});
 const open=data.handoffs.filter(h=>['pending','accepted'].includes(h.status)),closed=data.handoffs.filter(h=>!['pending','accepted'].includes(h.status));
 const histories=await handoffHistory(context,data.handoffs.map(h=>h.id));
 const person=data.records.find(r=>r.kind===target.kind&&r.id===target.id&&['lead','contact'].includes(r.kind))??data.records.find(r=>r.kind==='lead'||r.kind==='contact');
 return <><header className="dashboard-topbar"><div><span>Relationships</span><strong>Overview</strong></div></header><div className="dashboard-content relationship-workspace">
  <Link className="dashboard-back-link" href={data.current.kind==='business'?'/dashboard/sales':recordHref(data.current)}><ArrowLeft size={14}/>Back to record</Link>
  <section className="relationship-heading"><div><span className="relationship-eyebrow"><UsersRound size={15}/>One relationship, shared context</span><h1>{data.current.name}</h1><p>{data.current.detail||'Discovery, people and the next step — together.'}</p></div><div className="relationship-heading-actions">{person&&<Link className="dashboard-secondary-button" href={`/dashboard/inbox?${person.kind}=${person.id}`}><MessageSquareText size={16}/>Open conversations</Link>}<a className="dashboard-primary-button" href="#handoff">Hand off next step <ArrowUpRight size={16}/></a></div></section>
  <nav className="workspace-section-links" aria-label="Relationship sections"><a href="#next-steps">Next steps</a><a href="#people-ownership">People & ownership</a><a href="#business-discovery">Discovery & introductions</a><a href="#delivery">Delivery</a></nav>
  <div className="relationship-layout"><main className="relationship-main">
   <section className="dashboard-panel" id="next-steps"><div className="dashboard-panel-heading"><div><span>Clear ownership</span><h2>Next steps</h2></div><span className="relationship-pill">{open.length} open handoffs</span></div>
    {open.length?<div className="relationship-queue-grid">{open.map(h=><HandoffCard key={h.id} item={h} context={context} history={histories.filter(x=>x.handoff_id===h.id)}/>)}</div>:<div className="relationship-empty">No open handoff. Give the next step to a teammate when you know what should happen next.</div>}
    {data.leadSteps.length>0&&<div className="relationship-list"><h3>Prospect next actions</h3>{data.leadSteps.map(t=><Link key={t.id} href={`/dashboard/leads/${t.id}`}><strong>{t.title}</strong><span>{t.owner||'Unassigned'}{t.due_at&&<> · <LocalTime value={t.due_at}/></>}</span><ArrowUpRight size={16}/></Link>)}</div>}
    {data.bookings.length>0&&<div className="relationship-list"><h3>Booked consultations</h3>{data.bookings.map(b=><Link key={b.id} href="/dashboard/calendar"><strong>Consultation with {b.owner}</strong><span><LocalTime value={b.starts_at}/></span><ArrowUpRight size={16}/></Link>)}</div>}
    {data.tasks.length>0&&<div className="relationship-list"><h3>Scheduled follow-ups & appointments</h3>{data.tasks.map(t=><Link key={t.id} href={t.opportunity_id?`/dashboard/sales/${t.opportunity_id}`:`/dashboard/tasks/${t.id}`}><strong>{t.title}</strong><span>{t.owner||'Unassigned'} · <LocalTime value={t.due_at}/></span><ArrowUpRight size={16}/></Link>)}</div>}
    {closed.length>0&&<details className="relationship-closed"><summary>Completed & cancelled handoffs · {closed.length}</summary><div className="relationship-queue-grid">{closed.map(h=><HandoffCard key={h.id} item={h} context={context} history={histories.filter(x=>x.handoff_id===h.id)}/>)}</div></details>}
   </section>
   <section className="dashboard-panel" id="people-ownership"><div className="dashboard-panel-heading"><div><span>Existing connected records</span><h2>People & ownership</h2></div></div><div className="relationship-list">{data.records.map(r=><div key={`${r.kind}:${r.id}`}><Link href={recordHref(r)}><strong>{r.name}</strong></Link><span className="relationship-meta">{r.kind==='lead'?'Prospect':r.kind} · {r.kind==='client'?'Account manager':r.kind==='opportunity'?'Sales owner':'Owner'}: {r.owner||'Not assigned'}{r.kind==='client'?'':` · ${r.status}`}</span>{r.email&&<span>{r.email}</span>}{r.phone&&<span>{r.phone}</span>}{r.source&&<small>Acquisition source: {r.source}{r.campaign?` · ${r.campaign}`:''}</small>}</div>)}</div><p className="relationship-footnote">Campaign source, introducer credit, sales ownership and account management are separate. Recording an introduction does not create a payout agreement.</p></section>
   <DiscoveryPanel context={context} target={target} showOverview={false}/>
   <section className="dashboard-panel" id="delivery"><div className="dashboard-panel-heading"><div><span>From conversation to implementation</span><h2>Delivery projects</h2></div></div>{data.projects.length?<div className="relationship-list">{data.projects.map(p=><Link href={`/dashboard/projects/${p.id}`} key={p.id}><strong>{p.name}</strong><span>{p.owner||'Unassigned'} · {p.status}{p.due_at&&<> · <LocalTime value={p.due_at} dateOnly/></>}</span><ArrowUpRight size={16}/></Link>)}</div>:<div className="relationship-empty">No linked project yet. Create delivery work after agreeing the scope with the client.</div>}</section>
  </main><aside className="relationship-aside"><RequestHandoff context={context} target={target}/><section className="dashboard-panel relationship-request"><h2>Before the next conversation</h2><p>Review the discovery notes, confirm the customer’s desired outcome and agree who will do what next.</p><p>Open conversations to read permitted email, texts and call history. Meetings keep their existing private or team visibility.</p><Link href="/dashboard/calendar" className="relationship-text-link">Open team calendar <ArrowUpRight size={14}/></Link></section></aside></div>
 </div></>;
}
