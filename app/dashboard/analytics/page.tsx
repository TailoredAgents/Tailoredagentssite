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
  ExternalLink,
  MousePointerClick,
  RefreshCw,
  Search,
  Target,
  Unplug,
  UsersRound,
} from "lucide-react";
import { getAnalyticsOverview } from "@/lib/analytics/data";
import { parseAnalyticsRange } from "@/lib/analytics/validation";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getSearchConsoleOverview } from "@/lib/search-console/data";

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

function searchPage(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return value;
  }
}

const integrationNotices: Record<string, { tone: string; message: string }> = {
  connected: { tone: "success", message: "Search Console connected and its initial history was imported." },
  synced: { tone: "success", message: "Search Console data is up to date." },
  disconnected: { tone: "neutral", message: "Search Console was disconnected. Previously imported metrics remain available." },
  denied: { tone: "neutral", message: "Google authorization was cancelled; no connection was changed." },
  not_connected: { tone: "neutral", message: "Connect Google Search Console before requesting a sync." },
  not_configured: { tone: "error", message: "Add the Google OAuth client ID and secret in Render before connecting." },
  matching_property_not_found: { tone: "error", message: "The Google account does not have a verified tailoredagents.com Search Console property yet." },
  missing_refresh_token: { tone: "error", message: "Google did not issue offline access. Reconnect and approve the consent prompt." },
  invalid_state: { tone: "error", message: "The connection request expired or could not be verified. Start it again from this page." },
  scope_missing: { tone: "error", message: "Read-only Search Console access was not granted." },
  site_missing: { tone: "error", message: "No active production site is available for this connection." },
  connection_error: { tone: "error", message: "Google could not be connected. Check the OAuth setup and try again." },
  sync_error: { tone: "error", message: "The connection is saved, but the latest Search Console import failed. Try syncing again." },
  forbidden: { tone: "error", message: "Only a workspace owner or administrator can manage integrations." },
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[]; integration?: string | string[] }>;
}) {
  const context = await requireDashboardContext();
  const parameters = await searchParams;
  const range = parseAnalyticsRange(parameters.range);
  const [analytics, searchConsole] = await Promise.all([
    getAnalyticsOverview(context, range),
    getSearchConsoleOverview(context, range),
  ]);
  const integrationKey = Array.isArray(parameters.integration) ? parameters.integration[0] : parameters.integration;
  const integrationNotice = integrationKey ? integrationNotices[integrationKey] : undefined;
  const hasSearchConsoleProperty = Boolean(searchConsole.connection?.propertyUri);
  const canSyncSearchConsole = hasSearchConsoleProperty && searchConsole.connection?.status !== "disconnected";
  const maximumPageViews = Math.max(1, ...analytics.trend.map((day) => day.pageViews));
  const maximumSearchImpressions = Math.max(1, ...searchConsole.trend.map((day) => day.impressions));
  const funnelBase = Math.max(1, analytics.funnel[0]?.sessions ?? 0);

  return (
    <>
      <header className="dashboard-topbar">
        <div><span>Measurement</span><strong>Analytics</strong></div>
        <span className="dashboard-secure"><Activity size={15} />First-party events</span>
      </header>

      <div className="dashboard-content">
        {integrationNotice ? (
          <section className={`analytics-notice is-${integrationNotice.tone}`} role="status">{integrationNotice.message}</section>
        ) : null}
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
              <article><span className={searchConsole.connection?.status === "active" ? "is-active" : ""}><Search size={16} /></span><div><strong>Google Search Console</strong><small>{searchConsole.connection?.lastSuccessfulSyncAt ? `Last imported: ${timestamp(searchConsole.connection.lastSuccessfulSyncAt)}` : searchConsole.configured ? "Ready to connect with read-only access." : "OAuth credentials are not configured."}</small></div><em>{searchConsole.connection?.status === "active" ? "Active" : searchConsole.connection?.status === "error" ? "Needs attention" : "Not connected"}</em></article>
              <article><span><Database size={16} /></span><div><strong>Google Analytics 4</strong><small>Optional; add only if it contributes data this system does not already own.</small></div><em>Optional</em></article>
            </div>
            <Link className="analytics-data-link" href="/privacy">Review measurement disclosure <ArrowUpRight size={13} /></Link>
          </section>
        </div>

        <section className="dashboard-panel search-console-panel">
          <div className="dashboard-panel-heading search-console-heading">
            <div><span>Organic search</span><h2>Google Search Console</h2><small>Observed Google Search clicks and impressions; no estimated rankings or synthetic data.</small></div>
            {canSyncSearchConsole ? (
              <div className="search-console-actions">
                <form action="/api/integrations/search-console/sync" method="post"><button className="button button-light" type="submit"><RefreshCw size={13} />Sync now</button></form>
                <form action="/api/integrations/search-console/disconnect" method="post"><button className="search-console-disconnect" type="submit"><Unplug size={13} />Disconnect</button></form>
              </div>
            ) : searchConsole.configured && searchConsole.connection?.status === "disconnected" ? (
              <a className="button button-dark search-console-reconnect" href="/api/integrations/search-console/connect">Reconnect <ExternalLink size={13} /></a>
            ) : null}
          </div>

          {!searchConsole.configured ? (
            <div className="search-console-setup"><Search size={22} /><div><strong>Google OAuth setup is required.</strong><p>Add the two Search Console OAuth credentials in Render, then return here to authorize read-only access.</p><code>{searchConsole.redirectUri}</code></div></div>
          ) : !hasSearchConsoleProperty ? (
            <div className="search-console-setup"><Search size={22} /><div><strong>Connect the verified tailoredagents.com property.</strong><p>The connection requests only Search Console read access and stores its refresh token encrypted.</p><a className="button button-dark" href="/api/integrations/search-console/connect">Connect Google Search Console <ExternalLink size={13} /></a></div></div>
          ) : (
            <>
              <div className="search-console-context"><span>{searchConsole.connection?.propertyUri}</span><small>Finalized data through {searchConsole.totals.latestDate ? shortDate(searchConsole.totals.latestDate) : "the first successful data date"}</small></div>
              <div className="search-console-metrics">
                <article><small>Search clicks</small><strong>{number(searchConsole.totals.clicks)}</strong><span>Visits from Google Search</span></article>
                <article><small>Impressions</small><strong>{number(searchConsole.totals.impressions)}</strong><span>Appearances in search results</span></article>
                <article><small>Search CTR</small><strong>{percent(searchConsole.totals.ctr * 100)}</strong><span>Clicks divided by impressions</span></article>
                <article><small>Average position</small><strong>{searchConsole.totals.position ? searchConsole.totals.position.toFixed(1) : "—"}</strong><span>Impression-weighted position</span></article>
              </div>
              <div className="search-console-trend" role="img" aria-label={`Daily Google Search impressions and clicks over the last ${analytics.days} days`}>
                {searchConsole.trend.map((day, index) => (
                  <div key={day.date} title={`${shortDate(day.date)}: ${day.impressions} impressions, ${day.clicks} clicks`}>
                    <span><i style={{ "--search-height": `${Math.max(day.impressions ? 5 : 0, day.impressions / maximumSearchImpressions * 100)}%` } as CSSProperties} />{day.clicks ? <b aria-hidden="true" /> : null}</span>
                    {(index === 0 || index === searchConsole.trend.length - 1 || analytics.days <= 7) ? <small>{shortDate(day.date)}</small> : <small aria-hidden="true">·</small>}
                  </div>
                ))}
              </div>
              <div className="search-console-grid">
                <div className="analytics-table search-console-table">
                  <div className="analytics-table-head"><span>Top query</span><span>Clicks</span><span>Position</span></div>
                  {searchConsole.queries.length ? searchConsole.queries.map((query) => <div className="analytics-table-row" key={query.value}><span><strong>{query.value}</strong><small>{number(query.impressions)} impressions</small></span><b>{number(query.clicks)}</b><b>{query.position.toFixed(1)}</b></div>) : <div className="dashboard-empty"><Search size={20} /><strong>No query data yet</strong><p>New properties can take time to accumulate finalized search data.</p></div>}
                </div>
                <div className="analytics-table search-console-table">
                  <div className="analytics-table-head"><span>Top search page</span><span>Clicks</span><span>Position</span></div>
                  {searchConsole.pages.length ? searchConsole.pages.map((page) => <div className="analytics-table-row" key={page.value}><span><strong>{searchPage(page.value)}</strong><small>{number(page.impressions)} impressions</small></span><b>{number(page.clicks)}</b><b>{page.position.toFixed(1)}</b></div>) : <div className="dashboard-empty"><Database size={20} /><strong>No page data yet</strong><p>The importer will retain finalized page performance as it becomes available.</p></div>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
