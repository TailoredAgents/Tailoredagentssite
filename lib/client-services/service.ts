import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {workTransaction,once,activeTeammate} from '@/lib/relationships/transactions';
import {serviceSchema,reviewSchema,incidentSchema,resolveIncidentSchema,measurementSchema,serviceSearchSchema,measurementOutcome} from './contract';
async function finance(db:PoolClient,c:DashboardContext,role:string,write=false){if(['owner','admin'].includes(role))return true;return !!(await db.query(`SELECT 1 FROM crm_finance_access WHERE workspace_id=$1 AND user_id=$2 ${write?"AND permission='manage'":''} FOR SHARE`,[c.workspace.id,c.user.id])).rowCount;}
async function current(db:PoolClient,c:DashboardContext,id:string){const s=(await db.query('SELECT * FROM crm_client_services WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,id])).rows[0];if(!s)throw new SalesAccessError('That service is unavailable.');return s;}
async function audit(db:PoolClient,c:DashboardContext,action:string,id:string){await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'service.'+action,targetType:'client_service',targetId:id});}
export async function listClientServices(c:DashboardContext,input:unknown={}){
 const v=serviceSearchSchema.parse(input);
 return workTransaction(c,false,async db=>{
  const result=await db.query(`SELECT s.*,cl.name client_name,u.name owner,(SELECT count(*)::int FROM crm_service_incidents i WHERE i.workspace_id=s.workspace_id AND i.service_id=s.id AND i.status='open') open_incidents FROM crm_client_services s JOIN clients cl ON cl.id=s.client_id AND cl.workspace_id=s.workspace_id LEFT JOIN "user" u ON u.id=s.owner_user_id WHERE s.workspace_id=$1 AND ($2 OR s.owner_user_id=$3 OR EXISTS(SELECT 1 FROM crm_service_incidents i WHERE i.workspace_id=s.workspace_id AND i.service_id=s.id AND i.owner_user_id=$3 AND i.status='open')) AND ($4::uuid IS NULL OR s.client_id=$4) AND (NOT $5 OR (s.status<>'ended' AND (s.health IN ('degraded','incident') OR s.next_review_on<=(now() AT TIME ZONE 'America/New_York')::date OR s.renewal_on<=(now() AT TIME ZONE 'America/New_York')::date+14 OR EXISTS(SELECT 1 FROM crm_service_incidents i WHERE i.workspace_id=s.workspace_id AND i.service_id=s.id AND i.status='open')))) ORDER BY CASE WHEN s.health='incident' THEN 0 WHEN s.health='degraded' THEN 1 ELSE 2 END,s.next_review_on,s.id LIMIT 51 OFFSET $6`,[c.workspace.id,v.scope==='team',c.user.id,v.clientId??null,v.attention,(v.page-1)*50]);
  return {items:result.rows.slice(0,50),hasMore:result.rows.length>50,page:v.page};
 });
}
export async function getClientService(c:DashboardContext,id:string){
 return workTransaction(c,false,async(db,role)=>{
  const service=(await db.query(`SELECT s.*,cl.name client_name,u.name owner FROM crm_client_services s JOIN clients cl ON cl.id=s.client_id AND cl.workspace_id=s.workspace_id LEFT JOIN "user" u ON u.id=s.owner_user_id WHERE s.workspace_id=$1 AND s.id=$2`,[c.workspace.id,id])).rows[0];
  if(!service)throw new SalesAccessError('That service is unavailable.');
  const canReadCost=await finance(db,c,role),canWriteCost=await finance(db,c,role,true);
  const reviews=(await db.query(`SELECT r.*,u.name author FROM crm_service_reviews r LEFT JOIN "user" u ON u.id=r.author_user_id WHERE r.workspace_id=$1 AND r.service_id=$2 ORDER BY r.reviewed_at DESC,r.id LIMIT 100`,[c.workspace.id,id])).rows;
  const incidents=(await db.query(`SELECT i.*,u.name owner FROM crm_service_incidents i LEFT JOIN "user" u ON u.id=i.owner_user_id WHERE i.workspace_id=$1 AND i.service_id=$2 ORDER BY (i.status='open') DESC,i.due_at,i.id LIMIT 100`,[c.workspace.id,id])).rows;
  const measurements=(await db.query('SELECT * FROM crm_service_measurements WHERE workspace_id=$1 AND service_id=$2 ORDER BY ends_on DESC,id LIMIT 100',[c.workspace.id,id])).rows.map(m=>{const {cost_cents,...rest}=m;return {...rest,...(canReadCost?{cost_cents}:{}),outcome:measurementOutcome(m)};});
  return {service,reviews,incidents,measurements,canReadCost,canWriteCost,limit:100};
 });
}
export async function saveClientService(c:DashboardContext,input:unknown){
 const v=serviceSchema.parse(input);
 return workTransaction(c,true,async db=>once(db,c,'service_save',v.requestId,v,async()=>{
  await activeTeammate(db,c,v.ownerUserId);
  if(!(await db.query('SELECT 1 FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.clientId])).rowCount)throw new SalesAccessError('Choose a client in this workspace.');
  if(v.projectId&&!(await db.query('SELECT 1 FROM projects WHERE workspace_id=$1 AND id=$2 AND client_id=$3 FOR SHARE',[c.workspace.id,v.projectId,v.clientId])).rowCount)throw new SalesAccessError('Choose a delivery project belonging to this client.');
  let id=v.serviceId,revision=1;
  if(id){const s=await current(db,c,id);if(s.revision!==v.revision||s.client_id!==v.clientId)throw new SalesAccessError('Refresh this service before editing. Its client cannot be moved.');revision=s.revision+1;
   await db.query('UPDATE crm_client_services SET project_id=$3,name=$4,kind=$5,status=$6,owner_user_id=$7,deployment_url=$8,support_scope=$9,review_every_days=$10,next_review_on=$11,renewal_on=$12,revision=$13,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,id,v.projectId??null,v.name,v.kind,v.status,v.ownerUserId,v.deploymentUrl,v.supportScope,v.reviewEveryDays,v.nextReviewOn,v.renewalOn??null,revision]);
  }else{id=randomUUID();await db.query('INSERT INTO crm_client_services(id,workspace_id,client_id,project_id,name,kind,status,owner_user_id,deployment_url,support_scope,review_every_days,next_review_on,renewal_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,c.workspace.id,v.clientId,v.projectId??null,v.name,v.kind,v.status,v.ownerUserId,v.deploymentUrl,v.supportScope,v.reviewEveryDays,v.nextReviewOn,v.renewalOn??null]);}
  await audit(db,c,'saved',id);return {id,revision};
 }));
}
export async function recordServiceReview(c:DashboardContext,input:unknown){
 const v=reviewSchema.parse(input);
 return workTransaction(c,true,async db=>once(db,c,'service_review',v.requestId,v,async()=>{
  const s=await current(db,c,v.serviceId);if(s.revision!==v.revision)throw new SalesAccessError('This service changed. Refresh before saving your review.');
  if(Date.parse(v.reviewedAt)>Date.now()+60000||v.nextReviewOn<new Date(v.reviewedAt).toLocaleDateString('en-CA',{timeZone:'America/New_York'}))throw new SalesAccessError('Record an actual review time and a next review date after it.');
  const open=(await db.query("SELECT 1 FROM crm_service_incidents WHERE workspace_id=$1 AND service_id=$2 AND status='open'",[c.workspace.id,s.id])).rowCount;
  if(open&&v.health==='healthy')throw new SalesAccessError('Resolve open incidents before reporting this service as healthy.');
  const id=randomUUID(),health=open?'incident':v.health;
  await db.query('INSERT INTO crm_service_reviews(id,service_id,workspace_id,health,reviewed_at,next_review_on,outcome,author_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,s.id,c.workspace.id,health,v.reviewedAt,v.nextReviewOn,v.outcome,c.user.id]);
  // An older review remains history, but may not overwrite a newer observation.
  if(!s.health_observed_at||Math.floor(Date.parse(v.reviewedAt)/60000)>=Math.floor(new Date(s.health_observed_at).getTime()/60000))await db.query('UPDATE crm_client_services SET health=$3,health_observed_at=GREATEST(health_observed_at,$4::timestamptz),next_review_on=$5,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,s.id,health,v.reviewedAt,v.nextReviewOn]);
  await audit(db,c,'review_recorded',s.id);return {id,serviceId:s.id};
 }));
}
export async function recordServiceIncident(c:DashboardContext,input:unknown){
 const v=incidentSchema.parse(input);
 return workTransaction(c,true,async db=>once(db,c,'service_incident',v.requestId,v,async()=>{
  const s=await current(db,c,v.serviceId);await activeTeammate(db,c,v.ownerUserId);const id=randomUUID();
  await db.query('INSERT INTO crm_service_incidents(id,service_id,workspace_id,title,next_action,owner_user_id,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,s.id,c.workspace.id,v.title,v.nextAction,v.ownerUserId,v.dueAt,c.user.id]);
  await db.query("UPDATE crm_client_services SET health='incident',health_observed_at=now(),revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[c.workspace.id,s.id]);await audit(db,c,'incident_recorded',s.id);return {id,serviceId:s.id};
 }));
}
export async function resolveServiceIncident(c:DashboardContext,input:unknown){
 const v=resolveIncidentSchema.parse(input);
 return workTransaction(c,true,async db=>once(db,c,'service_incident_resolve',v.requestId,v,async()=>{
  const reference=(await db.query('SELECT service_id FROM crm_service_incidents WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.incidentId])).rows[0];if(!reference)throw new SalesAccessError('That incident is unavailable.');
  const s=await current(db,c,reference.service_id),i=(await db.query('SELECT * FROM crm_service_incidents WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.incidentId])).rows[0];
  if(i.revision!==v.revision||i.status!=='open')throw new SalesAccessError('That incident changed. Read its current status.');
  await db.query("UPDATE crm_service_incidents SET status='resolved',revision=revision+1,resolution=$3,resolved_by=$4,resolved_at=now() WHERE workspace_id=$1 AND id=$2",[c.workspace.id,i.id,v.resolution,c.user.id]);
  const open=(await db.query("SELECT 1 FROM crm_service_incidents WHERE workspace_id=$1 AND service_id=$2 AND status='open'",[c.workspace.id,s.id])).rowCount;
  await db.query('UPDATE crm_client_services SET health=$3,health_observed_at=now(),revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,s.id,open?'incident':'unknown']);await audit(db,c,'incident_resolved',s.id);return {id:i.id,status:'resolved',health:open?'incident':'unknown'};
 }));
}
export async function recordServiceMeasurement(c:DashboardContext,input:unknown){
 const v=measurementSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>once(db,c,'service_measurement',v.requestId,v,async()=>{
  await current(db,c,v.serviceId);if(v.costCents!==undefined&&!await finance(db,c,role,true))throw new SalesAccessError('Finance management access is required to record provider costs.');
  if((await db.query('SELECT 1 FROM crm_service_measurements WHERE workspace_id=$1 AND service_id=$2 AND source_key=$3',[c.workspace.id,v.serviceId,v.sourceKey])).rowCount)throw new SalesAccessError('That source is already recorded for this service. Do not count it twice.');
  const id=randomUUID();await db.query('INSERT INTO crm_service_measurements(id,workspace_id,service_id,source_key,starts_on,ends_on,basis,baseline_basis,documents,baseline_seconds_per_document,actual_seconds,cost_cents,evidence,methodology,author_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[id,c.workspace.id,v.serviceId,v.sourceKey,v.startsOn,v.endsOn,v.basis,v.baselineBasis,v.documents,v.baselineSecondsPerDocument,v.actualSeconds,v.costCents??null,v.evidence,v.methodology,c.user.id]);
  await audit(db,c,'measurement_recorded',v.serviceId);return {id,notice:'Recorded observation or estimate; not a referral payable event.'};
 }));
}
