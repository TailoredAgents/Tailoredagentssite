import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {workTransaction,once,activeTeammate} from '@/lib/relationships/transactions';
import {SalesAccessError} from '@/lib/sales/data';
import {businessDateKey} from '@/lib/time';
import * as schema from './contract';
import {dateDeadline,loggingDeadline,responseDeadline} from './calendar';

const admin=(role:string)=>{if(!['owner','admin'].includes(role))throw new SalesAccessError('An owner or administrator must approve this change.');};
const actual=(value:string)=>{if(Date.parse(value)>Date.now())throw new SalesAccessError('Record when this actually happened, not a future time.');};
export async function successEvent(db:PoolClient,workspace:string,plan:string|null,task:string|null,operation:string,details:unknown,actor:string|null){await db.query('INSERT INTO crm_success_events(workspace_id,plan_id,task_id,operation,details,actor_user_id) VALUES($1,$2,$3,$4,$5,$6)',[workspace,plan,task,operation,JSON.stringify(details),actor]);}
async function clientLock(db:PoolClient,c:DashboardContext,id:string){const row=(await db.query('SELECT * FROM clients WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,id])).rows[0];if(!row)throw new SalesAccessError('That client is unavailable.');return row;}
function managerAccess(c:DashboardContext,role:string,owner:string|null){if(!['owner','admin'].includes(role)&&owner!==c.user.id)throw new SalesAccessError('Only the current account manager or an administrator can change this work.');}
async function planLock(db:PoolClient,c:DashboardContext,clientId:string){const p=(await db.query('SELECT p.*,cal.config FROM crm_success_plans p JOIN crm_success_calendars cal ON cal.id=p.calendar_id AND cal.workspace_id=p.workspace_id WHERE p.workspace_id=$1 AND p.client_id=$2 FOR UPDATE OF p',[c.workspace.id,clientId])).rows[0];if(!p)throw new SalesAccessError('Configure a client-success plan first.');return p;}

export async function createCalendar(c:DashboardContext,input:unknown){const v=schema.calendarInput.parse(input);return workTransaction(c,true,async(db,role)=>{admin(role);return once(db,c,'success_calendar',v.requestId,v,async()=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['success-calendar:'+c.workspace.id]);
 const id=randomUUID();await db.query('INSERT INTO crm_success_calendars(id,workspace_id,version,name,config,evidence,created_by) SELECT $1,$2,COALESCE(max(version),0)+1,$3,$4,$5,$6 FROM crm_success_calendars WHERE workspace_id=$2',[id,c.workspace.id,v.name,JSON.stringify(v.config),v.evidence,c.user.id]);
 await successEvent(db,c.workspace.id,null,null,'calendar_created',{id,name:v.name,evidence:v.evidence},c.user.id);return {id};
 });});}

export async function saveSuccessPlan(c:DashboardContext,input:unknown){const v=schema.planInput.parse(input);return workTransaction(c,true,async(db,role)=>{admin(role);return once(db,c,'success_plan',v.requestId,v,async()=>{
 const client=await clientLock(db,c,v.clientId),old=(await db.query('SELECT * FROM crm_success_plans WHERE workspace_id=$1 AND client_id=$2 FOR UPDATE',[c.workspace.id,v.clientId])).rows[0];
 if(old?old.revision!==v.revision:v.revision!==undefined)throw new SalesAccessError('This plan changed. Refresh before saving.');
 const cal=(await db.query('SELECT * FROM crm_success_calendars WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.calendarId])).rows[0];if(!cal)throw new SalesAccessError('Choose a calendar in this workspace.');
 dateDeadline(cal.config,v.checkinAnchor);dateDeadline(cal.config,v.reviewAnchor);
 if(v.mode!=='off'){if(client.status!=='active'||!client.account_manager_user_id)throw new SalesAccessError('An active client and a current account manager are required.');await activeTeammate(db,c,client.account_manager_user_id);}
 const id=old?.id??randomUUID(),revision=(old?.revision??0)+1;
 await db.query(`INSERT INTO crm_success_plans(id,workspace_id,client_id,calendar_id,mode,checkin_months,review_months,checkin_anchor,review_anchor,reminder_minutes,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
 ON CONFLICT(workspace_id,client_id) DO UPDATE SET calendar_id=excluded.calendar_id,mode=excluded.mode,checkin_months=excluded.checkin_months,review_months=excluded.review_months,
 checkin_step=CASE WHEN crm_success_plans.checkin_anchor=excluded.checkin_anchor AND crm_success_plans.checkin_months=excluded.checkin_months THEN crm_success_plans.checkin_step ELSE 0 END,
 review_step=CASE WHEN crm_success_plans.review_anchor=excluded.review_anchor AND crm_success_plans.review_months=excluded.review_months THEN crm_success_plans.review_step ELSE 0 END,
 checkin_anchor=excluded.checkin_anchor,review_anchor=excluded.review_anchor,reminder_minutes=excluded.reminder_minutes,evidence=excluded.evidence,revision=crm_success_plans.revision+1,last_checked_at=NULL,last_error=NULL`,[id,c.workspace.id,v.clientId,v.calendarId,v.mode,v.checkinMonths,v.reviewMonths,v.checkinAnchor,v.reviewAnchor,v.reminderMinutes,v.evidence,c.user.id]);
 await successEvent(db,c.workspace.id,id,null,'plan_saved',{...v,requestId:undefined,previous:old??null},c.user.id);
 if(v.mode!=='remind')await db.query("UPDATE assistant_employee_notifications n SET resolved_at=now() FROM crm_success_obligations o WHERE o.plan_id=$1 AND n.source_type='client_task' AND n.source_id=o.task_id AND n.resolved_at IS NULL",[id]);
 return {id,clientId:v.clientId,revision};
 });});}

type Obligation={workspace:string;plan:string;calendar:string;client:string;owner:string|null;kind:string;source:string;title:string;reference:string;occurred:string;due:string;nominal?:string;actor?:string};
export async function insertObligation(db:PoolClient,v:Obligation){
 const existing=(await db.query('SELECT task_id FROM crm_success_obligations WHERE plan_id=$1 AND source_key=$2',[v.plan,v.source])).rows[0];if(existing)return {id:existing.task_id as string,created:false};
 const id=randomUUID();await db.query("INSERT INTO crm_tasks(id,workspace_id,client_id,owner_user_id,kind,title,due_at,notes) VALUES($1,$2,$3,$4,'follow_up',$5,$6,$7)",[id,v.workspace,v.client,v.owner,v.title,v.due,v.reference]);
 await db.query('INSERT INTO crm_success_obligations(task_id,plan_id,calendar_id,kind,source_key,reference,occurred_at,nominal_on,original_due_at,original_owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,v.plan,v.calendar,v.kind,v.source,v.reference,v.occurred,v.nominal??null,v.due,v.owner]);
 await successEvent(db,v.workspace,v.plan,id,'created',{kind:v.kind,source:v.source,dueAt:v.due,owner:v.owner},v.actor??null);return {id,created:true};
}
export async function recordSuccessRequest(c:DashboardContext,input:unknown){const v=schema.requestInput.parse(input);return workTransaction(c,true,async(db,role)=>once(db,c,'success_request',v.requestId,v,async()=>{
 const client=await clientLock(db,c,v.clientId);managerAccess(c,role,client.account_manager_user_id);const p=await planLock(db,c,v.clientId);actual(v.occurredAt);
 if(client.status!=='active'||p.mode==='off'||!client.account_manager_user_id)throw new SalesAccessError('Enable observation for an active, assigned client first.');await activeTeammate(db,c,client.account_manager_user_id);
 const source='manual:'+v.sourceKey;if((await db.query('SELECT 1 FROM crm_success_obligations WHERE plan_id=$1 AND source_key=$2',[p.id,source])).rowCount)throw new SalesAccessError('That source is already recorded. Open the existing task.');
 const due=v.kind==='response'?responseDeadline(p.config,v.occurredAt):v.kind==='logging'?loggingDeadline(p.config,v.occurredAt):v.dueAt;
 if(!due||Date.parse(due)<Date.parse(v.occurredAt))throw new SalesAccessError('Choose a follow-up deadline after the recorded event.');
 return insertObligation(db,{workspace:c.workspace.id,plan:p.id,calendar:p.calendar_id,client:v.clientId,owner:client.account_manager_user_id,kind:v.kind,source,title:v.title,reference:v.reference,occurred:v.occurredAt,due,actor:c.user.id});
 }));}

export async function changeSuccessTask(c:DashboardContext,input:unknown){const v=schema.taskChangeInput.parse(input);return workTransaction(c,true,async(db,role)=>once(db,c,'success_task',v.requestId,v,async()=>{
 const ref=(await db.query('SELECT client_id FROM crm_tasks WHERE workspace_id=$1 AND id=$2 AND client_id IS NOT NULL',[c.workspace.id,v.id])).rows[0];if(!ref)throw new SalesAccessError('That task is unavailable.');
 const client=await clientLock(db,c,ref.client_id);managerAccess(c,role,client.account_manager_user_id);const p=await planLock(db,c,client.id);
 const t=(await db.query('SELECT t.*,o.revision,o.kind obligation_kind,o.occurred_at,o.original_due_at,cal.config FROM crm_tasks t JOIN crm_success_obligations o ON o.task_id=t.id JOIN crm_success_calendars cal ON cal.id=o.calendar_id WHERE t.workspace_id=$1 AND t.id=$2 FOR UPDATE OF t,o',[c.workspace.id,v.id])).rows[0];
 if(!t||t.status!=='open'||t.revision!==v.revision)throw new SalesAccessError('This task changed. Refresh before recording an outcome.');
 if(v.operation==='reschedule'){admin(role);if(!v.dueAt||Date.parse(v.dueAt)<=Date.now()||Date.parse(v.dueAt)===new Date(t.due_at).getTime())throw new SalesAccessError('Choose a different future rescheduled deadline.');await db.query('UPDATE crm_tasks SET due_at=$2,updated_at=now() WHERE id=$1',[t.id,v.dueAt]);}
 else if(v.operation==='excuse'){admin(role);await db.query("UPDATE crm_tasks SET status='cancelled',completion_outcome=$2,updated_at=now() WHERE id=$1",[t.id,v.evidence]);}
 else {
  if(!v.evidenceAt)throw new SalesAccessError('Record the actual time of the communication or work.');actual(v.evidenceAt);if(Date.parse(v.evidenceAt)<new Date(t.occurred_at).getTime())throw new SalesAccessError('The outcome cannot precede the recorded event.');
  if(v.operation==='record_auto'){await db.query("UPDATE crm_success_obligations SET response_kind='automatic',revision=revision+1 WHERE task_id=$1",[t.id]);await db.query("UPDATE assistant_employee_notifications SET resolved_at=now() WHERE source_type='client_task' AND source_id=$1 AND resolved_at IS NULL",[t.id]);}
  else {
   if(!v.human)throw new SalesAccessError('Confirm that a person performed this work. Automatic replies do not complete a response obligation.');
   await db.query("UPDATE crm_tasks SET status='completed',completed_at=now(),completion_outcome=$2,updated_at=now() WHERE id=$1",[t.id,v.evidence]);
   await db.query("UPDATE crm_success_obligations SET evidence_at=$2,response_kind='human',completed_by=$3 WHERE task_id=$1",[t.id,v.evidenceAt,c.user.id]);
   if(['response','checkin'].includes(t.obligation_kind))await insertObligation(db,{workspace:c.workspace.id,plan:p.id,calendar:p.calendar_id,client:client.id,owner:client.account_manager_user_id,kind:'logging',source:'log:'+t.id,title:'Record communication and next action',reference:'Complete the shared client record with the communication outcome and next action. Related task: '+t.id,occurred:v.evidenceAt,due:loggingDeadline(p.config,v.evidenceAt),actor:c.user.id});
  }
 }
 await successEvent(db,c.workspace.id,p.id,t.id,v.operation,{evidence:v.evidence,evidenceAt:v.evidenceAt??null,dueAt:v.dueAt??null,previousDueAt:t.due_at,originalDueAt:t.original_due_at},c.user.id);return {id:t.id};
 }));}

export async function saveManagerPool(c:DashboardContext,input:unknown){const v=schema.poolInput.parse(input);return workTransaction(c,true,async(db,role)=>{admin(role);return once(db,c,'success_pool',v.requestId,v,async()=>{await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['success-assign:'+c.workspace.id]);await activeTeammate(db,c,v.userId);await db.query(`INSERT INTO crm_success_manager_pool(workspace_id,user_id,enabled,capacity,specialties,evidence) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,user_id) DO UPDATE SET enabled=excluded.enabled,capacity=excluded.capacity,specialties=excluded.specialties,evidence=excluded.evidence,updated_at=now()`,[c.workspace.id,v.userId,v.enabled,v.capacity,v.specialties,v.evidence]);await successEvent(db,c.workspace.id,null,null,'pool_saved',v,c.user.id);return {id:v.userId};});});}
export async function recordAvailability(c:DashboardContext,input:unknown){const v=schema.availabilityInput.parse(input);return workTransaction(c,true,async(db,role)=>{admin(role);return once(db,c,'success_availability',v.requestId,v,async()=>{await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['success-assign:'+c.workspace.id]);await activeTeammate(db,c,v.userId);const id=randomUUID();await db.query('INSERT INTO crm_success_availability(id,workspace_id,user_id,starts_on,ends_before,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,c.workspace.id,v.userId,v.startsOn,v.endsBefore,v.evidence,c.user.id]);await successEvent(db,c.workspace.id,null,null,'availability_recorded',{id,...v},c.user.id);return {id};});});}
async function managerSuggestions(db:PoolClient,c:DashboardContext){return (await db.query(`SELECT p.*,u.name,(SELECT count(*)::int FROM clients cl WHERE cl.workspace_id=p.workspace_id AND cl.account_manager_user_id=p.user_id AND cl.status='active') load,
 (SELECT count(*)::int FROM crm_tasks t WHERE t.workspace_id=p.workspace_id AND t.owner_user_id=p.user_id AND t.client_id IS NOT NULL AND t.status='open') open_tasks,
 EXISTS(SELECT 1 FROM crm_success_availability a WHERE a.workspace_id=p.workspace_id AND a.user_id=p.user_id AND a.starts_on<=$2::date AND a.ends_before>$2::date) unavailable,
 (SELECT max(h.starts_at) FROM crm_client_manager_history h WHERE h.workspace_id=p.workspace_id AND h.user_id=p.user_id) last_assignment
 FROM crm_success_manager_pool p JOIN "user" u ON u.id=p.user_id JOIN workspace_memberships m ON m.workspace_id=p.workspace_id AND m.user_id=p.user_id AND m.status='active' AND m.role IN ('owner','admin','member') WHERE p.workspace_id=$1 ORDER BY last_assignment NULLS FIRST,p.user_id`,[c.workspace.id,businessDateKey()])).rows;}
export async function assignSuccessManager(c:DashboardContext,input:unknown){const v=schema.assignmentInput.parse(input);return workTransaction(c,true,async(db,role)=>{admin(role);return once(db,c,'success_assignment',v.requestId,v,async()=>{
 // Serialize capacity decisions; lock the client before its plan/tasks, matching the transfer trigger.
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['success-assign:'+c.workspace.id]);const client=await clientLock(db,c,v.clientId);if(client.account_manager_user_id!==v.expectedManagerId)throw new SalesAccessError('The manager changed. Refresh before assigning.');await activeTeammate(db,c,v.userId);
 const candidate=(await managerSuggestions(db,c)).find(r=>r.user_id===v.userId);if(!candidate||!candidate.enabled||candidate.unavailable||(candidate.load>=candidate.capacity&&client.account_manager_user_id!==v.userId))throw new SalesAccessError('Choose an available manager with capacity in the approved pool.');
 await db.query("SELECT set_config('app.actor_id',$1,true),set_config('app.assignment_reason',$2,true)",[c.user.id,v.evidence]);await db.query('UPDATE clients SET account_manager_user_id=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.clientId,v.userId]);await successEvent(db,c.workspace.id,null,null,'manager_assigned',v,c.user.id);return {id:v.clientId};
 });});}

export async function successWorkspace(c:DashboardContext,input:unknown={}){const v=schema.searchInput.parse(input);return workTransaction(c,false,async(db,role)=>({
 canAdmin:['owner','admin'].includes(role),workerEnabled:process.env.CLIENT_SUCCESS_WORKER_ENABLED==='true',remindersEnabled:process.env.CLIENT_SUCCESS_REMINDERS_ENABLED==='true',
 calendars:(await db.query('SELECT * FROM crm_success_calendars WHERE workspace_id=$1 ORDER BY version DESC LIMIT 50',[c.workspace.id])).rows,
 managers:await managerSuggestions(db,c),
 availability:(await db.query('SELECT a.*,u.name FROM crm_success_availability a JOIN "user" u ON u.id=a.user_id WHERE a.workspace_id=$1 AND ends_before>=$2::date ORDER BY starts_on LIMIT 100',[c.workspace.id,businessDateKey()])).rows,
 clients:(await db.query(`SELECT c.id,c.name,c.status,c.account_manager_user_id,u.name manager,p.mode,p.last_checked_at,p.last_error,
 (SELECT count(*)::int FROM crm_tasks t WHERE t.workspace_id=c.workspace_id AND t.client_id=c.id AND t.status='open') open_tasks,
 (SELECT count(*)::int FROM crm_tasks t WHERE t.workspace_id=c.workspace_id AND t.client_id=c.id AND t.status='open' AND t.due_at<now()) overdue
 FROM clients c LEFT JOIN "user" u ON u.id=c.account_manager_user_id LEFT JOIN crm_success_plans p ON p.workspace_id=c.workspace_id AND p.client_id=c.id WHERE c.workspace_id=$1 AND ($2 OR c.account_manager_user_id=$3) ORDER BY c.name,c.id LIMIT 51 OFFSET $4`,[c.workspace.id,v.scope==='team',c.user.id,(v.page-1)*50])).rows,
 }));}
export async function getSuccessClient(c:DashboardContext,id:string){z.uuid().parse(id);return workTransaction(c,false,async(db,role)=>{
 const client=(await db.query('SELECT cl.*,u.name manager FROM clients cl LEFT JOIN "user" u ON u.id=cl.account_manager_user_id WHERE cl.workspace_id=$1 AND cl.id=$2',[c.workspace.id,id])).rows[0];if(!client)throw new SalesAccessError('That client is unavailable.');
 const plan=(await db.query('SELECT p.*,cal.name calendar_name,cal.version calendar_version,cal.config FROM crm_success_plans p JOIN crm_success_calendars cal ON cal.id=p.calendar_id WHERE p.workspace_id=$1 AND p.client_id=$2',[c.workspace.id,id])).rows[0]??null;
 const tasks=(await db.query('SELECT t.*,o.kind obligation_kind,o.original_due_at,o.revision,o.evidence_at FROM crm_tasks t JOIN crm_success_obligations o ON o.task_id=t.id WHERE t.workspace_id=$1 AND t.client_id=$2 ORDER BY (t.status=\'open\') DESC,t.due_at DESC,t.id LIMIT 100',[c.workspace.id,id])).rows;
 return {client,plan,tasks,canAdmin:['owner','admin'].includes(role),canEdit:role!=='viewer'&&(['owner','admin'].includes(role)||client.account_manager_user_id===c.user.id)};
 });}
export async function getSuccessTask(c:DashboardContext,id:string){if(!z.uuid().safeParse(id).success)return null;return workTransaction(c,false,async(db,role)=>{
 const t=(await db.query('SELECT t.*,o.kind obligation_kind,o.revision,o.original_due_at,o.original_owner_id,o.reference,o.occurred_at,o.evidence_at,o.response_kind,cl.name client_name,cl.account_manager_user_id,u.name owner,cal.name calendar_name,cal.version calendar_version FROM crm_tasks t JOIN crm_success_obligations o ON o.task_id=t.id JOIN clients cl ON cl.id=t.client_id AND cl.workspace_id=t.workspace_id JOIN crm_success_calendars cal ON cal.id=o.calendar_id LEFT JOIN "user" u ON u.id=t.owner_user_id WHERE t.workspace_id=$1 AND t.id=$2',[c.workspace.id,id])).rows[0];if(!t)return null;
 const events=(await db.query('SELECT e.*,u.name actor FROM crm_success_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.workspace_id=$1 AND e.task_id=$2 ORDER BY e.created_at DESC,e.id LIMIT 100',[c.workspace.id,id])).rows;
 return {task:t,events,canAdmin:['owner','admin'].includes(role),canEdit:role!=='viewer'&&(['owner','admin'].includes(role)||t.account_manager_user_id===c.user.id)};
 });}
