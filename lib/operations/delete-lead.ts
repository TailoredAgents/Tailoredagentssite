import "server-only";
import { deleteLeadHistory } from "./delete-lead-history";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeSales, SalesAccessError } from "@/lib/sales/data";
import { deleteLeadSchema } from "./validation";

export async function deleteLead(context: DashboardContext, input: unknown) {
  const { leadId } = deleteLeadSchema.parse(input);
  await authorizeSales(context, true);
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`unified-work:${context.workspace.id}`]);
    // Serialize with conversion so operating records cannot be lost mid-conversion.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`agency-sales:${context.workspace.id}`]);
    const access = await db.query(
      `SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id
       WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active'
         AND m.role IN ('owner','admin','member') AND w.status='active' FOR SHARE OF m,w`,
      [context.workspace.id, context.user.id],
    );
    if (!access.rowCount) throw new SalesAccessError("Your workspace access no longer allows changes.");
    const lead = await db.query("SELECT id FROM leads WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [leadId, context.workspace.id]);
    if (!lead.rowCount) {
      await db.query("COMMIT");
      return false;
    }
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`agency-sms:${context.workspace.id}`]);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`agency-inbox:${context.workspace.id}`]);
    const locks = await db.query<{key:string}>(`SELECT 'unified-sms:'||workspace_id||':'||id AS key FROM sms_numbers WHERE workspace_id=$1
      UNION SELECT 'unified-mail:'||workspace_id||':'||mailbox_id FROM inbox_conversations WHERE workspace_id=$1
      UNION SELECT 'unified-mail:'||workspace_id||':'||mailbox_id FROM crm_conversation_sources WHERE workspace_id=$1 AND mailbox_id IS NOT NULL ORDER BY key`, [context.workspace.id]);
    for (const row of locks.rows) await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [row.key]);
    await deleteLeadHistory(db, context.workspace.id, leadId);
    // Detach composite foreign keys while preserving converted customers and sales history.
    for (const table of ["inbox_conversations", "sms_conversations", "crm_conversations", "crm_opportunities"]) {
      await db.query(`UPDATE ${table} SET lead_id=NULL,updated_at=now() WHERE lead_id=$1 AND workspace_id=$2`, [leadId, context.workspace.id]);
    }
    // Client/project links use SET NULL; lead-only notes use CASCADE. Meta imported
    // receipts survive with a null link so a replay cannot resurrect the deleted lead.
    await db.query("DELETE FROM leads WHERE id=$1 AND workspace_id=$2", [leadId, context.workspace.id]);
    await insertAuditLog(db, { workspaceId: context.workspace.id, actorUserId: context.user.id, action: "lead.deleted", targetType: "lead", targetId: leadId });
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
