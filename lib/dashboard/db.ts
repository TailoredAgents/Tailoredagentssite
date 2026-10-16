import "server-only";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { resolveDashboardConfiguration } from "./config";

const INTERNAL_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

type GlobalDatabase = typeof globalThis & {
  tailoredAgentsDatabasePool?: Pool;
};

export function getDatabasePool() {
  const configuration = resolveDashboardConfiguration();
  if (!configuration.databaseUrl) {
    throw new Error("DATABASE_URL is required for dashboard data access.");
  }

  const globalDatabase = globalThis as GlobalDatabase;
  if (!globalDatabase.tailoredAgentsDatabasePool) {
    globalDatabase.tailoredAgentsDatabasePool = new Pool({
      connectionString: configuration.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      application_name: "tailored-agents-web",
    });
  }

  return globalDatabase.tailoredAgentsDatabasePool;
}

export async function insertAuditLog(
  client: PoolClient,
  input: {
    workspaceId: string;
    actorUserId?: string | null;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO audit_logs
      (id, workspace_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      randomUUID(),
      input.workspaceId,
      input.actorUserId ?? null,
      input.action,
      input.targetType,
      input.targetId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function provisionInternalMembership(user: { id: string }) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [5_617_015_127]);

    const existingMembership = await client.query<{ id: string }>(
      `SELECT id
       FROM workspace_memberships
       WHERE workspace_id = $1 AND user_id = $2`,
      [INTERNAL_WORKSPACE_ID, user.id],
    );

    if (existingMembership.rowCount) {
      await client.query("COMMIT");
      return;
    }

    const membershipCount = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM workspace_memberships
       WHERE workspace_id = $1 AND status = 'active'`,
      [INTERNAL_WORKSPACE_ID],
    );
    const role = Number(membershipCount.rows[0]?.count ?? 0) === 0 ? "owner" : "admin";
    const membershipId = randomUUID();

    await client.query(
      `INSERT INTO workspace_memberships
        (id, workspace_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [membershipId, INTERNAL_WORKSPACE_ID, user.id, role],
    );
    await insertAuditLog(client, {
      workspaceId: INTERNAL_WORKSPACE_ID,
      actorUserId: user.id,
      action: "membership.provisioned",
      targetType: "workspace_membership",
      targetId: membershipId,
      metadata: { role },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
