import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardAuth } from "./auth";
import { isAllowedDashboardEmail, resolveDashboardConfiguration } from "./config";
import { getDatabasePool } from "./db";
import { verifyMailDashboardSession } from "./mail-identity";

export type DashboardRole = "owner" | "admin" | "member" | "viewer";

export type DashboardContext = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  role: DashboardRole;
};

type MembershipRow = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  role: DashboardRole;
};

async function findActiveMembership(userId: string) {
  const pool = getDatabasePool();
  const result = await pool.query<MembershipRow>(
    `SELECT
       membership.workspace_id,
       workspace.name AS workspace_name,
       workspace.slug AS workspace_slug,
       membership.role
     FROM workspace_memberships membership
     INNER JOIN workspaces workspace ON workspace.id = membership.workspace_id
     WHERE membership.user_id = $1
       AND membership.status = 'active'
       AND workspace.status = 'active'
     ORDER BY membership.created_at ASC
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export const getOptionalDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const auth = getDashboardAuth();
  if (!auth) return null;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  if (resolveDashboardConfiguration().authMode === "mail") {
    if (!await verifyMailDashboardSession(session.session.id, session.user.id, session.user.email)) return null;
  } else if (!isAllowedDashboardEmail(session.user.email)) return null;

  const row = await findActiveMembership(session.user.id);
  if (!row) return null;

  return {
    user: {
      id: session.user.id,
      name: session.user.name || session.user.email.split("@")[0],
      email: session.user.email,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      slug: row.workspace_slug,
    },
    role: row.role,
  };
});

export async function requireDashboardContext() {
  const configuration = resolveDashboardConfiguration();
  if (!configuration.ready) redirect("/sign-in?status=setup");

  const context = await getOptionalDashboardContext();
  if (!context) redirect("/sign-in?status=unauthorized");
  return context;
}

type CountRow = { count: string };

export async function getDashboardOverview(context: DashboardContext) {
  const pool = getDatabasePool();
  const [leadCount, clientCount, projectCount, siteCount, activityCount, recentActivity, recentLeads, followUps, upcomingProjects] = await Promise.all([
    pool.query<CountRow>(
      "SELECT count(*)::text AS count FROM leads WHERE workspace_id = $1 AND status NOT IN ('won', 'lost', 'archived')",
      [context.workspace.id],
    ),
    pool.query<CountRow>(
      "SELECT count(*)::text AS count FROM clients WHERE workspace_id = $1 AND status <> 'archived'",
      [context.workspace.id],
    ),
    pool.query<CountRow>(
      "SELECT count(*)::text AS count FROM projects WHERE workspace_id = $1 AND status IN ('planned', 'active', 'on_hold')",
      [context.workspace.id],
    ),
    pool.query<CountRow>(
      "SELECT count(*)::text AS count FROM sites WHERE workspace_id = $1 AND status = 'active'",
      [context.workspace.id],
    ),
    pool.query<CountRow>(
      "SELECT count(*)::text AS count FROM audit_logs WHERE workspace_id = $1",
      [context.workspace.id],
    ),
    pool.query<{
      id: string;
      action: string;
      target_type: string;
      created_at: Date;
      actor_name: string | null;
    }>(
      `SELECT
         log.id,
         log.action,
         log.target_type,
         log.created_at,
         actor.name AS actor_name
       FROM audit_logs log
       LEFT JOIN "user" actor ON actor.id = log.actor_user_id
       WHERE log.workspace_id = $1
       ORDER BY log.created_at DESC
       LIMIT 6`,
      [context.workspace.id],
    ),
    pool.query<{ id: string; organization: string; name: string; phone: string | null; email: string | null; created_at: Date }>(
      `SELECT id,organization,name,phone,email,created_at FROM leads WHERE workspace_id=$1 AND status NOT IN ('won','lost','archived') ORDER BY created_at DESC LIMIT 5`, [context.workspace.id],
    ),
    pool.query<{ id: string; organization: string; name: string; phone: string | null; email: string | null; next_action: string | null; next_action_at: Date }>(
      `SELECT id,organization,name,phone,email,next_action,next_action_at FROM leads WHERE workspace_id=$1 AND status NOT IN ('won','lost','archived') AND next_action_at <= now()+interval '7 days' ORDER BY next_action_at ASC LIMIT 5`, [context.workspace.id],
    ),
    pool.query<{ id: string; name: string; due_at: Date }>(
      `SELECT id,name,due_at FROM projects WHERE workspace_id=$1 AND status IN ('planned','active','on_hold') AND due_at <= now()+interval '7 days' ORDER BY due_at ASC LIMIT 5`, [context.workspace.id],
    ),
  ]);

  return {
    counts: {
      leads: Number(leadCount.rows[0]?.count ?? 0),
      clients: Number(clientCount.rows[0]?.count ?? 0),
      projects: Number(projectCount.rows[0]?.count ?? 0),
      sites: Number(siteCount.rows[0]?.count ?? 0),
      activity: Number(activityCount.rows[0]?.count ?? 0),
    },
    activity: recentActivity.rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      actorName: row.actor_name || "System",
      createdAt: row.created_at.toISOString(),
    })),
    recentLeads: recentLeads.rows.map(row => ({ id: row.id, organization: row.organization, phone: row.phone, email: row.email, name: row.name, createdAt: row.created_at.toISOString() })),
    followUps: followUps.rows.map(row => ({ id: row.id, organization: row.organization, phone: row.phone, email: row.email, name: row.name, nextAction: row.next_action || "Follow up", dueAt: row.next_action_at.toISOString() })),
    upcomingProjects: upcomingProjects.rows.map(row => ({ id: row.id, name: row.name, dueAt: row.due_at.toISOString() })),
  };
}

export async function getDashboardActivity(context: DashboardContext) {
  const pool = getDatabasePool();
  const result = await pool.query<{
    id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    actor_name: string | null;
  }>(
    `SELECT
       log.id,
       log.action,
       log.target_type,
       log.target_id,
       log.metadata,
       log.created_at,
       actor.name AS actor_name
     FROM audit_logs log
     LEFT JOIN "user" actor ON actor.id = log.actor_user_id
     WHERE log.workspace_id = $1
     ORDER BY log.created_at DESC
     LIMIT 100`,
    [context.workspace.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata,
    actorName: row.actor_name || "System",
    createdAt: row.created_at.toISOString(),
  }));
}
