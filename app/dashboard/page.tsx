import { Activity, ArrowUpRight, BarChart3, CircleCheck, Clock3, Database, Globe2, Inbox, LockKeyhole, Search, ShieldCheck } from "lucide-react";
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
            <span>Phase 1 · Foundation</span>
            <h1>Welcome back, {context.user.name.split(" ")[0]}.</h1>
            <p>The private operating foundation is active. Real client operations and measurement are the next layers.</p>
          </div>
          <div className="dashboard-heading-badge"><i /><span><strong>System status</strong><small>Foundation operational</small></span></div>
        </section>

        <section className="dashboard-metrics" aria-label="Workspace overview">
          <article><span><Inbox size={17} /></span><small>Active leads</small><strong>{overview.counts.leads}</strong><em>Lead capture arrives in Phase 2</em></article>
          <article><span><Globe2 size={17} /></span><small>Managed sites</small><strong>{overview.counts.sites}</strong><em>Tailored Agents production site</em></article>
          <article><span><Activity size={17} /></span><small>Recorded activity</small><strong>{overview.counts.activity}</strong><em>Append-only audit events</em></article>
          <article className="dashboard-metric-planned"><span><BarChart3 size={17} /></span><small>Measurement</small><strong>Not connected</strong><em>Instrumentation begins in Phase 3</em></article>
        </section>

        <div className="dashboard-overview-grid">
          <section className="dashboard-panel dashboard-foundation-panel">
            <div className="dashboard-panel-heading"><div><span>Foundation checklist</span><h2>Built for the work ahead</h2></div><small>Phase 1</small></div>
            <div className="dashboard-foundation-list">
              {[
                [LockKeyhole, "Private access", "Allowlisted, single-use email links and database sessions."],
                [Database, "Durable data model", "PostgreSQL migrations, workspaces, roles, sites, leads, and audit records."],
                [ShieldCheck, "Authorization boundary", "Server-only checks at the data layer—not just hidden interface elements."],
                [CircleCheck, "Honest release state", "Planned modules remain visibly staged until their workflows are operational."],
              ].map(([Icon, title, text]) => {
                const ItemIcon = Icon as typeof LockKeyhole;
                return <article key={String(title)}><span><ItemIcon size={17} /></span><div><h3>{String(title)}</h3><p>{String(text)}</p></div><CircleCheck size={16} /></article>;
              })}
            </div>
          </section>

          <section className="dashboard-panel dashboard-roadmap-panel">
            <div className="dashboard-panel-heading"><div><span>Delivery path</span><h2>What comes next</h2></div></div>
            <ol className="dashboard-roadmap">
              <li className="is-active"><i>01</i><span><strong>Foundation</strong><small>Auth, database, roles, audit trail</small></span><em>Current</em></li>
              <li><i>02</i><span><strong>Internal operations</strong><small>Leads, clients, sites, projects</small></span></li>
              <li><i>03</i><span><strong>Measurement</strong><small>Conversions, Search Console, analytics</small></span></li>
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
