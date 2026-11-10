import 'server-only';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from './config';
type DB=Pick<PoolClient,'query'>;
// Parameters 1 and 2 are always the current workspace and employee.
export const knowledgeVisible=`k.workspace_id=$1 AND k.status='published' AND k.effective_on<=CURRENT_DATE AND (k.user_id=$2 OR k.audience='workspace' OR (k.audience='employees' AND $2=ANY(k.shared_with)))`;
export async function validateTurnKnowledgeAccess(c:DashboardContext,id:string){
 const denied=await getDatabasePool().query(`SELECT 1 FROM assistant_knowledge_uses u JOIN assistant_knowledge k ON k.id=u.knowledge_id WHERE u.turn_id=$3 AND (NOT(${knowledgeVisible}) OR u.revision<>k.revision) LIMIT 1`,[c.workspace.id,c.user.id,id]);
 if(denied.rowCount)throw new AssistantError('knowledge_changed','A knowledge source changed or was withdrawn. Start a new request using current guidance.',409);
}
export async function refreshKnowledgeRetention(db:DB){
 await db.query(`WITH RECURSIVE retained AS(SELECT d.id,d.source_ids FROM assistant_documents d JOIN assistant_knowledge k ON d.id=ANY(k.source_ids) WHERE k.status='published' UNION SELECT d.id,d.source_ids FROM assistant_documents d JOIN retained r ON d.id=ANY(r.source_ids)) UPDATE assistant_documents d SET retained_for_knowledge=EXISTS(SELECT 1 FROM retained r WHERE r.id=d.id) WHERE retained_for_knowledge IS DISTINCT FROM EXISTS(SELECT 1 FROM retained r WHERE r.id=d.id)`);
}
export async function invalidateKnowledge(db:DB,ids:string[]){
 if(!ids.length)return;
 await db.query(`UPDATE assistant_actions SET status='cancelled',error_code='knowledge_withdrawn',updated_at=now() WHERE status='awaiting_approval' AND id IN(SELECT t.waiting_action_id FROM assistant_chat_turns t JOIN assistant_knowledge_uses u ON u.turn_id=t.id WHERE u.knowledge_id=ANY($1::uuid[]))`,[ids]);
 await db.query(`UPDATE assistant_employee_notifications SET resolved_at=now() WHERE resolved_at IS NULL AND source_type='turn' AND source_id IN(SELECT turn_id FROM assistant_knowledge_uses WHERE knowledge_id=ANY($1::uuid[]))`,[ids]);
 await db.query(`UPDATE assistant_chat_turns SET status='interrupted',engine_state=NULL,finished_at=now(),assistant_message='Approved guidance changed or was withdrawn. Start a new request using current sources.' WHERE id IN(SELECT turn_id FROM assistant_knowledge_uses WHERE knowledge_id=ANY($1::uuid[])) AND status IN('queued','running','waiting','waiting_input','paused','blocked','outcome_unknown')`,[ids]);
 // Outputs carrying old guidance cannot be reused as if they were current. Physical deletion removes their copies, too.
 const affected=(await db.query(`WITH RECURSIVE results AS(SELECT id FROM assistant_documents WHERE knowledge_ids&&$1::uuid[] UNION SELECT d.id FROM assistant_documents d JOIN results r ON r.id=ANY(d.source_ids)) SELECT id FROM results`,[ids])).rows.map(r=>r.id);
 if(affected.length){
  await db.query(`UPDATE assistant_actions SET status='cancelled',error_code='source_withdrawn',updated_at=now() WHERE status='awaiting_approval' AND id IN(SELECT t.waiting_action_id FROM assistant_chat_turns t JOIN assistant_document_uses u ON u.turn_id=t.id WHERE u.document_id=ANY($1::uuid[]))`,[affected]);
  await db.query(`UPDATE assistant_employee_notifications SET resolved_at=now() WHERE resolved_at IS NULL AND source_type='turn' AND source_id IN(SELECT turn_id FROM assistant_document_uses WHERE document_id=ANY($1::uuid[]))`,[affected]);
  await db.query(`UPDATE assistant_chat_turns SET status='interrupted',engine_state=NULL,finished_at=now(),assistant_message='A result used withdrawn guidance. Start a new request with current sources.' WHERE id IN(SELECT turn_id FROM assistant_document_uses WHERE document_id=ANY($1::uuid[])) AND status IN('queued','running','waiting','waiting_input','paused','blocked','outcome_unknown')`,[affected]);
  await db.query('DELETE FROM assistant_document_chunks WHERE document_id=ANY($1::uuid[])',[affected]);
  await db.query("UPDATE assistant_documents SET status='deleted',deleted_at=now(),bytes_encrypted=NULL,name='Withdrawn knowledge result',revision=revision+1,lease_token=NULL,lease_until=NULL WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL",[affected]);
 }
}
export async function invalidateKnowledgeDocuments(db:DB,ids:string[],erase=false){
 const affected=(await db.query(`UPDATE assistant_knowledge SET status='archived',revision=revision+1,content=CASE WHEN $2 THEN '' ELSE content END,title=CASE WHEN $2 THEN 'Removed source' ELSE title END,provenance=CASE WHEN $2 THEN '' ELSE provenance END,source_refs=CASE WHEN $2 THEN '[]'::jsonb ELSE source_refs END,source_ids=CASE WHEN $2 THEN '{}'::uuid[] ELSE source_ids END WHERE source_ids&&$1::uuid[] AND (status='published' OR $2) RETURNING id`,[ids,erase])).rows.map(r=>r.id);
 await invalidateKnowledge(db,affected);await refreshKnowledgeRetention(db);
}
