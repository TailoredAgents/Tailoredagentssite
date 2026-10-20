import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { PRODUCTION_SITE_ID } from "@/lib/dashboard/site-access";
import { getDatabasePool } from "@/lib/dashboard/db";
import { datesDescending, reportToday, shiftDate } from "@/lib/reporting/dates";
import { decryptCredential, encryptCredential } from "./crypto";
import {
  SEARCH_CONSOLE_PROVIDER,
  resolveSearchConsoleConfiguration,
} from "./config";
import {
  GoogleApiError,
  queryCompleteDay,
  refreshGoogleAccessToken,
  type SearchAnalyticsRow,
} from "./google";

export type SearchConsoleSyncTrigger = "oauth" | "manual" | "scheduled";
export type SyncResult = {
  status:
    | "queued"
    | "succeeded"
    | "failed"
    | "skipped"
    | "retry_wait"
    | "cancelled";
  rowsWritten: number;
  id?: string;
  errorCode?: string;
};
type Connection = {
  id: string;
  workspace_id: string;
  site_id: string;
  connection_version: string;
  property_uri: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string;
  token_expires_at: Date | null;
  history_start: string | null;
};
type ClaimedRun = Connection & {
  run_id: string;
  dates: string[];
  attempt_count: number;
  lease_token: string;
};
type Metric = {
  type: "property" | "query" | "page";
  value: string;
  clicks: number;
  impressions: number;
  position: number;
};
const RECONNECT_ERRORS = [
  "reconnect_required",
  "permission_required",
  "matching_property_not_found",
];

export function plannedDates(
  historyStart: string | null,
  coverage: Set<string>,
  now = new Date(),
) {
  const end = shiftDate(reportToday(now), -3);
  const requestedStart = historyStart ?? shiftDate(end, -89);
  const earliest = new Date(`${reportToday(now)}T12:00:00Z`);
  const dayOfMonth = earliest.getUTCDate();
  earliest.setUTCDate(1);
  earliest.setUTCMonth(earliest.getUTCMonth() - 16);
  const lastDay = new Date(
    Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth() + 1, 0),
  ).getUTCDate();
  earliest.setUTCDate(Math.min(dayOfMonth, lastDay));
  const floor = earliest.toISOString().slice(0, 10);
  const start = requestedStart < floor ? floor : requestedStart;
  const refreshStart = shiftDate(end, -9);
  return {
    dates: datesDescending(start, end).filter(
      (day) => day >= refreshStart || !coverage.has(day),
    ),
    historyLimited: requestedStart < floor,
  };
}

export async function syncSearchConsoleConnection(
  integrationId: string,
  trigger: SearchConsoleSyncTrigger,
): Promise<SyncResult> {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<
      Connection & { last_error: string | null }
    >(
      `SELECT *, history_start::text AS history_start FROM integration_connections
       WHERE id = $1 AND provider = $2 AND status IN ('active','error')
         AND property_uri IS NOT NULL AND refresh_token_encrypted IS NOT NULL FOR UPDATE`,
      [integrationId, SEARCH_CONSOLE_PROVIDER],
    );
    const connection = found.rows[0];
    if (!connection || RECONNECT_ERRORS.includes(connection.last_error ?? "")) {
      await client.query("COMMIT");
      return { status: "skipped", rowsWritten: 0 };
    }
    const pending = await client.query<{ id: string }>(
      `SELECT id FROM integration_sync_runs WHERE integration_id=$1 AND status IN ('queued','running','retry_wait')`,
      [integrationId],
    );
    if (pending.rows[0]) {
      await client.query("COMMIT");
      return { status: "queued", id: pending.rows[0].id, rowsWritten: 0 };
    }
    const coverage = await client.query<{ day: string }>(
      "SELECT metric_date::text AS day FROM search_console_coverage WHERE integration_id=$1",
      [integrationId],
    );
    const plan = plannedDates(
      connection.history_start,
      new Set(coverage.rows.map((row) => row.day)),
    );
    if (!plan.dates.length) {
      await client.query("COMMIT");
      return { status: "skipped", rowsWritten: 0 };
    }
    const id = randomUUID();
    await client.query(
      `INSERT INTO integration_sync_runs
       (id,workspace_id,integration_id,provider,trigger,status,connection_version,pending_dates,total_days,range_start,range_end,history_limited)
       VALUES ($1,$2,$3,$4,$5,'queued',$6,$7::date[],$8,$9::date,$10::date,$11)`,
      [
        id,
        connection.workspace_id,
        integrationId,
        SEARCH_CONSOLE_PROVIDER,
        trigger,
        connection.connection_version,
        plan.dates,
        plan.dates.length,
        plan.dates.at(-1),
        plan.dates[0],
        plan.historyLimited,
      ],
    );
    await client.query(
      "UPDATE integration_connections SET last_synced_at=now(), history_start=coalesce(history_start,$2::date), last_daily_request=(now() AT TIME ZONE 'UTC')::date WHERE id=$1",
      [integrationId, plan.dates.at(-1)],
    );
    await client.query("COMMIT");
    return { status: "queued", id, rowsWritten: 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function syncWorkspaceSearchConsole(
  workspaceId: string,
  trigger: SearchConsoleSyncTrigger,
): Promise<SyncResult> {
  const found = await getDatabasePool().query<{ id: string }>(
    "SELECT id FROM integration_connections WHERE workspace_id=$1 AND provider=$2 AND site_id=$3",
    [workspaceId, SEARCH_CONSOLE_PROVIDER, PRODUCTION_SITE_ID],
  );
  return found.rows[0]
    ? syncSearchConsoleConnection(found.rows[0].id, trigger)
    : { status: "skipped", rowsWritten: 0 };
}

async function claimRun(): Promise<ClaimedRun | null> {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<ClaimedRun>(
      `SELECT c.*, c.history_start::text AS history_start, r.id AS run_id, r.pending_dates::text[] AS dates, r.attempt_count
       FROM integration_sync_runs r JOIN integration_connections c ON c.id=r.integration_id
       WHERE r.status IN ('queued','retry_wait','running') AND r.next_attempt_at<=now()
         AND (r.lease_expires_at IS NULL OR r.lease_expires_at<now())
         AND c.connection_version=r.connection_version AND c.status IN ('active','error')
         AND c.refresh_token_encrypted IS NOT NULL AND cardinality(r.pending_dates)>0
       ORDER BY r.started_at LIMIT 1 FOR UPDATE OF r,c SKIP LOCKED`,
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    row.lease_token = randomUUID();
    await client.query(
      "UPDATE integration_sync_runs SET status='running', lease_token=$2, lease_expires_at=now()+interval '90 seconds' WHERE id=$1",
      [row.run_id, row.lease_token],
    );
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function accessToken(connection: Connection) {
  const dashboard = resolveDashboardConfiguration();
  if (
    connection.access_token_encrypted &&
    connection.token_expires_at &&
    connection.token_expires_at.getTime() > Date.now() + 60_000
  )
    return decryptCredential(
      connection.access_token_encrypted,
      dashboard.authSecret,
    );
  const configuration = resolveSearchConsoleConfiguration();
  if (!configuration.configured)
    throw new GoogleApiError(
      "Connection configuration is unavailable.",
      "configuration_required",
      400,
    );
  const refreshed = await refreshGoogleAccessToken({
    refreshToken: decryptCredential(
      connection.refresh_token_encrypted,
      dashboard.authSecret,
    ),
    clientId: configuration.clientId,
    clientSecret: configuration.clientSecret,
  });
  const result = await getDatabasePool().query(
    `UPDATE integration_connections SET access_token_encrypted=$1, token_expires_at=now()+make_interval(secs=>$2), updated_at=now()
     WHERE id=$3 AND connection_version=$4 AND status IN ('active','error') AND refresh_token_encrypted IS NOT NULL`,
    [
      encryptCredential(refreshed.accessToken, dashboard.authSecret),
      refreshed.expiresIn,
      connection.id,
      connection.connection_version,
    ],
  );
  if (!result.rowCount) throw new Error("connection_changed");
  return refreshed.accessToken;
}

function metricsForDay(
  rows: SearchAnalyticsRow[],
  type: Metric["type"],
  day: string,
): Metric[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const value = type === "property" ? "" : row.keys[1];
    if (
      row.keys[0] !== day ||
      value === undefined ||
      (type !== "property" && !value) ||
      seen.has(value)
    )
      throw new GoogleApiError("Invalid daily rows.", "invalid_report", 502);
    seen.add(value);
    return {
      type,
      value,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    };
  });
}

async function writeDay(
  client: PoolClient,
  run: ClaimedRun,
  day: string,
  metrics: Metric[],
  limited: boolean,
) {
  await client.query(
    "DELETE FROM search_console_metrics WHERE workspace_id=$1 AND site_id=$2 AND metric_date=$3::date",
    [run.workspace_id, run.site_id, day],
  );
  for (let start = 0; start < metrics.length; start += 400) {
    const values: unknown[] = [];
    const rows = metrics.slice(start, start + 400).map((metric, index) => {
      const n = index * 10;
      values.push(
        randomUUID(),
        run.workspace_id,
        run.site_id,
        run.id,
        day,
        metric.type,
        metric.value,
        metric.clicks,
        metric.impressions,
        metric.position,
      );
      return `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5}::date,$${n + 6},$${n + 7},$${n + 8},$${n + 9},CASE WHEN $${n + 9}::double precision>0 THEN $${n + 8}::double precision/$${n + 9} ELSE 0 END,$${n + 10},$${n + 5}::date+interval '18 months')`;
    });
    await client.query(
      `INSERT INTO search_console_metrics (id,workspace_id,site_id,integration_id,metric_date,dimension_type,dimension_value,clicks,impressions,ctr,position,retained_until) VALUES ${rows.join(",")}`,
      values,
    );
  }
  await client.query(
    `INSERT INTO search_console_coverage (integration_id,workspace_id,site_id,metric_date,detail_limited,retained_until)
    VALUES ($1,$2,$3,$4::date,$5,$4::date+interval '18 months') ON CONFLICT (integration_id,metric_date)
    DO UPDATE SET checked_at=now(), detail_limited=EXCLUDED.detail_limited`,
    [run.id, run.workspace_id, run.site_id, day, limited],
  );
}

export function classifySyncError(error: unknown) {
  if (error instanceof GoogleApiError) {
    if (error.code === "invalid_grant" || error.status === 401)
      return { code: "reconnect_required", retry: false, delay: 0 };
    if (
      error.status === 429 ||
      error.code === "RESOURCE_EXHAUSTED" ||
      /quota|rate.?limit/i.test(error.message)
    )
      return {
        code: "google_rate_limit",
        retry: true,
        delay: Math.max(900, error.retryAfterSeconds),
      };
    if (error.status === 403)
      return { code: "permission_required", retry: false, delay: 0 };
    if (error.status >= 500)
      return { code: "google_unavailable", retry: true, delay: 60 };
    return { code: "configuration_required", retry: false, delay: 0 };
  }
  return {
    code:
      error instanceof Error && error.message === "connection_changed"
        ? "connection_changed"
        : "update_interrupted",
    retry: true,
    delay: 60,
  };
}

export async function processSearchConsoleDay(): Promise<SyncResult> {
  const run = await claimRun();
  if (!run) return { status: "skipped", rowsWritten: 0 };
  const day = run.dates[0];
  try {
    const token = await accessToken(run);
    const signal = AbortSignal.timeout(55_000);
    const input = {
      accessToken: token,
      propertyUri: run.property_uri,
      startDate: day,
      endDate: day,
      signal,
    };
    const [property, query, page] = await Promise.all([
      queryCompleteDay(input),
      queryCompleteDay({ ...input, dimension: "query" }),
      queryCompleteDay({ ...input, dimension: "page" }),
    ]);
    const metrics = [
      ...metricsForDay(property.rows, "property", day),
      ...metricsForDay(query.rows, "query", day),
      ...metricsForDay(page.rows, "page", day),
    ];
    const client = await getDatabasePool().connect();
    try {
      await client.query("BEGIN");
      const valid = await client.query(
        `SELECT c.id FROM integration_connections c JOIN integration_sync_runs r ON r.integration_id=c.id
        WHERE r.id=$1 AND r.lease_token=$2 AND r.status='running' AND r.lease_expires_at>now()
          AND c.connection_version=r.connection_version AND c.status IN ('active','error') AND c.refresh_token_encrypted IS NOT NULL
        FOR UPDATE OF c,r`,
        [run.run_id, run.lease_token],
      );
      if (!valid.rowCount) {
        await client.query("ROLLBACK");
        return { status: "cancelled", rowsWritten: 0, id: run.run_id };
      }
      await writeDay(client, run, day, metrics, query.limited || page.limited);
      await client.query(
        `UPDATE integration_sync_runs SET pending_dates=array_remove(pending_dates,$3::date),completed_days=completed_days+1,
        rows_written=rows_written+$4,attempt_count=0,error_code=NULL,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=now(),
        status=CASE WHEN cardinality(pending_dates)=1 THEN 'succeeded' ELSE 'queued' END,
        finished_at=CASE WHEN cardinality(pending_dates)=1 THEN now() ELSE NULL END WHERE id=$1 AND lease_token=$2`,
        [run.run_id, run.lease_token, day, metrics.length],
      );
      await client.query(
        `UPDATE integration_connections SET status='active',last_error=NULL,updated_at=now(),
        last_successful_sync_at=CASE WHEN $3::boolean THEN now() ELSE last_successful_sync_at END WHERE id=$1 AND connection_version=$2`,
        [run.id, run.connection_version, run.dates.length === 1],
      );
      await client.query("COMMIT");
      return {
        status: run.dates.length === 1 ? "succeeded" : "queued",
        rowsWritten: metrics.length,
        id: run.run_id,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const failure = classifySyncError(error);
    const retry = failure.retry && run.attempt_count < 3;
    const client = await getDatabasePool().connect();
    try {
      await client.query("BEGIN");
      const valid = await client.query(
        `SELECT c.id FROM integration_connections c JOIN integration_sync_runs r ON r.integration_id=c.id
        WHERE r.id=$1 AND r.lease_token=$2 AND c.connection_version=r.connection_version AND c.status<>'disconnected' FOR UPDATE OF c,r`,
        [run.run_id, run.lease_token],
      );
      if (valid.rowCount) {
        await client.query(
          `UPDATE integration_sync_runs SET status=$3,error_code=$4,attempt_count=attempt_count+1,
          next_attempt_at=now()+make_interval(secs=>$5),lease_token=NULL,lease_expires_at=NULL,
          finished_at=CASE WHEN $3='failed' THEN now() ELSE NULL END WHERE id=$1 AND lease_token=$2`,
          [
            run.run_id,
            run.lease_token,
            retry ? "retry_wait" : "failed",
            failure.code,
            Math.max(failure.delay, [60, 300, 900][run.attempt_count] ?? 900),
          ],
        );
        await client.query(
          "UPDATE integration_connections SET status='error',last_error=$2,updated_at=now() WHERE id=$1 AND connection_version=$3",
          [run.id, failure.code, run.connection_version],
        );
      }
      await client.query("COMMIT");
      return {
        status: valid.rowCount
          ? retry
            ? "retry_wait"
            : "failed"
          : "cancelled",
        rowsWritten: 0,
        id: run.run_id,
        errorCode: failure.code,
      };
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  }
}

export async function syncAllSearchConsoleConnections() {
  const pool = getDatabasePool();
  await pool.query(
    "UPDATE reporting_maintenance SET last_started_at=now() WHERE name='worker'",
  );
  const due = await pool.query<{ id: string }>(
    `SELECT id FROM integration_connections WHERE provider=$1 AND status IN ('active','error')
    AND refresh_token_encrypted IS NOT NULL AND (last_error IS NULL OR last_error<>ALL($2::text[]))
    AND (last_daily_request IS NULL OR last_daily_request<(now() AT TIME ZONE 'UTC')::date)
    AND (now() AT TIME ZONE 'UTC')::time >= time '10:17'`,
    [SEARCH_CONSOLE_PROVIDER, RECONNECT_ERRORS],
  );
  for (const row of due.rows)
    await syncSearchConsoleConnection(row.id, "scheduled");
  const outcomes: SyncResult[] = [];
  const deadline = Date.now() + 45_000;
  do {
    const result = await processSearchConsoleDay();
    if (result.status === "skipped") break;
    outcomes.push(result);
  } while (Date.now() < deadline);
  await pool.query(
    "UPDATE reporting_maintenance SET last_succeeded_at=now() WHERE name='worker'",
  );
  return outcomes;
}
