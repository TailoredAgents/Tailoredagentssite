import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { encryptCredential } from "./crypto";
import {
  SEARCH_CONSOLE_PROVIDER,
  resolveSearchConsoleConfiguration,
} from "./config";
import type { GoogleTokens, SearchConsoleProperty } from "./google";

const OAUTH_STATE_MINUTES = 10;

function stateHash(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

async function productionSite(client: PoolClient, workspaceId: string) {
  const result = await client.query<{ id: string; url: string }>(
    `SELECT id, url
     FROM sites
     WHERE workspace_id = $1 AND environment = 'production' AND status = 'active'
     ORDER BY created_at ASC
     LIMIT 1`,
    [workspaceId],
  );
  return result.rows[0] ?? null;
}

export async function createSearchConsoleOAuthState(context: DashboardContext) {
  const state = randomBytes(32).toString("base64url");
  const pool = getDatabasePool();
  await pool.query("DELETE FROM integration_oauth_states WHERE expires_at <= now()");
  await pool.query(
    `INSERT INTO integration_oauth_states
      (state_hash, workspace_id, user_id, provider, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [stateHash(state), context.workspace.id, context.user.id, SEARCH_CONSOLE_PROVIDER, OAUTH_STATE_MINUTES],
  );
  return state;
}

export async function consumeSearchConsoleOAuthState(state: string, context: DashboardContext) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(state)) return false;
  const result = await getDatabasePool().query(
    `DELETE FROM integration_oauth_states
     WHERE state_hash = $1
       AND workspace_id = $2
       AND user_id = $3
       AND provider = $4
       AND expires_at > now()
     RETURNING state_hash`,
    [stateHash(state), context.workspace.id, context.user.id, SEARCH_CONSOLE_PROVIDER],
  );
  return Boolean(result.rowCount);
}

export async function getSearchConsoleTarget(context: DashboardContext) {
  const client = await getDatabasePool().connect();
  try {
    return await productionSite(client, context.workspace.id);
  } finally {
    client.release();
  }
}

export async function saveSearchConsoleConnection(input: {
  context: DashboardContext;
  targetSite: { id: string; url: string };
  tokens: GoogleTokens;
  selectedProperty: SearchConsoleProperty | null;
}) {
  const configuration = resolveDashboardConfiguration();
  const client = await getDatabasePool().connect();
  const integrationId = randomUUID();

  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string; refresh_token_encrypted: string | null }>(
      `SELECT id, refresh_token_encrypted
       FROM integration_connections
       WHERE workspace_id = $1 AND provider = $2
       FOR UPDATE`,
      [input.context.workspace.id, SEARCH_CONSOLE_PROVIDER],
    );
    const id = existing.rows[0]?.id ?? integrationId;
    const encryptedRefreshToken = input.tokens.refreshToken
      ? encryptCredential(input.tokens.refreshToken, configuration.authSecret)
      : existing.rows[0]?.refresh_token_encrypted ?? null;
    const status = input.selectedProperty && encryptedRefreshToken ? "active" : "error";
    const error = input.selectedProperty
      ? (encryptedRefreshToken ? null : "missing_refresh_token")
      : "matching_property_not_found";

    await client.query(
      `INSERT INTO integration_connections
        (id, workspace_id, site_id, provider, status, property_uri, property_permission,
         access_token_encrypted, refresh_token_encrypted,
         token_expires_at, granted_scopes, connected_by_user_id, last_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               now() + make_interval(secs => $10), $11, $12, $13)
       ON CONFLICT (workspace_id, provider)
       DO UPDATE SET
         site_id = EXCLUDED.site_id,
         status = EXCLUDED.status,
         property_uri = EXCLUDED.property_uri,
         property_permission = EXCLUDED.property_permission,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         granted_scopes = EXCLUDED.granted_scopes,
         connected_by_user_id = EXCLUDED.connected_by_user_id,
         last_error = EXCLUDED.last_error,
         updated_at = now()`,
      [
        id,
        input.context.workspace.id,
        input.targetSite.id,
        SEARCH_CONSOLE_PROVIDER,
        status,
        input.selectedProperty?.siteUrl ?? null,
        input.selectedProperty?.permissionLevel ?? null,
        encryptCredential(input.tokens.accessToken, configuration.authSecret),
        encryptedRefreshToken,
        input.tokens.expiresIn,
        input.tokens.scope,
        input.context.user.id,
        error,
      ],
    );
    await insertAuditLog(client, {
      workspaceId: input.context.workspace.id,
      actorUserId: input.context.user.id,
      action: "integration.search_console_connected",
      targetType: "integration_connection",
      targetId: id,
      metadata: {
        property: input.selectedProperty?.siteUrl ?? null,
        status,
      },
    });
    await client.query("COMMIT");
    return { id, status, error };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function disconnectSearchConsole(context: DashboardContext) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      `UPDATE integration_connections
       SET status = 'disconnected', access_token_encrypted = NULL,
           refresh_token_encrypted = NULL, token_expires_at = NULL,
           last_error = NULL, updated_at = now()
       WHERE workspace_id = $1 AND provider = $2
       RETURNING id`,
      [context.workspace.id, SEARCH_CONSOLE_PROVIDER],
    );
    const id = result.rows[0]?.id;
    if (id) {
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: "integration.search_console_disconnected",
        targetType: "integration_connection",
        targetId: id,
      });
    }
    await client.query("COMMIT");
    return Boolean(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getSearchConsoleConnection(context: DashboardContext) {
  const configuration = resolveSearchConsoleConfiguration();
  const result = await getDatabasePool().query<{
    id: string;
    status: "pending" | "active" | "error" | "disconnected";
    property_uri: string | null;
    property_permission: string | null;
    last_synced_at: Date | null;
    last_successful_sync_at: Date | null;
    last_error: string | null;
    updated_at: Date;
  }>(
    `SELECT id, status, property_uri, property_permission, last_synced_at,
            last_successful_sync_at, last_error, updated_at
     FROM integration_connections
     WHERE workspace_id = $1 AND provider = $2`,
    [context.workspace.id, SEARCH_CONSOLE_PROVIDER],
  );
  const row = result.rows[0];
  return {
    configured: configuration.configured,
    missing: configuration.missing,
    redirectUri: configuration.redirectUri,
    connection: row ? {
      id: row.id,
      status: row.status,
      propertyUri: row.property_uri,
      propertyPermission: row.property_permission,
      lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
      lastSuccessfulSyncAt: row.last_successful_sync_at?.toISOString() ?? null,
      lastError: row.last_error,
      updatedAt: row.updated_at.toISOString(),
    } : null,
  };
}
