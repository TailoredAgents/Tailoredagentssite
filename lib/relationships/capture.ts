import 'server-only';
import {randomUUID} from 'node:crypto';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {insertManualLead} from '@/lib/operations/manual-leads';
import {normalizePhone} from '@/lib/sales/import';
import {workTransaction,once,activeTeammate} from './transactions';
import {encounterSchema,focusSchema,type WorkFocus} from './capture-contract';
import {relationshipAccess,relationshipIds} from './service';
import type {RelationshipTarget} from './contract';
import type {PoolClient} from 'pg';
async function matches(db:PoolClient,c:DashboardContext,email?:string,phone?:string){
 const normalizedPhone=phone?normalizePhone(phone):null,digits=normalizedPhone?.replace(/\D/g,'')??'';
 return (await db.query<{id:string;name:string;organization:string;email:string|null;phone:string|null}>(`SELECT id,name,organization,email,phone FROM leads WHERE workspace_id=$1 AND anonymized_at IS NULL AND (($2<>'' AND lower(trim(email))=$2) OR ($3<>'' AND regexp_replace(phone,'[^0-9]','','g')=ANY($4::text[]))) ORDER BY updated_at DESC,id LIMIT 20`,[c.workspace.id,email?.trim().toLowerCase()??'',digits,[digits,...(digits.length===11&&digits.startsWith('1')?[digits.slice(1)]:[])]] )).rows;
}
export async function encounterMatches(c:DashboardContext,email?:string,phone?:string){return workTransaction(c,false,db=>matches(db,c,email,phone));}
export async function captureEncounter(c:DashboardContext,input:unknown){
 const v=encounterSchema.parse(input);
 return workTransaction(c,true,async db=>once(db,c,'encounter_capture',v.requestId,v,async()=>{
  await activeTeammate(db,c,v.ownerUserId);if(v.appointmentSetterUserId)await activeTeammate(db,c,v.appointmentSetterUserId);
  if(v.partnerId&&!(await db.query('SELECT 1 FROM crm_referral_partners WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.partnerId])).rowCount)throw new SalesAccessError('Choose an introducer in this workspace.');
  // Serialize the duplicate check and insert with the existing manual intake.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`agency-sales:${c.workspace.id}`]);
  let leadId=v.leadId;
  if(leadId)await relationshipAccess(c,{kind:'lead',id:leadId},db);
  else {
   const found=await matches(db,c,v.email,v.phone);
   if(found.length&&!v.createSeparate)throw new SalesAccessError('A prospect already uses this email or phone. Check matches, then choose the existing prospect or explicitly create a separate one.');
   const result=await insertManualLead(db,c,{...v,submissionId:v.requestId,name:v.name||v.organization||v.eventName||'New business conversation'});leadId=result.leadId;
   await db.query('UPDATE leads SET owner_user_id=$3 WHERE workspace_id=$1 AND id=$2',[c.workspace.id,leadId,v.ownerUserId]);
  }
  const id=randomUUID();
  await db.query('INSERT INTO crm_encounters(id,workspace_id,lead_id,channel,event_name,met_at,notes,appointment_setter_user_id,introduced_by,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,c.workspace.id,leadId,v.channel,v.eventName,v.metAt??null,v.notes,v.appointmentSetterUserId||null,v.partnerId??null,c.user.id]);
  if(v.partnerId)await db.query('INSERT INTO crm_introductions(id,workspace_id,partner_id,lead_id,note,created_by) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),c.workspace.id,v.partnerId,leadId,[v.eventName,v.notes].filter(Boolean).join(' — ').slice(0,2000),c.user.id]);
  await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'relationship.encounter_recorded',targetType:'lead',targetId:leadId,metadata:{encounterId:id,channel:v.channel}});
  return {id,leadId,createdNew:!v.leadId};
 }));
}
export async function listEncounters(c:DashboardContext,target:RelationshipTarget){
 const ids=(await relationshipIds(c,target)).map(r=>r.id);
 return workTransaction(c,false,async db=>(await db.query(`SELECT e.*,u.name recorded_by,s.name appointment_setter,p.name introducer FROM crm_encounters e LEFT JOIN "user" u ON u.id=e.created_by LEFT JOIN "user" s ON s.id=e.appointment_setter_user_id LEFT JOIN crm_referral_partners p ON p.id=e.introduced_by AND p.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.lead_id=ANY($2::uuid[]) ORDER BY e.created_at DESC,e.id LIMIT 50`,[c.workspace.id,ids])).rows);
}
export async function getWorkFocus(c:DashboardContext):Promise<WorkFocus>{return workTransaction(c,false,async db=>(await db.query('SELECT focus FROM crm_work_preferences WHERE workspace_id=$1 AND user_id=$2',[c.workspace.id,c.user.id])).rows[0]?.focus??'relationships');}
export async function saveWorkFocus(c:DashboardContext,input:unknown){const v=focusSchema.parse(input);return workTransaction(c,false,async db=>{await db.query('INSERT INTO crm_work_preferences(workspace_id,user_id,focus) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET focus=EXCLUDED.focus',[c.workspace.id,c.user.id,v.focus]);return {focus:v.focus};});}
