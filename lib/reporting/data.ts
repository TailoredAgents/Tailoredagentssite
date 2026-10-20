import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { requireReportingSite } from "@/lib/dashboard/site-access";
import {
  datesDescending,
  previousRange,
  reportToday,
  resolveReportRange,
  shiftDate,
  type DateRange,
  type ReportSelection,
} from "./dates";

const timeBounds =
  "occurred_at >= ($3::date::timestamp AT TIME ZONE 'America/Los_Angeles') AND occurred_at < (($4::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')";
const leadBounds = timeBounds.replaceAll("occurred_at", "created_at");
async function websiteTotals(
  workspace: string,
  site: string,
  range: DateRange,
) {
  const pool = getDatabasePool(),
    values = [workspace, site, range.start, range.end];
  const [events, inquiries] = await Promise.all([
    pool.query(
      `WITH visits AS (SELECT session_id, bool_or(event_name = 'page_view') AS visited,
        bool_or(event_name = 'form_success' AND verification = 'server') AS converted
      FROM analytics_events WHERE workspace_id = $1 AND site_id = $2 AND ${timeBounds} GROUP BY session_id)
      SELECT count(*) FILTER (WHERE visited)::int AS visits,
        count(*) FILTER (WHERE visited AND converted)::int AS converting_visits FROM visits`,
      values,
    ),
    pool.query(
      `SELECT count(*)::int AS inquiries, count(*) FILTER (WHERE measurement_status = 'recorded')::int AS attributed
      FROM leads WHERE workspace_id = $1 AND source = 'website' AND ${leadBounds.replaceAll("$3", "$2").replaceAll("$4", "$3")}`,
      [workspace, range.start, range.end],
    ),
  ]);
  const visits = Number(events.rows[0].visits),
    convertingVisits = Number(events.rows[0].converting_visits);
  return {
    visits,
    inquiries: Number(inquiries.rows[0].inquiries),
    attributed: Number(inquiries.rows[0].attributed),
    convertingVisits,
    conversionRate: visits ? (convertingVisits / visits) * 100 : 0,
  };
}
async function googleTotals(workspace: string, site: string, range: DateRange) {
  const result = await getDatabasePool().query(
    `SELECT coalesce(sum(clicks),0)::float AS clicks,
    coalesce(sum(impressions),0)::float AS impressions,
    coalesce(sum(position * impressions) / nullif(sum(impressions),0),0)::float AS position,
    count(*)::int AS rows FROM search_console_metrics WHERE workspace_id = $1 AND site_id = $2
    AND metric_date BETWEEN $3::date AND $4::date AND dimension_type = 'property'`,
    [workspace, site, range.start, range.end],
  );
  const row = result.rows[0];
  return {
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    position: Number(row.position),
    ctr: row.impressions
      ? (Number(row.clicks) / Number(row.impressions)) * 100
      : 0,
    savedRows: Number(row.rows),
  };
}
export async function getReportingOverview(
  context: DashboardContext,
  selection: ReportSelection,
) {
  const site = await requireReportingSite(context),
    pool = getDatabasePool(),
    scope = [context.workspace.id, site.id];
  const [coverageResult, freshness, starts] = await Promise.all([
    pool.query(
      `SELECT metric_date::text AS day, detail_limited FROM search_console_coverage
      WHERE workspace_id = $1 AND site_id = $2 ORDER BY metric_date`,
      scope,
    ),
    pool.query(
      `SELECT max(occurred_at) AS latest FROM analytics_events WHERE workspace_id = $1 AND site_id = $2`,
      scope,
    ),
    pool.query(`SELECT filename, ((applied_at AT TIME ZONE 'America/Los_Angeles')::date + 1)::text AS day
      FROM schema_migrations WHERE filename IN ('0003_first_party_analytics.sql','0002_internal_operations.sql')`),
  ]);
  const covered = new Set<string>(coverageResult.rows.map((row) => row.day));
  const latest = coverageResult.rows.at(-1)?.day as string | undefined;
  const websiteRange = resolveReportRange(selection),
    googleRange = resolveReportRange(
      selection,
      latest ?? shiftDate(reportToday(), -3),
    );
  const websitePrevious = previousRange(websiteRange),
    googlePrevious = previousRange(googleRange);
  const websiteStart = starts.rows.find(
    (row) => row.filename === "0003_first_party_analytics.sql",
  )?.day as string | undefined;
  const inquiryStart = starts.rows.find(
    (row) => row.filename === "0002_internal_operations.sql",
  )?.day as string | undefined;
  const values = [...scope, websiteRange.start, websiteRange.end];
  const [
    website,
    earlierWebsite,
    google,
    earlierGoogle,
    dailyEvents,
    dailyLeads,
    dailyGoogle,
    activities,
  ] = await Promise.all([
    websiteTotals(scope[0], scope[1], websiteRange),
    websiteTotals(scope[0], scope[1], websitePrevious),
    googleTotals(scope[0], scope[1], googleRange),
    googleTotals(scope[0], scope[1], googlePrevious),
    pool.query(
      `SELECT (occurred_at AT TIME ZONE 'America/Los_Angeles')::date::text AS day,
      count(DISTINCT session_id) FILTER (WHERE event_name = 'page_view')::int AS visits
      FROM analytics_events WHERE workspace_id = $1 AND site_id = $2 AND ${timeBounds} GROUP BY day`,
      values,
    ),
    pool.query(
      `SELECT (created_at AT TIME ZONE 'America/Los_Angeles')::date::text AS day, count(*)::int AS inquiries
      FROM leads WHERE workspace_id = $1 AND source = 'website' AND ${leadBounds.replaceAll("$3", "$2").replaceAll("$4", "$3")} GROUP BY day`,
      [scope[0], websiteRange.start, websiteRange.end],
    ),
    pool.query(
      `SELECT metric_date::text AS day, clicks, impressions FROM search_console_metrics WHERE workspace_id = $1 AND site_id = $2
      AND dimension_type = 'property' AND metric_date BETWEEN $3::date AND $4::date`,
      [...scope, googleRange.start, googleRange.end],
    ),
    pool.query(
      `SELECT event_name, verification, count(*)::int AS count FROM analytics_events
      WHERE workspace_id = $1 AND site_id = $2 AND ${timeBounds} GROUP BY event_name,verification`,
      values,
    ),
  ]);
  const googleMissing = datesDescending(
    googleRange.start,
    googleRange.end,
  ).filter((day) => !covered.has(day));
  const completeGoogle = googleMissing.length === 0;
  const countActivity = (name: string) =>
    activities.rows
      .filter((row) => row.event_name === name)
      .reduce((sum, row) => sum + Number(row.count), 0);
  return {
    selection,
    generatedAt: new Date().toISOString(),
    latestActivity:
      (freshness.rows[0].latest as Date | null)?.toISOString() ?? null,
    website: {
      ...website,
      range: websiteRange,
      previous: websitePrevious,
      complete: Boolean(
        websiteStart &&
          inquiryStart &&
          websiteStart <= websiteRange.start &&
          inquiryStart <= websiteRange.start &&
          websiteRange.end < reportToday(),
      ),
      comparison:
        websiteStart &&
        inquiryStart &&
        websiteStart <= websitePrevious.start &&
        inquiryStart <= websitePrevious.start &&
        websiteRange.end < reportToday()
          ? earlierWebsite
          : null,
      trend: datesDescending(websiteRange.start, websiteRange.end)
        .reverse()
        .map((day) => ({
          day,
          visits:
            websiteStart && day >= websiteStart && day < reportToday()
              ? Number(
                  dailyEvents.rows.find((row) => row.day === day)?.visits ?? 0,
                )
              : null,
          inquiries:
            inquiryStart && day >= inquiryStart && day < reportToday()
              ? Number(
                  dailyLeads.rows.find((row) => row.day === day)?.inquiries ??
                    0,
                )
              : null,
        })),
      activities: {
        phoneClicks: countActivity("phone_click"),
        bookingClicks: countActivity("booking_click"),
        formStarts: countActivity("form_start"),
        legacySubmissions: Number(
          activities.rows.find(
            (row) =>
              row.event_name === "form_success" &&
              row.verification === "browser",
          )?.count ?? 0,
        ),
      },
    },
    google: {
      ...google,
      range: googleRange,
      previous: googlePrevious,
      available:
        googleMissing.length < googleRange.days || google.savedRows > 0,
      complete: completeGoogle,
      missing: googleMissing,
      latest: latest ?? null,
      detailLimited: coverageResult.rows.some(
        (row) =>
          row.day >= googleRange.start &&
          row.day <= googleRange.end &&
          row.detail_limited,
      ),
      comparison:
        completeGoogle &&
        datesDescending(googlePrevious.start, googlePrevious.end).every((day) =>
          covered.has(day),
        )
          ? earlierGoogle
          : null,
      trend: datesDescending(googleRange.start, googleRange.end)
        .reverse()
        .map((day) => ({
          day,
          clicks: covered.has(day)
            ? Number(
                dailyGoogle.rows.find((row) => row.day === day)?.clicks ?? 0,
              )
            : null,
          impressions: covered.has(day)
            ? Number(
                dailyGoogle.rows.find((row) => row.day === day)?.impressions ??
                  0,
              )
            : null,
        })),
    },
  };
}
export type ReportingOverview = Awaited<
  ReturnType<typeof getReportingOverview>
>;

export const reportTables = [
  "sources",
  "website-pages",
  "queries",
  "google-pages",
] as const;
export type ReportTable = (typeof reportTables)[number];
export type TableRow = {
  label: string;
  primary: number;
  secondary: number;
  position: number | null;
};
export type TableOptions = {
  table: ReportTable;
  search?: string;
  sort?: string;
  direction?: string;
  page?: number;
  size?: number;
};
export async function getReportTable(
  context: DashboardContext,
  selection: ReportSelection,
  options: TableOptions,
) {
  const site = await requireReportingSite(context),
    pool = getDatabasePool();
  const isGoogle =
    options.table === "queries" || options.table === "google-pages";
  const latest = isGoogle
    ? await pool.query(
        `SELECT max(metric_date)::text AS day FROM search_console_coverage WHERE workspace_id = $1 AND site_id = $2`,
        [context.workspace.id, site.id],
      )
    : null;
  const range = resolveReportRange(
    selection,
    isGoogle
      ? (latest?.rows[0].day ?? shiftDate(reportToday(), -3))
      : undefined,
  );
  const size = Math.max(1, Math.min(1000, options.size ?? 10)),
    page = Math.max(1, Math.min(100000, options.page ?? 1));
  const sort = ["label", "primary", "secondary", "position"].includes(
    options.sort ?? "",
  )
    ? `"${options.sort}"`
    : '"primary"';
  const direction = options.direction === "asc" ? "ASC" : "DESC";
  let query: string;
  if (isGoogle)
    query = `SELECT dimension_value AS label, sum(clicks)::float AS "primary", sum(impressions)::float AS secondary,
    coalesce(sum(position * impressions) / nullif(sum(impressions),0),0)::float AS position
    FROM search_console_metrics WHERE workspace_id = $1 AND site_id = $2 AND metric_date BETWEEN $3::date AND $4::date
    AND dimension_type = '${options.table === "queries" ? "query" : "page"}' GROUP BY dimension_value`;
  else if (options.table === "website-pages")
    query = `SELECT path AS label, count(*)::float AS "primary", count(DISTINCT session_id)::float AS secondary,
    NULL::float AS position FROM analytics_events WHERE workspace_id = $1 AND site_id = $2 AND ${timeBounds} AND event_name = 'page_view' GROUP BY path`;
  else
    query = `SELECT coalesce(nullif(utm_source,''), nullif(referrer_host,''), 'Direct / none') AS label,
    count(DISTINCT session_id) FILTER (WHERE event_name = 'page_view')::float AS "primary",
    count(DISTINCT session_id) FILTER (WHERE event_name = 'form_success' AND verification = 'server')::float AS secondary,
    NULL::float AS position FROM analytics_events WHERE workspace_id = $1 AND site_id = $2 AND ${timeBounds} GROUP BY label`;
  const result = await pool.query<TableRow & { total: string }>(
    `WITH report AS (${query})
    SELECT *, count(*) OVER()::text AS total FROM report WHERE position(lower($5) in lower(label)) > 0
    ORDER BY ${sort} ${direction} NULLS LAST, label ASC LIMIT $6 OFFSET $7`,
    [
      context.workspace.id,
      site.id,
      range.start,
      range.end,
      (options.search ?? "").slice(0, 300),
      size,
      (page - 1) * size,
    ],
  );
  return {
    range,
    page,
    size,
    total: Number(result.rows[0]?.total ?? 0),
    rows: result.rows.map(({ total: _total, ...row }) => row),
  };
}
