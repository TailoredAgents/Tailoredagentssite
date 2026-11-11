import { leadDisplayName, leadCompanyName, formatOperationalDate } from "@/lib/operations/format";
import Link from "next/link";
import { Activity, ArrowRight, Building2, CalendarCheck2, CalendarClock, Columns3, FolderKanban, Globe2, Inbox, ShieldCheck } from "lucide-react";
import { getDashboardOverview, requireDashboardContext } from "@/lib/dashboard/data";
import styles from "./overview.module.css";

export default async function DashboardPage() {
  const context = await requireDashboardContext();
  const overview = await getDashboardOverview(context);
  const mutable = context.role !== "viewer";
  const metrics = [
    { label: "Open prospects", count: overview.counts.leads, detail: "Relationships in progress", href: "/dashboard/leads", icon: Inbox },
    { label: "Clients", count: overview.counts.clients, detail: "Your client relationships", href: "/dashboard/clients", icon: Building2 },
    { label: "Open projects", count: overview.counts.projects, detail: "Planned, active, and on hold", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Active sites", count: overview.counts.sites, detail: "Websites your team manages", href: "/dashboard/sites", icon: Globe2 },
  ];
  const workspaces = [
    { title: "Sales pipeline", description: "Move a conversation toward a paid engagement.", href: "/dashboard/sales", label: "Open sales", icon: Columns3 },
    { title: "Customer conversations", description: "Email, texts, calls, and follow-ups in one place.", href: "/dashboard/inbox", label: "Open Inbox", icon: Inbox },
    { title: "Client delivery", description: "Keep AI, automation, and website projects moving.", href: "/dashboard/projects", label: "Review projects", icon: FolderKanban },
  ];

  return <>
    <header className="dashboard-topbar">
      <div><span>Tailored Agents</span><strong>Business overview</strong></div>
      <span className="dashboard-secure"><ShieldCheck size={16} aria-hidden="true" />Private team workspace</span>
    </header>
    <div className={`dashboard-content ${styles.overview}`}>
      <section className={`dashboard-page-heading ${styles.heading}`}>
        <div><span>Your business, connected</span><h1>Welcome back, {context.user.name.split(" ")[0]}.</h1><p>Your relationships, priorities, and client work at a glance.</p></div>
        <Link className="dashboard-primary-button" href="/dashboard/sales/today"><CalendarCheck2 size={18} aria-hidden="true" />Open My day<ArrowRight size={17} aria-hidden="true" /></Link>
      </section>

      <section className={styles.metrics} aria-label="Workspace overview">
        {metrics.map(({ label, count, detail, href, icon: Icon }) => <Link className={styles.metric} href={href} key={label}>
          <div className={styles.metricTitle}><span>{label}</span><Icon size={19} aria-hidden="true" /></div>
          <strong>{count}</strong><small>{detail}</small>
          <span className={styles.metricFooter}>View {label.toLowerCase().replace(/^(open|active) /, "")}<ArrowRight size={15} aria-hidden="true" /></span>
        </Link>)}
      </section>

      <div className={styles.sectionHeading}><div><h2>Coming up</h2><p>Next seven days, including overdue items</p></div><Link href="/dashboard/calendar">Team calendar<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <div className={styles.priorityGrid}>
        <section className={`dashboard-panel ${styles.priorityPanel}`}>
          <div className="dashboard-panel-heading"><div className={styles.panelTitle}><CalendarClock size={19} aria-hidden="true" /><h2>Prospect follow-ups</h2></div><Link href="/dashboard/sales/today">My day<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.followUps.length ? <ul className="dashboard-task-list">{overview.followUps.map(lead => <li key={lead.id}><Link href={`/dashboard/leads/${lead.id}`}><div><strong>{leadDisplayName(lead)}</strong><small>{lead.nextAction}</small></div><span className={styles.due}>Due {formatOperationalDate(lead.dueAt, { dateOnly: true })}<ArrowRight size={15} aria-hidden="true" /></span></Link></li>)}</ul> : <div className="dashboard-empty"><CalendarClock size={24} aria-hidden="true" /><strong>No prospect follow-ups due</strong><p>Add a next action and date to a prospect. Sales appointments and follow-ups are in My day.</p></div>}
        </section>
        <section className={`dashboard-panel ${styles.priorityPanel}`}>
          <div className="dashboard-panel-heading"><div className={styles.panelTitle}><FolderKanban size={19} aria-hidden="true" /><h2>Project deadlines</h2></div><Link href="/dashboard/projects">All projects<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.upcomingProjects.length ? <ul className="dashboard-task-list">{overview.upcomingProjects.map(project => <li key={project.id}><Link href={`/dashboard/projects/${project.id}`}><div><strong>{project.name}</strong><small>Project deadline</small></div><span className={styles.due}>Due {formatOperationalDate(project.dueAt, { dateOnly: true })}<ArrowRight size={15} aria-hidden="true" /></span></Link></li>)}</ul> : <div className="dashboard-empty"><FolderKanban size={24} aria-hidden="true" /><strong>No upcoming project deadlines</strong><p>Add a due date to a project to keep its deadline in view here.</p></div>}
        </section>
      </div>

      <nav className={styles.quickActions} aria-label="Quick actions">
        <Link href="/dashboard/leads?status=new" className="dashboard-secondary-button">Review new prospects<ArrowRight size={15} aria-hidden="true" /></Link>
        {mutable ? <><Link href="/dashboard/clients#create-client" className="dashboard-secondary-button">Add a client</Link><Link href="/dashboard/projects#create-project" className="dashboard-secondary-button">Start a project</Link></> : null}
      </nav>

      <div className={styles.secondaryGrid}>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span>New relationships</span><h2>Recent open prospects</h2></div><Link href="/dashboard/leads">All prospects<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.recentLeads.length ? <ul className="dashboard-task-list">{overview.recentLeads.map(lead => <li key={lead.id}><Link href={`/dashboard/leads/${lead.id}`}><div><strong>{leadDisplayName(lead)}</strong><small>{leadCompanyName(lead) ? `${leadCompanyName(lead)} · ` : ""}{formatOperationalDate(lead.createdAt, { dateOnly: true })}</small></div><ArrowRight size={18} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><Inbox size={24} aria-hidden="true" /><strong>No open prospects</strong><p>Connections, referrals, outreach, and inquiries appear here. Closed records remain in Prospects.</p></div>}
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span>Team updates</span><h2>Recent activity</h2></div><Link href="/dashboard/activity">All activity<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {overview.activity.length ? <div className="dashboard-activity-list">{overview.activity.map(item => <article key={item.id}><span><Activity size={18} aria-hidden="true" /></span><div><strong>{item.action.replaceAll(".", " ").replaceAll("_", " ")}</strong><small>{item.actorName}</small><small><time dateTime={item.createdAt}>{formatOperationalDate(item.createdAt)}</time></small></div></article>)}</div> : <div className="dashboard-empty"><Activity size={24} aria-hidden="true" /><strong>No activity yet</strong><p>Updates to sales, clients, and projects will appear here.</p></div>}
        </section>
      </div>

      <div className={styles.sectionHeading}><div><h2>Your workspaces</h2><p>From the first conversation to delivery</p></div></div>
      <section className={styles.workspaces} aria-label="Team workspaces">
        {workspaces.map(({ title, description, href, label, icon: Icon }) => <Link className={styles.workspace} href={href} key={title}>
          <span className={styles.workspaceIcon}><Icon size={21} aria-hidden="true" /></span>
          <div><h3>{title}</h3><p>{description}</p></div><span className={styles.workspaceCta}>{label}<ArrowRight size={16} aria-hidden="true" /></span>
        </Link>)}
      </section>
    </div>
  </>;
}
