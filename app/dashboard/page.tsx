import { leadDisplayName, leadCompanyName } from "@/lib/operations/format";
import Link from "next/link";
import { Activity, ArrowRight, Building2, CalendarCheck2, CalendarClock, Columns3, FolderKanban, Globe2, Inbox, ShieldCheck } from "lucide-react";
import { getDashboardOverview, requireDashboardContext } from "@/lib/dashboard/data";
import { formatOperationalDate } from "@/lib/operations/format";

export default async function DashboardPage() {
  const context = await requireDashboardContext();
  const overview = await getDashboardOverview(context);
  const mutable = context.role !== "viewer";
  const metrics = [
    { label: "Open leads", count: overview.counts.leads, detail: "Website inquiries and manually added prospects", href: "/dashboard/leads", icon: Inbox },
    { label: "Clients", count: overview.counts.clients, detail: "Your client relationships", href: "/dashboard/clients", icon: Building2 },
    { label: "Open projects", count: overview.counts.projects, detail: "Planned, active, and on hold", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Active sites", count: overview.counts.sites, detail: "Websites your team manages", href: "/dashboard/sites", icon: Globe2 },
  ];
  const workspaces = [
    { title: "Sales pipeline", description: "Move interested businesses from first conversation to a website sale.", href: "/dashboard/sales", label: "Open sales", icon: Columns3 },
    { title: "Customer conversations", description: "Email, texts, calls and follow-ups in one customer history.", href: "/dashboard/inbox", label: "Open Inbox", icon: Inbox },
    { title: "Client delivery", description: "Keep owners, milestones and the next website launch moving.", href: "/dashboard/projects", label: "Review projects", icon: FolderKanban },
  ];

  return <>
    <header className="dashboard-topbar">
      <div><span>Tailored Agents</span><strong>Business overview</strong></div>
      <span className="dashboard-secure"><ShieldCheck size={16} aria-hidden="true" />Private team workspace</span>
    </header>
    <div className="dashboard-content">
      <section className="dashboard-page-heading">
        <div><span>Your business, connected</span><h1>Welcome back, {context.user.name.split(" ")[0]}.</h1><p>Keep your next conversation, website sale, and client project moving.</p></div>
        <Link className="dashboard-primary-button" href="/dashboard/sales/today"><CalendarCheck2 size={18} aria-hidden="true" />Open My day<ArrowRight size={17} aria-hidden="true" /></Link>
      </section>

      <div className="dashboard-section-heading"><h2>Relationships & delivery</h2><Link href="/dashboard/analytics">View website reports<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <section className="dashboard-metrics" aria-label="Workspace overview">
        {metrics.map(({ label, count, detail, href, icon: Icon }) => <article key={label}>
          <span><Icon size={18} aria-hidden="true" /></span><small>{label}</small><strong>{count}</strong><em>{detail}</em><Link href={href} className="dashboard-metric-link">View {label.toLowerCase()}<ArrowRight size={16} aria-hidden="true" /></Link>
        </article>)}
      </section>
      <nav className="dashboard-quick-actions" aria-label="Quick actions">
        <Link href="/dashboard/leads?status=new" className="dashboard-secondary-button">Review new leads</Link>
        {mutable ? <><Link href="/dashboard/clients#create-client" className="dashboard-secondary-button">Add a client</Link><Link href="/dashboard/projects#create-project" className="dashboard-secondary-button">Start a project</Link></> : null}
      </nav>

      <div className="dashboard-section-heading"><h2>Your workspaces</h2><span className="workspace-section-hint">From the next conversation to delivery</span></div>
      <section className="dashboard-workspaces" aria-label="Sales workspaces">
        {workspaces.map(({ title, description, href, label, icon: Icon }) => <Link className="dashboard-workspace-card-link" href={href} key={title}>
          <span className="dashboard-workspace-icon"><Icon size={21} aria-hidden="true" /></span>
          <div><h2>{title}</h2><p>{description}</p><span className="dashboard-workspace-cta">{label}<ArrowRight size={16} aria-hidden="true" /></span></div>
        </Link>)}
      </section>

      <div className="dashboard-overview-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span>New relationships</span><h2>Recent open leads</h2></div><Link href="/dashboard/leads">All leads<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.recentLeads.length ? <ul className="dashboard-task-list">{overview.recentLeads.map(lead => <li key={lead.id}><Link href={`/dashboard/leads/${lead.id}`}><div><strong>{leadDisplayName(lead)}</strong><small>{leadCompanyName(lead) ? `${leadCompanyName(lead)} · ` : ""}{formatOperationalDate(lead.createdAt, { dateOnly: true })}</small></div><ArrowRight size={18} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><Inbox size={24} aria-hidden="true" /><strong>No open leads</strong><p>Website inquiries and manually added leads appear here. Closed records remain in Leads.</p></div>}
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span>Next seven days and overdue</span><h2>Lead follow-ups</h2></div><CalendarClock size={21} aria-hidden="true" /></div>
          {overview.followUps.length ? <ul className="dashboard-task-list">{overview.followUps.map(lead => <li key={lead.id}><Link href={`/dashboard/leads/${lead.id}`}><div><strong>{leadDisplayName(lead)}</strong><small>{lead.nextAction}</small><small>Due {formatOperationalDate(lead.dueAt, { dateOnly: true })}</small></div><ArrowRight size={18} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><CalendarClock size={24} aria-hidden="true" /><strong>No lead follow-ups due</strong><p>Add a next action and date to a lead. Your sales appointments and follow-ups are in My day.</p><Link href="/dashboard/sales/today">Open My day<ArrowRight size={16} aria-hidden="true" /></Link></div>}
        </section>
      </div>
      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span>Next seven days and overdue</span><h2>Project deadlines</h2></div><Link href="/dashboard/projects">All projects<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.upcomingProjects.length ? <ul className="dashboard-task-list">{overview.upcomingProjects.map(project => <li key={project.id}><Link href={`/dashboard/projects/${project.id}`}><div><strong>{project.name}</strong><small>Due {formatOperationalDate(project.dueAt, { dateOnly: true })}</small></div><ArrowRight size={18} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><FolderKanban size={24} aria-hidden="true" /><strong>No upcoming project deadlines</strong><p>Add a due date to a project to keep its deadline in view here.</p></div>}
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span>Team updates</span><h2>Recent activity</h2></div><Link href="/dashboard/activity">All activity<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.activity.length ? <div className="dashboard-activity-list">{overview.activity.map(item => <article key={item.id}><span><Activity size={18} aria-hidden="true" /></span><div><strong>{item.action.replaceAll(".", " ").replaceAll("_", " ")}</strong><small>{item.actorName}</small><small><time dateTime={item.createdAt}>{formatOperationalDate(item.createdAt)}</time></small></div></article>)}</div> : <div className="dashboard-empty"><Activity size={24} aria-hidden="true" /><strong>No activity yet</strong><p>Updates to sales, clients, and projects will appear here.</p></div>}
        </section>
      </div>
    </div>
  </>;
}
