import "server-only";
import { getDatabasePool } from "@/lib/dashboard/db";
export async function seoMetrics(
  workspace: string,
  site: string,
  path?: string,
  after?: Date,
) {
  const pool = getDatabasePool();
  const coverage = (
    await pool.query(
      "SELECT max(metric_date)::text latest FROM search_console_coverage WHERE workspace_id=$1 AND site_id=$2",
      [workspace, site],
    )
  ).rows[0]?.latest as string | null;
  const latest =
    coverage || new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  // Compare equal 28-day windows. Start after the publication's partial Pacific
  // day, matching Search Console's date convention and first-party boundaries.
  const publishedDay = after
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(after)
    : null;
  const start = publishedDay
    ? new Date(Date.parse(publishedDay) + 86400000).toISOString().slice(0, 10)
    : new Date(Date.parse(latest) - 27 * 86400000).toISOString().slice(0, 10);
  const targetEnd = new Date(Date.parse(start) + 27 * 86400000)
    .toISOString()
    .slice(0, 10);
  const end = after && latest > targetEnd ? targetEnd : latest;
  const dimension = path ? "page" : "property",
    value = path ? "https://www.tailoredagents.com" + path : "";
  const [totals, terms, days, events, health] = await Promise.all([
    pool.query(
      "SELECT COALESCE(sum(clicks),0)::float clicks,COALESCE(sum(impressions),0)::float impressions,COALESCE(sum(position*impressions)/nullif(sum(impressions),0),0)::float position FROM search_console_metrics WHERE workspace_id=$1 AND site_id=$2 AND dimension_type=$3 AND dimension_value=$4 AND metric_date BETWEEN $5::date AND $6::date",
      [workspace, site, dimension, value, start, end],
    ),
    pool.query(
      "SELECT dimension_type type,dimension_value value,sum(clicks)::float clicks,sum(impressions)::float impressions,sum(position*impressions)/nullif(sum(impressions),0) position FROM search_console_metrics WHERE workspace_id=$1 AND site_id=$2 AND dimension_type IN ('query','page') AND metric_date BETWEEN $3::date AND $4::date GROUP BY dimension_type,dimension_value ORDER BY sum(impressions) DESC LIMIT 20",
      [workspace, site, start, end],
    ),
    pool.query(
      "SELECT count(*)::int days,bool_or(detail_limited) limited FROM search_console_coverage WHERE workspace_id=$1 AND site_id=$2 AND metric_date BETWEEN $3::date AND $4::date",
      [workspace, site, start, end],
    ),
    pool.query(
      "SELECT count(DISTINCT session_id) FILTER(WHERE event_name='page_view')::int measured_visits,count(DISTINCT session_id) FILTER(WHERE event_name='form_success' AND verification='server')::int measured_inquiries FROM analytics_events WHERE workspace_id=$1 AND site_id=$2 AND occurred_at >= ($3::date::timestamp AT TIME ZONE 'America/Los_Angeles') AND occurred_at < (($5::date+1)::timestamp AT TIME ZONE 'America/Los_Angeles') AND ($4::text IS NULL OR landing_path=$4)",
      [workspace, site, start, path || null, end],
    ),
    pool.query(
      "SELECT status,last_successful_sync_at FROM integration_connections WHERE workspace_id=$1 AND site_id=$2 AND provider='google_search_console'",
      [workspace, site],
    ),
  ]);
  const expected = Math.max(
    0,
    Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
  );
  const searchTotals =
    coverage && (!path || !days.rows[0].limited)
      ? totals.rows[0]
      : { clicks: null, impressions: null, position: null };
  return {
    start,
    end,
    latestGoogleDate: coverage,
    coverageDays: days.rows[0].days,
    expectedDays: expected,
    complete: Boolean(coverage) && days.rows[0].days === expected,
    detailLimited: Boolean(days.rows[0].limited),
    connection: health.rows[0]?.status || "not_connected",
    ...searchTotals,
    ...events.rows[0],
    terms: terms.rows,
    note: "Search Console and measured website activity are distinct evidence. Untracked inquiries are not invented. Page/query rows are separate aggregates; changes are not proof of causation.",
  };
}
