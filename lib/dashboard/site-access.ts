import "server-only";
import type { DashboardContext } from "./data";
import { getDatabasePool } from "./db";

export const PRODUCTION_SITE_ID = "00000000-0000-4000-8000-000000000002";
export class ReportingAccessError extends Error {
  constructor() {
    super("report_access_denied");
  }
}
export async function requireReportingSite(
  context: DashboardContext,
  manage = false,
) {
  const result = await getDatabasePool().query<{ id: string; url: string }>(
    `SELECT s.id, s.url FROM sites s
     JOIN workspace_memberships m ON m.workspace_id = s.workspace_id
     JOIN workspaces w ON w.id = s.workspace_id
     WHERE s.id = $1 AND s.workspace_id = $2 AND s.status = 'active' AND s.environment = 'production'
       AND m.user_id = $3 AND m.status = 'active' AND w.status = 'active'
       AND (NOT $4::boolean OR m.role IN ('owner', 'admin'))`,
    [PRODUCTION_SITE_ID, context.workspace.id, context.user.id, manage],
  );
  if (!result.rows[0]) throw new ReportingAccessError();
  return result.rows[0];
}
