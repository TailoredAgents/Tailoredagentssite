import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  MousePointerClick,
  Search,
  Target,
  UsersRound,
} from "lucide-react";
import { getAnalyticsOverview } from "@/lib/analytics/data";
import { parseAnalyticsRange } from "@/lib/analytics/validation";
import { requireDashboardContext } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Analytics" };

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    .format(new Date(`${value}T12:00:00Z`));
}

function timestamp(value: string | null) {
  if (!value) return "Waiting for the first event";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const context = await requireDashboardContext();
  const range = parseAnalyticsRange((await searchParams).range);
  const analytics = await getAnalyticsOverview(context, range);
  const maximumPageViews = Math.max(1, ...analytics.trend.map((day) => day.pageViews));
  const funnelBase = Math.max(1, analytics.funnel[0]?.sessions ?? 0);

  return (
    <>
      <header className="dashboard-topbar">
        <div><span>Measurement</span><strong>Analytics</strong></div>
        <span className="dashboard-secure"><Activity size={15} />First-party events</span>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-page-heading analytics-heading">
          <div>
            <span>Phase 3 · Measurement</span>
            <h1>See what is creating <em>momentum.</em></h1>
            <p>Real website activity, acquisition context, and inquiry conversions—collected without advertising identifiers or persistent tracking cookies.</p>
          </div>
          <nav className="analytics-range" aria-label="Analytics date range">
            {(["7d", "30d", "90d"] as const).map((value) => (
              <Link className={range === value ? "is-current" : ""} href={`/dashboard/analytics?range=${value}`} key={value}>{value}</Link>
            ))}
          </nav>
        </section>

        {!analytics.freshness.lastEventAt ? (
          <section className="analytics-empty-banner">
            <Clock3 size={18} />
            <div><strong>Measurement is active.</strong><span>New public visits and conversion events will populate this view after the deployment is live.</span></div>
          </section>
        ) : null}

        <section className="dashboard-metrics analytics-metrics" aria-label="Website performance overview">
          <article><span><BarChart3 size={17} /></span><small>Page views</small><strong>{number(analytics.totals.pageViews)}</strong><em>Public pages in the last {analytics.days} days</em></article>
          <article><span><UsersRound size={17} /></span><small>Sessions</small><strong>{number(analytics.totals.sessions)}</strong><em>{number(analytics.totals.engagedSessions)} showed meaningful engagement</em></article>
          <article><span><Target size={17} /></span><small>Inquiry conversions</small><strong>{number(analytics.totals.conversions)}</strong><em>{percent(analytics.totals.conversionRate)} of measured sessions</em></article>
          <article><span><MousePointerClick size={17} /></span><small>Next-step clicks</small><strong>{number(analytics.totals.ctaClicks + analytics.totals.phoneClicks)}</strong><em>{number(analytics.totals.phoneClicks)} phone click{analytics.totals.phoneClicks === 1 ? "" : "s"}</em></article>
        </section>

        <section className="dashboard-panel analytics-trend-panel">
          <div className="dashboard-panel-heading">
            <div><span>Daily movement</span><h2>Traffic and conversions</h2></div>
            <small>{range} window</small>
          </div>
          <div className="analytics-chart" role="img" aria-label={`Daily page views over the last ${analytics.days} days`}>
            {analytics.trend.map((day, index) => (
              <div className="analytics-chart-column" key={day.day} title={`${shortDate(day.day)}: ${day.pageViews} page views, ${day.sessions} sessions, ${day.conversions} conversions`}>
                <div className="analytics-chart-track">
                  <i style={{ "--analytics-height": `${Math.max(day.pageViews ? 6 : 0, day.pageViews / maximumPageViews * 100)}%` } as CSSProperties} />
                  {day.conversions ? <b aria-hidden="true" /> : null}
                </div>
                {(index === 0 || index === analytics.trend.length - 1 || (analytics.days <= 7)) ? <small>{shortDate(day.day)}</small> : <small aria-hidden="true">·</small>}
              </div>
            ))}
          </div>
          <div className="analytics-chart-legend"><span><i />Page views</span><span><b />Inquiry conversion</span></div>
        </section>

        <div className="analytics-grid">
          <section className="dashboard-panel analytics-list-panel">
            <div className="dashboard-panel-heading"><div><span>Acquisition</span><h2>Where sessions began</h2></div></div>
            {analytics.sources.length ? (
              <div className="analytics-table">
                <div className="analytics-table-head"><span>Source</span><span>Sessions</span><span>Inquiries</span></div>
                {analytics.sources.map((source) => (
                  <div className="analytics-table-row" key={`${source.source}-${source.medium ?? "none"}`}>
                    <span><strong>{source.source}</strong><small>{source.medium || "Referral or direct"}</small></span>
                    <b>{number(source.sessions)}</b>
                    <b>{number(source.conversions)}</b>
                  </div>
                ))}
              </div>
            ) : <div className="dashboard-empty"><Search size={20} /><strong>No acquisition data yet</strong><p>UTM parameters and external referring domains will appear here.</p></div>}
          </section>

          <section className="dashboard-panel analytics-list-panel">
            <div className="dashboard-panel-heading"><div><span>Content</span><h2>Most-viewed pages</h2></div></div>
            {analytics.pages.length ? (
              <div className="analytics-table analytics-pages-table">
                <div className="analytics-table-head"><span>Page</span><span>Views</span><span>Sessions</span></div>
                {analytics.pages.map((page) => (
                  <div className="analytics-table-row" key={page.path}>
                    <span><strong>{page.path}</strong><small>{page.sessions ? (page.pageViews / page.sessions).toFixed(1) : "0"} views / session</small></span>
                    <b>{number(page.pageViews)}</b>
                    <b>{number(page.sessions)}</b>
                  </div>
                ))}
              </div>
            ) : <div className="dashboard-empty"><BarChart3 size={20} /><strong>No page data yet</strong><p>Public page views will begin accumulating after deployment.</p></div>}
          </section>
        </div>

        <div className="analytics-grid analytics-lower-grid">
          <section className="dashboard-panel analytics-funnel-panel">
            <div className="dashboard-panel-heading"><div><span>Conversion path</span><h2>Session funnel</h2></div></div>
            <ol className="analytics-funnel">
              {analytics.funnel.map((stage, index) => (
                <li key={stage.key}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <span><strong>{stage.label}</strong><small>{percent(stage.sessions / funnelBase * 100)} of visiting sessions</small></span>
                  <div><b style={{ width: `${stage.sessions / funnelBase * 100}%` }} /><em>{number(stage.sessions)}</em></div>
                </li>
              ))}
            </ol>
          </section>

          <section className="dashboard-panel analytics-status-panel">
            <div className="dashboard-panel-heading"><div><span>Data health</span><h2>Sources and freshness</h2></div></div>
            <div className="analytics-status-list">
              <article><span className="is-active"><CheckCircle2 size={16} /></span><div><strong>First-party website events</strong><small>Last received: {timestamp(analytics.freshness.lastEventAt)}</small></div><em>Active</em></article>
              <article><span><Search size={16} /></span><div><strong>Google Search Console</strong><small>Connection and scheduled ingestion are the next Phase 3 slice.</small></div><em>Not connected</em></article>
              <article><span><Database size={16} /></span><div><strong>Google Analytics 4</strong><small>Optional; add only if it contributes data this system does not already own.</small></div><em>Optional</em></article>
            </div>
            <Link className="analytics-data-link" href="/privacy">Review measurement disclosure <ArrowUpRight size={13} /></Link>
          </section>
        </div>
      </div>
    </>
  );
}
