import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { getDatabasePool } from "@/lib/dashboard/db";
import { decryptCredential, encryptCredential } from "./crypto";
import {
  SEARCH_CONSOLE_PROVIDER,
  resolveSearchConsoleConfiguration,
} from "./config";
import {
  GoogleApiError,
  querySearchAnalytics,
  refreshGoogleAccessToken,
  type SearchAnalyticsRow,
} from "./google";

export type SearchConsoleSyncTrigger = "oauth" | "manual" | "scheduled";

type ConnectionRow = {
  id: string;
  workspace_id: string;
  site_id: string;
  property_uri: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string;
  token_expires_at: Date | null;
  last_successful_sync_at: Date | null;
};

type Metric = {
  date: string;
  type: "property" | "query" | "page";
  value: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function syncRange(hasHistory: boolean) {
  const end = new Date();
  end.setUTCHours(12, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (hasHistory ? 9 : 89));
  return { startDate: dateString(start), endDate: dateString(end) };
}

function safeMetric(row: SearchAnalyticsRow, type: Metric["type"]): Metric | null {
  const date = row.keys[0];
  const value = type === "property" ? "" : row.keys[1]?.slice(0, 2048);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || value === undefined) return null;
  if (type !== "property" && !value) return null;
  if (![row.clicks, row.impressions, row.ctr, row.position].every(Number.isFinite)) return null;
  if (row.clicks < 0 || row.impressions < 0 || row.ctr < 0 || row.ctr > 1 || row.position < 0) return null;
  return {
    date,
    type,
    value,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}

function errorCode(error: unknown) {
  if (error instanceof GoogleApiError) return error.code.slice(0, 100);
  if (error instanceof Error && error.name === "TimeoutError") return "google_timeout";
  return "sync_failed";
}

async function accessToken(client: PoolClient, connection: ConnectionRow) {
  const dashboard = resolveDashboardConfiguration();
  if (
    connection.access_token_encrypted &&
    connection.token_expires_at &&
    connection.token_expires_at.getTime() > Date.now() + 60_000
  ) {
    return decryptCredential(connection.access_token_encrypted, dashboard.authSecret);
  }

  const google = resolveSearchConsoleConfiguration();
  if (!google.configured) throw new Error("search_console_not_configured");
  const refreshed = await refreshGoogleAccessToken({
    refreshToken: decryptCredential(connection.refresh_token_encrypted, dashboard.authSecret),
    clientId: google.clientId,
    clientSecret: google.clientSecret,
  });
  await client.query(
    `UPDATE integration_connections
     SET access_token_encrypted = $1,
         token_expires_at = now() + make_interval(secs => $2),
         granted_scopes = CASE WHEN cardinality($3::text[]) > 0 THEN $3 ELSE granted_scopes END,
         updated_at = now()
     WHERE id = $4`,
    [
      encryptCredential(refreshed.accessToken, dashboard.authSecret),
      refreshed.expiresIn,
      refreshed.scope,
      connection.id,
    ],
  );
  return refreshed.accessToken;
}

async function writeMetrics(
  client: PoolClient,
  connection: ConnectionRow,
  range: { startDate: string; endDate: string },
  metrics: Metric[],
) {
  await client.query(
    `DELETE FROM search_console_metrics
     WHERE workspace_id = $1 AND site_id = $2
       AND metric_date BETWEEN $3::date AND $4::date`,
    [connection.workspace_id, connection.site_id, range.startDate, range.endDate],
  );

  for (let index = 0; index < metrics.length; index += 400) {
    const chunk = metrics.slice(index, index + 400);
    const values: unknown[] = [];
    const rows = chunk.map((metric, rowIndex) => {
      const offset = rowIndex * 10;
      values.push(
        randomUUID(),
        connection.workspace_id,
        connection.site_id,
        connection.id,
        metric.date,
        metric.type,
        metric.value,
        metric.clicks,
        metric.impressions,
        metric.position,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::date,
               $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9},
               CASE WHEN $${offset + 9}::double precision > 0 THEN $${offset + 8}::double precision / $${offset + 9} ELSE 0 END,
               $${offset + 10}, $${offset + 5}::date + interval '18 months')`;
    });
    if (!rows.length) continue;
    await client.query(
      `INSERT INTO search_console_metrics
        (id, workspace_id, site_id, integration_id, metric_date, dimension_type,
         dimension_value, clicks, impressions, ctr, position, retained_until)
       VALUES ${rows.join(", ")}`,
      values,
    );
  }
}

export async function syncSearchConsoleConnection(
  integrationId: string,
  trigger: SearchConsoleSyncTrigger,
) {
  const pool = getDatabasePool();
  const client = await pool.connect();
  const runId = randomUUID();
  let lockAcquired = false;
  let range: { startDate: string; endDate: string } | null = null;

  try {
    const connectionResult = await client.query<ConnectionRow>(
      `SELECT id, workspace_id, site_id, property_uri, access_token_encrypted,
              refresh_token_encrypted, token_expires_at, last_successful_sync_at
       FROM integration_connections
       WHERE id = $1 AND provider = $2 AND status IN ('active', 'error')
         AND property_uri IS NOT NULL AND refresh_token_encrypted IS NOT NULL`,
      [integrationId, SEARCH_CONSOLE_PROVIDER],
    );
    const connection = connectionResult.rows[0];
    if (!connection) return { status: "skipped" as const, rowsWritten: 0 };

    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [`search-console:${connection.id}`],
    );
    lockAcquired = lock.rows[0]?.acquired ?? false;
    if (!lockAcquired) return { status: "skipped" as const, rowsWritten: 0 };

    range = syncRange(Boolean(connection.last_successful_sync_at));
    await client.query(
      `INSERT INTO integration_sync_runs
        (id, workspace_id, integration_id, provider, trigger, status, range_start, range_end)
       VALUES ($1, $2, $3, $4, $5, 'running', $6::date, $7::date)`,
      [runId, connection.workspace_id, connection.id, SEARCH_CONSOLE_PROVIDER, trigger, range.startDate, range.endDate],
    );
    await client.query(
      "UPDATE integration_connections SET last_synced_at = now(), updated_at = now() WHERE id = $1",
      [connection.id],
    );

    const token = await accessToken(client, connection);
    const [propertyRows, queryRows, pageRows] = await Promise.all([
      querySearchAnalytics({ accessToken: token, propertyUri: connection.property_uri, ...range }),
      querySearchAnalytics({ accessToken: token, propertyUri: connection.property_uri, dimension: "query", ...range }),
      querySearchAnalytics({ accessToken: token, propertyUri: connection.property_uri, dimension: "page", ...range }),
    ]);
    const metrics = [
      ...propertyRows.map((row) => safeMetric(row, "property")),
      ...queryRows.map((row) => safeMetric(row, "query")),
      ...pageRows.map((row) => safeMetric(row, "page")),
    ].filter((metric): metric is Metric => Boolean(metric));

    await client.query("BEGIN");
    await writeMetrics(client, connection, range, metrics);
    await client.query(
      `UPDATE integration_connections
       SET status = 'active', last_successful_sync_at = now(), last_error = NULL, updated_at = now()
       WHERE id = $1`,
      [connection.id],
    );
    await client.query(
      `UPDATE integration_sync_runs
       SET status = 'succeeded', rows_written = $1, finished_at = now()
       WHERE id = $2`,
      [metrics.length, runId],
    );
    await client.query("COMMIT");
    return { status: "succeeded" as const, rowsWritten: metrics.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = errorCode(error);
    await client.query(
      `UPDATE integration_sync_runs
       SET status = 'failed', error_code = $1, finished_at = now()
       WHERE id = $2`,
      [code, runId],
    ).catch(() => undefined);
    await client.query(
      `UPDATE integration_connections
       SET status = 'error', last_error = $1, updated_at = now()
       WHERE id = $2`,
      [code, integrationId],
    ).catch(() => undefined);
    return { status: "failed" as const, rowsWritten: 0, errorCode: code };
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [`search-console:${integrationId}`]).catch(() => undefined);
    }
    client.release();
  }
}

export async function syncWorkspaceSearchConsole(workspaceId: string, trigger: SearchConsoleSyncTrigger) {
  const result = await getDatabasePool().query<{ id: string }>(
    `SELECT id FROM integration_connections
     WHERE workspace_id = $1 AND provider = $2 AND status IN ('active', 'error')
       AND property_uri IS NOT NULL AND refresh_token_encrypted IS NOT NULL`,
    [workspaceId, SEARCH_CONSOLE_PROVIDER],
  );
  if (!result.rows[0]) return { status: "skipped" as const, rowsWritten: 0 };
  return syncSearchConsoleConnection(result.rows[0].id, trigger);
}

export async function syncAllSearchConsoleConnections() {
  const result = await getDatabasePool().query<{ id: string }>(
    `SELECT id FROM integration_connections
     WHERE provider = $1 AND status IN ('active', 'error')
       AND property_uri IS NOT NULL AND refresh_token_encrypted IS NOT NULL`,
    [SEARCH_CONSOLE_PROVIDER],
  );
  const outcomes = [];
  for (const row of result.rows) {
    outcomes.push(await syncSearchConsoleConnection(row.id, "scheduled"));
  }
  return outcomes;
}
