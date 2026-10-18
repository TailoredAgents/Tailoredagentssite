import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  analyticsRangeDays,
  type AnalyticsRange,
} from "./validation";

type CountRow = {
  page_views: string;
  sessions: string;
  form_starts: string;
  conversions: string;
  cta_clicks: string;
  phone_clicks: string;
};

export async function getAnalyticsOverview(
  context: DashboardContext,
  range: AnalyticsRange,
) {
  const pool = getDatabasePool();
  const days = analyticsRangeDays(range);
  const values: [string, number] = [context.workspace.id, days];
  const since = `current_date - ($2::int - 1)`;

  const [summary, engaged, trend, pages, sources, funnel, freshness] = await Promise.all([
    pool.query<CountRow>(
      `SELECT
         count(*) FILTER (WHERE event_name = 'page_view')::text AS page_views,
         count(DISTINCT session_id)::text AS sessions,
         count(*) FILTER (WHERE event_name = 'form_start')::text AS form_starts,
         count(*) FILTER (WHERE event_name = 'form_success')::text AS conversions,
         count(*) FILTER (WHERE event_name IN ('cta_click', 'booking_click'))::text AS cta_clicks,
         count(*) FILTER (WHERE event_name = 'phone_click')::text AS phone_clicks
       FROM analytics_events
       WHERE workspace_id = $1 AND occurred_at >= ${since}`,
      values,
    ),
    pool.query<{ count: string }>(
      `WITH session_activity AS (
         SELECT session_id,
                count(*) FILTER (WHERE event_name = 'page_view') AS page_views,
                bool_or(event_name <> 'page_view') AS interacted
         FROM analytics_events
         WHERE workspace_id = $1 AND occurred_at >= ${since}
         GROUP BY session_id
       )
       SELECT count(*) FILTER (WHERE page_views > 1 OR interacted)::text AS count
       FROM session_activity`,
      values,
    ),
    pool.query<{
      day: string;
      page_views: string;
      sessions: string;
      conversions: string;
    }>(
      `WITH days AS (
         SELECT generate_series(${since}, current_date, interval '1 day')::date AS day
       )
       SELECT days.day::text,
              count(event.id) FILTER (WHERE event.event_name = 'page_view')::text AS page_views,
              count(DISTINCT event.session_id)::text AS sessions,
              count(event.id) FILTER (WHERE event.event_name = 'form_success')::text AS conversions
       FROM days
       LEFT JOIN analytics_events event
         ON event.workspace_id = $1
        AND event.occurred_at >= days.day
        AND event.occurred_at < days.day + interval '1 day'
       GROUP BY days.day
       ORDER BY days.day`,
      values,
    ),
    pool.query<{
      path: string;
      page_views: string;
      sessions: string;
    }>(
      `SELECT path,
              count(*)::text AS page_views,
              count(DISTINCT session_id)::text AS sessions
       FROM analytics_events
       WHERE workspace_id = $1
         AND occurred_at >= ${since}
         AND event_name = 'page_view'
       GROUP BY path
       ORDER BY count(*) DESC, path
       LIMIT 8`,
      values,
    ),
    pool.query<{
      source: string;
      medium: string | null;
      sessions: string;
      conversions: string;
    }>(
      `SELECT
         coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'Direct / none') AS source,
         nullif(utm_medium, '') AS medium,
         count(DISTINCT session_id)::text AS sessions,
         count(*) FILTER (WHERE event_name = 'form_success')::text AS conversions
       FROM analytics_events
       WHERE workspace_id = $1 AND occurred_at >= ${since}
       GROUP BY source, medium
       ORDER BY count(DISTINCT session_id) DESC, source
       LIMIT 8`,
      values,
    ),
    pool.query<{ stage: string; sessions: string }>(
      `SELECT
         CASE
           WHEN event_name IN ('cta_click', 'phone_click', 'booking_click') THEN 'intent'
           ELSE event_name
         END AS stage,
         count(DISTINCT session_id)::text AS sessions
       FROM analytics_events
       WHERE workspace_id = $1
         AND occurred_at >= ${since}
         AND event_name IN ('page_view', 'cta_click', 'phone_click', 'booking_click', 'form_start', 'form_success')
       GROUP BY stage`,
      values,
    ),
    pool.query<{ first_event_at: Date | null; last_event_at: Date | null }>(
      `SELECT min(occurred_at) AS first_event_at, max(occurred_at) AS last_event_at
       FROM analytics_events
       WHERE workspace_id = $1`,
      [context.workspace.id],
    ),
  ]);

  const totals = summary.rows[0] ?? {
    page_views: "0",
    sessions: "0",
    form_starts: "0",
    conversions: "0",
    cta_clicks: "0",
    phone_clicks: "0",
  };
  const sessions = Number(totals.sessions);
  const conversions = Number(totals.conversions);
  const funnelByStage = new Map(funnel.rows.map((row) => [row.stage, Number(row.sessions)]));

  return {
    range,
    days,
    totals: {
      pageViews: Number(totals.page_views),
      sessions,
      engagedSessions: Number(engaged.rows[0]?.count ?? 0),
      formStarts: Number(totals.form_starts),
      conversions,
      ctaClicks: Number(totals.cta_clicks),
      phoneClicks: Number(totals.phone_clicks),
      conversionRate: sessions ? conversions / sessions * 100 : 0,
    },
    trend: trend.rows.map((row) => ({
      day: row.day,
      pageViews: Number(row.page_views),
      sessions: Number(row.sessions),
      conversions: Number(row.conversions),
    })),
    pages: pages.rows.map((row) => ({
      path: row.path,
      pageViews: Number(row.page_views),
      sessions: Number(row.sessions),
    })),
    sources: sources.rows.map((row) => ({
      source: row.source,
      medium: row.medium,
      sessions: Number(row.sessions),
      conversions: Number(row.conversions),
    })),
    funnel: [
      { key: "page_view", label: "Visited site", sessions: funnelByStage.get("page_view") ?? 0 },
      { key: "engaged", label: "Engaged", sessions: Number(engaged.rows[0]?.count ?? 0) },
      { key: "intent", label: "Clicked a next step", sessions: funnelByStage.get("intent") ?? 0 },
      { key: "form_start", label: "Started a form", sessions: funnelByStage.get("form_start") ?? 0 },
      { key: "form_success", label: "Submitted an inquiry", sessions: funnelByStage.get("form_success") ?? 0 },
    ],
    freshness: {
      firstEventAt: freshness.rows[0]?.first_event_at?.toISOString() ?? null,
      lastEventAt: freshness.rows[0]?.last_event_at?.toISOString() ?? null,
    },
  };
}
