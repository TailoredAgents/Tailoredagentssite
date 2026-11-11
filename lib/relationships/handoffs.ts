import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {authorizeSales,SalesAccessError} from '@/lib/sales/data';
import {handoffSchema,handoffTransitionSchema,type RelationshipTarget} from './contract';
import {relationshipAccess} from './service';

const columns={lead:'lead_id',business:'business_id',opportunity:'opportunity_id',client:'client_id',contact:'contact_id'} as const;
export type Handoff={id:string;kind:RelationshipTarget['kind'];target_id:string;relationship_name:string;created_by:string|null;recipient_user_id:string|null;sender:string|null;recipient:string|null;next_action:string;context:string;due_at:string;status:'pending'|'accepted'|'completed'|'cancelled';revision:number;created_at:string;updated_at:string};
const selection=`h.id,h.created_by,h.recipient_user_id,h.next_action,h.context,h.due_at,h.status,h.revision,h.created_at,h.updated_at,
 CASE WHEN h.lead_id IS NOT NULL THEN 'lead' WHEN h.business_id IS NOT NULL THEN 'business' WHEN h.opportunity_id IS NOT NULL THEN 'opportunity' WHEN h.client_id IS NOT NULL THEN 'client' ELSE 'contact' END kind,
 COALESCE(h.lead_id,h.business_id,h.opportunity_id,h.client_id,h.contact_id) target_id,s.name sender,r.name recipient,
 COALESCE((SELECT COALESCE(NULLIF(name,''),NULLIF(organization,''),email,phone,'Prospect') FROM leads WHERE id=h.lead_id AND workspace_id=h.workspace_id AND anonymized_at IS NULL),
 (SELECT name FROM crm_businesses WHERE id=h.business_id AND workspace_id=h.workspace_id AND anonymized_at IS NULL),
 (SELECT title FROM crm_opportunities WHERE id=h.opportunity_id AND workspace_id=h.workspace_id),
 (SELECT name FROM clients WHERE id=h.client_id AND workspace_id=h.workspace_id),
 (SELECT name FROM contacts WHERE id=h.contact_id AND workspace_id=h.workspace_id),'Relationship unavailable') relationship_name`;
const joins=`LEFT JOIN "user" s ON s.id=h.created_by LEFT JOIN "user" r ON r.id=h.recipient_user_id`;
function dto(row: Handoff):Handoff{return {...row,due_at:new Date(row.due_at).toISOString(),created_at:new Date(row.created_at).toISOString(),updated_at:new Date(row.updated_at).toISOString()};}
async function mutate<T>(c:DashboardContext,work:(db:PoolClient)=>Promise<T>){
 await authorizeSales(c,true);const db=await getDatabasePool().connect();
 try{await db.query('BEGIN');
  const grant=await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin','member') AND w.status='active' FOR SHARE OF m,w",[c.workspace.id,c.user.id]);
  if(!grant.rowCount)throw new SalesAccessError('Editing access is required.');
  const result=await work(db);await db.query('COMMIT');return result;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function requestHandoff(c:DashboardContext,input:unknown){
 const v=handoffSchema.parse(input);
 return mutate(c,async db=>{
  await relationshipAccess(c,v,db);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`relationship-handoff:${v.requestId}`]);
  const hash=createHash('sha256').update(JSON.stringify({...v,actor:c.user.id,workspace:c.workspace.id})).digest('hex');
  const previous=(await db.query('SELECT workspace_id,request_hash FROM crm_relationship_handoffs WHERE id=$1',[v.requestId])).rows[0];
  if(previous){if(previous.workspace_id!==c.workspace.id||previous.request_hash!==hash)throw new SalesAccessError('This request was already used. Refresh before creating a different handoff.');return {id:v.requestId,replayed:true};}
  const recipient=await db.query("SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin','member') FOR SHARE",[c.workspace.id,v.recipientUserId]);
  if(!recipient.rowCount)throw new SalesAccessError('Choose an active teammate with editing access.');
  await db.query(`INSERT INTO crm_relationship_handoffs(id,workspace_id,${columns[v.kind]},created_by,recipient_user_id,next_action,context,due_at,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[v.requestId,c.workspace.id,v.id,c.user.id,v.recipientUserId,v.nextAction,v.context,v.dueAt,hash]);
  await db.query("INSERT INTO crm_relationship_handoff_events(id,handoff_id,workspace_id,actor_user_id,status) VALUES($1,$2,$3,$4,'pending')",[randomUUID(),v.requestId,c.workspace.id,c.user.id]);
  await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'relationship.handoff_requested',targetType:v.kind,targetId:v.id,metadata:{handoffId:v.requestId}});
  return {id:v.requestId,replayed:false};
 });
}
export async function transitionHandoff(c:DashboardContext,input:unknown){
 const v=handoffTransitionSchema.parse(input);
 return mutate(c,async db=>{
  const h=(await db.query(`SELECT ${selection} FROM crm_relationship_handoffs h ${joins} WHERE h.workspace_id=$1 AND h.id=$2 FOR UPDATE OF h`,[c.workspace.id,v.handoffId])).rows[0] as Handoff|undefined;
  if(!h)throw new SalesAccessError('That handoff is unavailable.');
  await relationshipAccess(c,{kind:h.kind,id:h.target_id},db);
  if(h.revision!==v.revision)throw new SalesAccessError('This handoff changed. Refresh before continuing.');
  if(v.operation==='cancel'){
   const role=(await db.query('SELECT role FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2',[c.workspace.id,c.user.id])).rows[0]?.role;
   if(h.created_by!==c.user.id&&h.recipient_user_id!==c.user.id&&!['owner','admin'].includes(role))throw new SalesAccessError('Only the sender, recipient or an administrator can cancel this handoff.');
  }else if(h.recipient_user_id!==c.user.id)throw new SalesAccessError('Only the assigned teammate can accept or complete this handoff.');
  if((v.operation==='accept'&&h.status!=='pending')||(v.operation==='complete'&&h.status!=='accepted')||(['completed','cancelled'].includes(h.status)))throw new SalesAccessError('This handoff is not waiting for that action.');
  const status=v.operation==='accept'?'accepted':v.operation==='complete'?'completed':'cancelled';
  await db.query('UPDATE crm_relationship_handoffs SET status=$3,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,h.id,status]);
  await db.query('INSERT INTO crm_relationship_handoff_events(id,handoff_id,workspace_id,actor_user_id,status,note) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),h.id,c.workspace.id,c.user.id,status,v.note]);
  await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:`relationship.handoff_${status}`,targetType:h.kind,targetId:h.target_id,metadata:{handoffId:h.id}});
  return {id:h.id,status,revision:h.revision+1};
 });
}
export async function listHandoffs(c:DashboardContext,scope:'mine'|'team'='mine',related?:RelationshipTarget[]){
 await authorizeSales(c);
 const ids=related?.map(r=>r.id)??null;
 const result=await getDatabasePool().query<Handoff>(`SELECT ${selection} FROM crm_relationship_handoffs h ${joins} WHERE h.workspace_id=$1
 AND (h.lead_id IS NULL OR EXISTS(SELECT 1 FROM leads WHERE id=h.lead_id AND workspace_id=h.workspace_id AND anonymized_at IS NULL))
 AND (h.business_id IS NULL OR EXISTS(SELECT 1 FROM crm_businesses WHERE id=h.business_id AND workspace_id=h.workspace_id AND anonymized_at IS NULL))
 AND ($3::uuid[] IS NULL OR COALESCE(h.lead_id,h.business_id,h.opportunity_id,h.client_id,h.contact_id)=ANY($3::uuid[]))
 AND ($4 OR h.created_by=$2 OR h.recipient_user_id=$2)
 ORDER BY CASE WHEN h.status IN ('pending','accepted') THEN 0 ELSE 1 END,h.due_at,h.id LIMIT 100`,[c.workspace.id,c.user.id,ids,scope==='team']);
 return result.rows.map(dto);
}
export async function handoffHistory(c:DashboardContext,ids:string[]){
 await authorizeSales(c);
 return (await getDatabasePool().query<{handoff_id:string;status:string;note:string;actor:string|null;created_at:Date}>(`SELECT e.handoff_id,e.status,e.note,u.name actor,e.created_at FROM crm_relationship_handoff_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.workspace_id=$1 AND e.handoff_id=ANY($2::uuid[]) ORDER BY e.created_at,e.id`,[c.workspace.id,ids.slice(0,100)])).rows.map(e=>({...e,created_at:e.created_at.toISOString()}));
}
export async function getHandoff(c:DashboardContext,id:string){
 await authorizeSales(c);
 const row=(await getDatabasePool().query<Handoff>(`SELECT ${selection} FROM crm_relationship_handoffs h ${joins} WHERE h.workspace_id=$1 AND h.id=$2`,[c.workspace.id,id])).rows[0];
 if(!row)throw new SalesAccessError('That handoff is unavailable.');
 await relationshipAccess(c,{kind:row.kind,id:row.target_id});
 const events=(await getDatabasePool().query<{status:string;note:string;actor:string|null;created_at:Date}>(`SELECT e.status,e.note,u.name actor,e.created_at FROM crm_relationship_handoff_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.workspace_id=$1 AND e.handoff_id=$2 ORDER BY e.created_at,e.id`,[c.workspace.id,id])).rows.map(e=>({...e,created_at:e.created_at.toISOString()}));
 return {...dto(row),events};
}
