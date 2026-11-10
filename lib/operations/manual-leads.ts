import "server-only";
import { randomUUID } from "node:crypto";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeSales, SalesAccessError } from "@/lib/sales/data";
import { createLeadSchema } from "./validation";

export async function createManualLead(context: DashboardContext, input: unknown) {
  const data = createLeadSchema.parse(input);
  await authorizeSales(context, true);
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`agency-sales:${context.workspace.id}`]);
    const access = await client.query(
      `SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id
       WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active'
         AND m.role IN ('owner','admin','member') AND w.status='active'
       FOR SHARE OF m,w`,
      [context.workspace.id, context.user.id],
    );
    if (!access.rowCount) throw new SalesAccessError("Your workspace access no longer allows changes.");

    // A form retry reopens the same record. Scope the key to the actual actor and
    // workspace; never let a caller-supplied ID retrieve another team's lead.
    const submissionId = `manual:${context.workspace.id}:${context.user.id}:${data.submissionId}`;
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM leads WHERE workspace_id=$1 AND source='manual' AND submission_id=$2",
      [context.workspace.id, submissionId],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { leadId: existing.rows[0].id };
    }

    const leadId = randomUUID();
    await client.query(
      `INSERT INTO leads(id,workspace_id,submission_id,source,status,name,organization,email,phone,
        website_url,interest,description,owner_user_id,delivery_status)
       VALUES($1,$2,$3,'manual','new',$4,$5,$6,$7,$8,$9,$10,$11,'not_configured')`,
      [leadId, context.workspace.id, submissionId, data.name ?? "Business contact", data.organization ?? "",
        data.email ?? null, data.phone ?? null, data.websiteUrl ?? null,
        data.interest ?? null, data.description ?? null, context.user.id],
    );
    await insertAuditLog(client, {
      workspaceId: context.workspace.id, actorUserId: context.user.id,
      action: "lead.created", targetType: "lead", targetId: leadId,
      metadata: { source: "manual" },
    });
    await client.query("COMMIT");
    return { leadId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
