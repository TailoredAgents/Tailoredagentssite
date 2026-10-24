import "server-only";
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
    // Clear derived memory before detaching the source's customer identity. Lock
    // recordings first so an in-flight capture cannot restore these takeaways.
    await db.query(`UPDATE voice_call_recordings r SET memory_captured_at=now()
      FROM voice_calls v,crm_conversation_sources s,crm_conversations c
      WHERE r.workspace_id=$2 AND v.id=r.call_id AND v.workspace_id=r.workspace_id
      AND s.voice_conversation_id=v.voice_conversation_id AND s.workspace_id=v.workspace_id
      AND c.id=s.conversation_id AND c.workspace_id=s.workspace_id AND c.lead_id=$1`, [leadId,context.workspace.id]);
    await db.query(`DELETE FROM crm_client_memory m USING crm_conversation_sources s,crm_conversations c
      WHERE m.workspace_id=$2 AND s.id=m.source_id AND s.workspace_id=m.workspace_id
      AND c.id=s.conversation_id AND c.workspace_id=s.workspace_id AND c.lead_id=$1`,[leadId,context.workspace.id]);
    // Detach composite foreign keys while preserving conversations and sales history.
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
