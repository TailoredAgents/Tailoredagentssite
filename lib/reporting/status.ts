import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { requireReportingSite } from "@/lib/dashboard/site-access";
import { getDatabasePool } from "@/lib/dashboard/db";
import { getSearchConsoleConnection } from "@/lib/search-console/connection";

const safeErrors = new Set([
  "reconnect_required",
  "permission_required",
  "matching_property_not_found",
  "google_rate_limit",
  "google_unavailable",
  "configuration_required",
  "update_interrupted",
  "upgrade_interrupted",
]);
export function safeError(value: string | null) {
  return value ? (safeErrors.has(value) ? value : "update_interrupted") : null;
}
export async function getReportingStatus(context: DashboardContext) {
  const site = await requireReportingSite(context);
  const state = await getSearchConsoleConnection(context);
  const pool = getDatabasePool();
  const [runs, coverage, maintenance, attribution] = await Promise.all([
    pool.query(
      `SELECT r.id, r.status, r.trigger, r.total_days, r.completed_days, r.error_code, r.history_limited,
      r.started_at, r.finished_at, r.next_attempt_at FROM integration_sync_runs r
      JOIN integration_connections c ON c.id = r.integration_id
      WHERE r.workspace_id = $1 AND c.site_id = $2 ORDER BY r.started_at DESC LIMIT 8`,
      [context.workspace.id, site.id],
    ),
    pool.query(
      `SELECT min(metric_date)::text AS first, max(metric_date)::text AS latest, count(*)::int AS days
      FROM search_console_coverage WHERE workspace_id = $1 AND site_id = $2`,
      [context.workspace.id, site.id],
    ),
    pool.query("SELECT name, last_succeeded_at FROM reporting_maintenance"),
    pool.query(
      `SELECT count(*)::int AS pending FROM leads WHERE workspace_id = $1 AND measurement_status = 'pending'`,
      [context.workspace.id],
    ),
  ]);
  const worker = maintenance.rows.find((row) => row.name === "worker")
    ?.last_succeeded_at as Date | null;
  const retention = maintenance.rows.find((row) => row.name === "retention")
    ?.last_succeeded_at as Date | null;
  return {
    configured: state.configured,
    missing: state.missing,
    redirectUri: state.redirectUri,
    canManage: context.role === "owner" || context.role === "admin",
    connection: state.connection
      ? {
          ...state.connection,
          lastError: safeError(state.connection.lastError),
        }
      : null,
    coverage: coverage.rows[0],
    worker: {
      lastCheck: worker?.toISOString() ?? null,
      stale: !worker || Date.now() - worker.getTime() > 20 * 60_000,
    },
    retention: {
      lastCheck: retention?.toISOString() ?? null,
      stale: !retention || Date.now() - retention.getTime() > 48 * 3600_000,
    },
    pendingAttribution: Number(attribution.rows[0].pending),
    runs: runs.rows.map((row) => ({
      id: row.id as string,
      status: row.status as string,
      trigger: row.trigger as string,
      total: Number(row.total_days),
      completed: Number(row.completed_days),
      error: safeError(row.error_code),
      historyLimited: Boolean(row.history_limited),
      startedAt: (row.started_at as Date).toISOString(),
      finishedAt: (row.finished_at as Date | null)?.toISOString() ?? null,
      nextAttemptAt: (row.next_attempt_at as Date).toISOString(),
    })),
  };
}
export type ReportingStatus = Awaited<ReturnType<typeof getReportingStatus>>;
