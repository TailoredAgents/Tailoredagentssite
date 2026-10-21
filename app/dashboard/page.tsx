import Link from "next/link";
import { Activity, ArrowRight, Building2, CalendarClock, FolderKanban, Globe2, Inbox, ShieldCheck } from "lucide-react";
import { getDashboardOverview, requireDashboardContext } from "@/lib/dashboard/data";
import { formatOperationalDate } from "@/lib/operations/format";

export default async function DashboardPage() {
  const context = await requireDashboardContext();
  const overview = await getDashboardOverview(context);
  const mutable = context.role !== "viewer";
  const metrics = [
    { label: "Open leads", count: overview.counts.leads, detail: "Inquiries still in your pipeline", href: "/dashboard/leads", icon: Inbox },
    { label: "Clients", count: overview.counts.clients, detail: "Current client records", href: "/dashboard/clients", icon: Building2 },
    { label: "Open projects", count: overview.counts.projects, detail: "Planned, active, or on hold", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Active sites", count: overview.counts.sites, detail: "Websites you are managing", href: "/dashboard/sites", icon: Globe2 },
  ];
  return <>
    <header className="dashboard-topbar"><div><span>Your workspace</span><strong>{context.workspace.name}</strong></div><span className="dashboard-secure"><ShieldCheck size={16} />Private team workspace</span></header>
    <div className="dashboard-content">
      <section className="dashboard-page-heading"><div><span>Overview</span><h1>Welcome back, {context.user.name.split(" ")[0]}.</h1><p>Review new inquiries, follow up with clients, and keep your projects moving.</p></div><Link className="dashboard-secondary-button" href="/dashboard/analytics">View website reports<ArrowRight size={18} /></Link></section>
      <section className="dashboard-metrics" aria-label="Workspace overview">{metrics.map(({ label, count, detail, href, icon: Icon }) => <article key={label}><span><Icon size={18} /></span><small>{label}</small><strong>{count}</strong><em>{detail}</em><Link href={href} className="dashboard-metric-link">View {label.toLowerCase()}<ArrowRight size={16} /></Link></article>)}</section>
      <nav className="dashboard-quick-actions" aria-label="Quick actions"><Link href="/dashboard/leads?status=new" className="dashboard-primary-button">Review new inquiries</Link>{mutable ? <><Link href="/dashboard/clients#create-client" className="dashboard-secondary-button">Add a client</Link><Link href="/dashboard/projects#create-project" className="dashboard-secondary-button">Start a project</Link></> : null}</nav>
      <div className="dashboard-overview-grid">
        <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Your pipeline</span><h2>Recent open inquiries</h2></div><Link href="/dashboard/leads">All leads<ArrowRight size={16} /></Link></div>{overview.recentLeads.length ? <ul className="dashboard-task-list">{overview.recentLeads.map(lead => <li key={lead.id}><Link href={`/dashboard/leads/${lead.id}`}><div><strong>{lead.organization}</strong><small>{lead.name} · {formatOperationalDate(lead.createdAt, { dateOnly: true })}</small></div><ArrowRight size={18} /></Link></li>)}</ul> : <div className="dashboard-empty"><Inbox size={24} /><strong>No open inquiries</strong><p>New website inquiries appear here automatically. You can find closed inquiries in Leads.</p></div>}</section>
        <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Next seven days and overdue</span><h2>Follow-ups to make</h2></div><CalendarClock size={22} /></div>{overview.followUps.length ? <ul className="dashboard-task-list">{overview.followUps.map(lead => <li key={lead.id}><Link href={`/dashboard/leads/${lead.id}`}><div><strong>{lead.organization}</strong><small>{lead.nextAction}</small><small>Due {formatOperationalDate(lead.dueAt, { dateOnly: true })}</small></div><ArrowRight size={18} /></Link></li>)}</ul> : <div className="dashboard-empty"><CalendarClock size={24} /><strong>No follow-ups due</strong><p>Set a next action and date on a lead to see it here when it is due.</p><Link href="/dashboard/leads">Open leads</Link></div>}</section>
      </div>
      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Next seven days and overdue</span><h2>Project deadlines</h2></div><Link href="/dashboard/projects">All projects<ArrowRight size={16} /></Link></div>{overview.upcomingProjects.length ? <ul className="dashboard-task-list">{overview.upcomingProjects.map(project => <li key={project.id}><Link href={`/dashboard/projects/${project.id}`}><div><strong>{project.name}</strong><small>Due {formatOperationalDate(project.dueAt, { dateOnly: true })}</small></div><ArrowRight size={18} /></Link></li>)}</ul> : <div className="dashboard-empty"><FolderKanban size={24} /><strong>No upcoming project deadlines</strong><p>Add a due date to a project to keep its deadline in view here.</p></div>}</section>
        <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Team updates</span><h2>Recent activity</h2></div><Link href="/dashboard/activity">All activity<ArrowRight size={16} /></Link></div>{overview.activity.length ? <div className="dashboard-activity-list">{overview.activity.map(item => <article key={item.id}><span><Activity size={18} /></span><div><strong>{item.action.replaceAll(".", " ").replaceAll("_", " ")}</strong><small>{item.actorName}</small><small><time dateTime={item.createdAt}>{formatOperationalDate(item.createdAt)}</time></small></div></article>)}</div> : <div className="dashboard-empty"><Activity size={24} /><strong>No activity yet</strong><p>Updates to leads, clients, and projects will appear here.</p></div>}</section>
      </div>
    </div>
  </>;
}
