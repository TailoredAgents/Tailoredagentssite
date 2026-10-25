import "server-only";
import type { PoolClient } from "pg";
import { SalesAccessError } from "@/lib/sales/data";

/** Called inside the lead deletion transaction. Only explicit lead relationships
 * are destructive authority; sharing a company or phone number is not. */
export async function deleteLeadHistory(db: PoolClient, workspaceId: string, leadId: string) {
  const args = [workspaceId, leadId];
  // Legacy links may not yet have been indexed by the unified Inbox.
  await db.query(`UPDATE crm_conversations c SET deleted_at=now(),remind_at=NULL,status='archived',owner_user_id=NULL
    WHERE c.workspace_id=$1 AND (c.lead_id=$2 OR EXISTS(SELECT 1 FROM crm_conversation_sources s
      LEFT JOIN sms_conversations sc ON sc.id=s.sms_conversation_id AND sc.workspace_id=s.workspace_id
      LEFT JOIN inbox_conversations ic ON ic.workspace_id=s.workspace_id AND ic.mailbox_id=s.mailbox_id AND ic.thread_id=s.thread_id
      WHERE s.workspace_id=c.workspace_id AND s.conversation_id=c.id AND (sc.lead_id=$2 OR ic.lead_id=$2)))`, args);
  const ids = (await db.query<{ id: string }>("SELECT id FROM crm_conversations WHERE workspace_id=$1 AND deleted_at IS NOT NULL AND (lead_id=$2 OR EXISTS(SELECT 1 FROM crm_conversation_sources s LEFT JOIN sms_conversations sc ON sc.id=s.sms_conversation_id LEFT JOIN inbox_conversations ic ON ic.workspace_id=s.workspace_id AND ic.mailbox_id=s.mailbox_id AND ic.thread_id=s.thread_id WHERE s.workspace_id=$1 AND s.conversation_id=crm_conversations.id AND (sc.lead_id=$2 OR ic.lead_id=$2)))", args)).rows.map(r => r.id);
  const scope = [workspaceId, ids];
  const active = await db.query(`SELECT 1 FROM voice_calls v JOIN crm_conversation_sources s ON s.voice_conversation_id=v.voice_conversation_id AND s.workspace_id=v.workspace_id
    WHERE s.workspace_id=$1 AND s.conversation_id=ANY($2::uuid[]) AND v.status IN ('reserved','initiated','ringing','in-progress','queued') LIMIT 1`, scope);
  if (active.rowCount) throw new SalesAccessError("End the active call before deleting this lead and its history.");
  await db.query(`UPDATE voice_call_recordings r SET expires_at=now(),transcript=NULL,summary=NULL,analysis_status='idle',analysis_lease=NULL,analysis_lease_until=NULL,analysis_error=NULL,memory_captured_at=now(),delete_after=now(),deletion_attempts=0,
    status=CASE WHEN r.recording_sid IS NOT NULL AND r.status<>'deleted' THEN 'deleting' ELSE r.status END
    FROM voice_calls v,crm_conversation_sources s WHERE r.workspace_id=$1 AND v.id=r.call_id AND v.workspace_id=r.workspace_id AND s.workspace_id=v.workspace_id AND s.voice_conversation_id=v.voice_conversation_id AND s.conversation_id=ANY($2::uuid[])`, scope);
  await db.query(`UPDATE voice_voicemails r SET expires_at=now(),status=CASE WHEN r.status='deleted' THEN 'deleted' ELSE 'deleting' END,delete_after=now(),deletion_attempts=0
    FROM voice_calls v,crm_conversation_sources s WHERE r.workspace_id=$1 AND v.id=r.call_id AND v.workspace_id=r.workspace_id AND s.workspace_id=v.workspace_id AND s.voice_conversation_id=v.voice_conversation_id AND s.conversation_id=ANY($2::uuid[])`, scope);
  for (const [table, column] of [["crm_client_memory", "source_id"], ["crm_tasks", "conversation_source_id"], ["crm_conversation_notes", "audience_source_id"], ["crm_conversation_reads", "source_id"]]) {
    await db.query(`DELETE FROM ${table} t USING crm_conversation_sources s WHERE t.workspace_id=$1 AND s.workspace_id=t.workspace_id AND s.id=t.${column} AND s.conversation_id=ANY($2::uuid[])`, scope);
  }
  await db.query(`UPDATE voice_conversations v SET deleted_at=now() FROM crm_conversation_sources s WHERE v.workspace_id=$1 AND s.workspace_id=v.workspace_id AND s.voice_conversation_id=v.id AND s.conversation_id=ANY($2::uuid[])`, scope);
  await db.query(`UPDATE sms_conversations c SET deleted_at=now(),owner_user_id=NULL WHERE c.workspace_id=$1 AND (c.lead_id=$3 OR EXISTS(SELECT 1 FROM crm_conversation_sources s WHERE s.workspace_id=c.workspace_id AND s.sms_conversation_id=c.id AND s.conversation_id=ANY($2::uuid[])))`, [...scope, leadId]);
  await db.query(`UPDATE inbox_conversations c SET deleted_at=now(),owner_user_id=NULL WHERE c.workspace_id=$1 AND (c.lead_id=$3 OR EXISTS(SELECT 1 FROM crm_conversation_sources s WHERE s.workspace_id=c.workspace_id AND s.mailbox_id=c.mailbox_id AND s.thread_id=c.thread_id AND s.conversation_id=ANY($2::uuid[])))`, [...scope, leadId]);
  // A Mail source can exist without a legacy metadata row. Retain a tombstone for both UIs.
  await db.query(`INSERT INTO inbox_conversations(id,workspace_id,mailbox_id,thread_id,deleted_at)
    SELECT gen_random_uuid(),workspace_id,mailbox_id,thread_id,now() FROM crm_conversation_sources WHERE workspace_id=$1 AND conversation_id=ANY($2::uuid[]) AND channel='email'
    ON CONFLICT(workspace_id,mailbox_id,thread_id) DO UPDATE SET deleted_at=now()`, scope);
  await db.query("UPDATE crm_conversation_sources SET deleted_at=now(),visible=false WHERE workspace_id=$1 AND conversation_id=ANY($2::uuid[])", scope);
  await db.query(`UPDATE sms_messages m SET body='',body_removed_at=now() FROM sms_conversations c WHERE m.workspace_id=$1 AND c.workspace_id=m.workspace_id AND c.id=m.conversation_id AND c.deleted_at IS NOT NULL`, [workspaceId]);
  for (const channel of ["sms", "inbox"]) {
    await db.query(`DELETE FROM ${channel}_notes n USING ${channel}_conversations c WHERE n.workspace_id=$1 AND c.workspace_id=n.workspace_id AND c.id=n.conversation_id AND c.deleted_at IS NOT NULL`, [workspaceId]);
    await db.query(`DELETE FROM ${channel}_drafts d WHERE d.workspace_id=$1 AND (d.thread_key=$2 OR EXISTS(SELECT 1 FROM ${channel}_conversations c WHERE c.workspace_id=d.workspace_id AND c.deleted_at IS NOT NULL AND ${channel === "sms" ? "c.id::text=d.thread_key AND c.number_id=d.number_id" : "c.thread_id=d.thread_key AND c.mailbox_id=d.mailbox_id"}))`, [workspaceId, `lead:${leadId}`]);
  }
  await db.query("UPDATE lead_sms_alerts SET status='cancelled',updated_at=now() WHERE workspace_id=$1 AND lead_id=$2 AND status='queued'", args);
}
