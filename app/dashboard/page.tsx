import { Activity, ArrowUpRight, Building2, CircleCheck, Clock3, FolderKanban, Globe2, Inbox, Search, ShieldCheck, UsersRound } from "lucide-react";
import { getDashboardOverview, requireDashboardContext } from "@/lib/dashboard/data";

function formatActivity(action: string) {
  return action.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function DashboardPage() {
  const context = await requireDashboardContext();
  const overview = await getDashboardOverview(context);

  return (
    <>
      <header className="dashboard-topbar">
        <div><span>Internal workspace</span><strong>{context.workspace.name}</strong></div>
        <span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-page-heading">
          <div>
            <span>Phase 3 · Measurement</span>
            <h1>Welcome back, {context.user.name.split(" ")[0]}.</h1>
            <p>New inquiries, client relationships, managed sites, projects, milestones, decisions, and delivery records now share one operating context.</p>
          </div>
          <div className="dashboard-heading-badge"><i /><span><strong>System status</strong><small>Operations active</small></span></div>
        </section>

        <section className="dashboard-metrics" aria-label="Workspace overview">
          <article><span><Inbox size={17} /></span><small>Active leads</small><strong>{overview.counts.leads}</strong><em>Persisted from public inquiries</em></article>
          <article><span><Building2 size={17} /></span><small>Clients</small><strong>{overview.counts.clients}</strong><em>Active relationship records</em></article>
          <article><span><FolderKanban size={17} /></span><small>Open projects</small><strong>{overview.counts.projects}</strong><em>Planned, active, or on hold</em></article>
          <article><span><Globe2 size={17} /></span><small>Managed sites</small><strong>{overview.counts.sites}</strong><em>Production and working environments</em></article>
        </section>

        <div className="dashboard-overview-grid">
          <section className="dashboard-panel dashboard-foundation-panel">
            <div className="dashboard-panel-heading"><div><span>Foundation checklist</span><h2>Built for the work ahead</h2></div><small>Phase 1</small></div>
            <div className="dashboard-foundation-list">
              {[
                [Inbox, "Durable inquiry capture", "Validated submissions are recorded even when notification email is unavailable."],
                [UsersRound, "Connected relationships", "Lead conversion creates the client, primary contact, project, and optional site together."],
                [FolderKanban, "Delivery workspace", "Milestones, deliverables, decisions, and notes stay connected to the engagement."],
                [ShieldCheck, "Audited operations", "Role checks and workspace ownership are repeated inside every important mutation."],
              ].map(([Icon, title, text]) => {
                const ItemIcon = Icon as typeof Inbox;
                return <article key={String(title)}><span><ItemIcon size={17} /></span><div><h3>{String(title)}</h3><p>{String(text)}</p></div><CircleCheck size={16} /></article>;
              })}
            </div>
          </section>

          <section className="dashboard-panel dashboard-roadmap-panel">
            <div className="dashboard-panel-heading"><div><span>Delivery path</span><h2>What comes next</h2></div></div>
            <ol className="dashboard-roadmap">
              <li><i>01</i><span><strong>Foundation</strong><small>Auth, database, roles, audit trail</small></span><em>Complete</em></li>
              <li><i>02</i><span><strong>Internal operations</strong><small>Leads, clients, sites, projects</small></span><em>Complete</em></li>
              <li className="is-active"><i>03</i><span><strong>Measurement</strong><small>Conversions, attribution, source health</small></span><em>Current</em></li>
              <li><i>04</i><span><strong>Client Growth Hub</strong><small>Reports, approvals, public demo</small></span></li>
              <li><i>05</i><span><strong>SEO workspace</strong><small>Audits and reviewed recommendations</small></span></li>
              <li><i>06</i><span><strong>Bounded SEO agent</strong><small>Evidence-backed drafts with approval</small></span></li>
            </ol>
          </section>
        </div>

        <div className="dashboard-secondary-grid">
          <section className="dashboard-panel dashboard-activity-panel">
            <div className="dashboard-panel-heading"><div><span>Activity</span><h2>Recent system events</h2></div><a href="/dashboard/activity">View all <ArrowUpRight size={14} /></a></div>
            {overview.activity.length ? (
              <div className="dashboard-activity-list">
                {overview.activity.map((item) => <article key={item.id}><span><Activity size={15} /></span><div><strong>{formatActivity(item.action)}</strong><small>{item.actorName} · {item.targetType.replaceAll("_", " ")}</small></div><time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></article>)}
              </div>
            ) : (
              <div className="dashboard-empty"><Clock3 size={20} /><strong>No activity yet</strong><p>Important workspace and operational changes will appear here.</p></div>
            )}
          </section>

          <section className="dashboard-panel dashboard-principle-panel">
            <span><Search size={18} /></span>
            <small>Product principle</small>
            <h2>Evidence before autonomy.</h2>
            <p>We will build the operating data, measurement, and human-reviewed SEO workflow before giving an agent tools to act.</p>
            <span className="dashboard-plan-reference">Plan tracked in the repository</span>
          </section>
        </div>
      </div>
    </>
  );
}
