import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { analyticsRangeDays, type AnalyticsRange } from "@/lib/analytics/validation";
import { getSearchConsoleConnection } from "./connection";

export async function getSearchConsoleOverview(
  context: DashboardContext,
  range: AnalyticsRange,
) {
  const connectionState = await getSearchConsoleConnection(context);
  const days = analyticsRangeDays(range);
  const values: [string, number] = [context.workspace.id, days];
  const since = `current_date - ($2::int - 1)`;
  const pool = getDatabasePool();

  const [summary, trend, queries, pages] = await Promise.all([
    pool.query<{
      clicks: string;
      impressions: string;
      ctr: string;
      position: string;
      latest_date: string | null;
    }>(
      `SELECT
         coalesce(sum(clicks), 0)::text AS clicks,
         coalesce(sum(impressions), 0)::text AS impressions,
         CASE WHEN sum(impressions) > 0 THEN (sum(clicks) / sum(impressions))::text ELSE '0' END AS ctr,
         CASE WHEN sum(impressions) > 0 THEN (sum(position * impressions) / sum(impressions))::text ELSE '0' END AS position,
         max(metric_date)::text AS latest_date
       FROM search_console_metrics
       WHERE workspace_id = $1 AND metric_date >= ${since} AND dimension_type = 'property'`,
      values,
    ),
    pool.query<{ date: string; clicks: string; impressions: string }>(
      `WITH days AS (
         SELECT generate_series(${since}, current_date, interval '1 day')::date AS day
       )
       SELECT days.day::text AS date,
              coalesce(sum(metric.clicks), 0)::text AS clicks,
              coalesce(sum(metric.impressions), 0)::text AS impressions
       FROM days
       LEFT JOIN search_console_metrics metric
         ON metric.workspace_id = $1
        AND metric.dimension_type = 'property'
        AND metric.metric_date = days.day
       GROUP BY days.day
       ORDER BY days.day`,
      values,
    ),
    pool.query<{ value: string; clicks: string; impressions: string; position: string }>(
      `SELECT dimension_value AS value,
              sum(clicks)::text AS clicks,
              sum(impressions)::text AS impressions,
              CASE WHEN sum(impressions) > 0 THEN (sum(position * impressions) / sum(impressions))::text ELSE '0' END AS position
       FROM search_console_metrics
       WHERE workspace_id = $1 AND metric_date >= ${since} AND dimension_type = 'query'
       GROUP BY dimension_value
       ORDER BY sum(clicks) DESC, sum(impressions) DESC, dimension_value
       LIMIT 10`,
      values,
    ),
    pool.query<{ value: string; clicks: string; impressions: string; position: string }>(
      `SELECT dimension_value AS value,
              sum(clicks)::text AS clicks,
              sum(impressions)::text AS impressions,
              CASE WHEN sum(impressions) > 0 THEN (sum(position * impressions) / sum(impressions))::text ELSE '0' END AS position
       FROM search_console_metrics
       WHERE workspace_id = $1 AND metric_date >= ${since} AND dimension_type = 'page'
       GROUP BY dimension_value
       ORDER BY sum(clicks) DESC, sum(impressions) DESC, dimension_value
       LIMIT 10`,
      values,
    ),
  ]);
  const totals = summary.rows[0];

  return {
    ...connectionState,
    totals: {
      clicks: Number(totals?.clicks ?? 0),
      impressions: Number(totals?.impressions ?? 0),
      ctr: Number(totals?.ctr ?? 0),
      position: Number(totals?.position ?? 0),
      latestDate: totals?.latest_date ?? null,
    },
    trend: trend.rows.map((row) => ({
      date: row.date,
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
    })),
    queries: queries.rows.map((row) => ({
      value: row.value,
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
      position: Number(row.position),
    })),
    pages: pages.rows.map((row) => ({
      value: row.value,
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
      position: Number(row.position),
    })),
  };
}
