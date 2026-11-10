import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {DashboardContext} from '@/lib/dashboard/data';
import {principal,type Principal} from './oauth';
import {AssistantError} from './config';
import {chatLease} from './chat-lease';
import {assignmentControlSchema,workPlanSchema,WORK_MAX_STEPS} from './assignment-contract';

export async function saveWorkPlan(p:Principal,id:string,raw:unknown){
 const plan=workPlanSchema.parse(raw).steps,lease=chatLease.getStore();
 const r=await getDatabasePool().query(`UPDATE assistant_chat_turns SET work_plan=$3::jsonb WHERE id=$1 AND grant_id=$2 AND status IN ('queued','running') AND ($4::uuid IS NULL OR lease_token=$4) RETURNING id`,[id,p.grantId,JSON.stringify(plan),lease?.token??null]);
 if(!r.rowCount)throw new AssistantError('stopped','This assignment stopped.',409);return {saved:true,steps:plan};
}
export async function controlAssignment(c:DashboardContext,raw:unknown){
 const v=assignmentControlSchema.parse(raw),db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');
  const r=(await db.query(`SELECT t.* FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE t.id=$1 AND t.thread_id=$2 AND c.workspace_id=$3 AND c.user_id=$4 FOR UPDATE OF t`,[v.id,v.threadId,c.workspace.id,c.user.id])).rows[0];
  if(!r)throw new AssistantError('not_found','This assignment is unavailable.',404);
  if(v.action==='pause'){
   await db.query("UPDATE assistant_chat_turns SET status='paused',blocked_reason='Paused by you. Work already started may still finish.' WHERE id=$1 AND status IN ('queued','running','waiting','waiting_input','blocked')",[r.id]);
  }else{
   if(!['paused','waiting_input','blocked'].includes(r.status))throw new AssistantError('cannot_resume','Check this assignment’s status and receipts before continuing.',409);
   if(r.work_expires_at<=new Date())throw new AssistantError('expired','This assignment’s seven-day window ended. Start a new assignment using its saved results.',409);
   if(r.lease_until&&r.lease_until>new Date())throw new AssistantError('settling','An earlier step is still settling. Wait a moment, then resume.',409);
   if(r.engine_state?.step>=WORK_MAX_STEPS)throw new AssistantError('step_limit','The assignment reached its total step limit. Start a new request using its saved results.',409);
   if((await db.query("SELECT 1 FROM assistant_chat_requests WHERE turn_id=$1 AND status='reserved'",[r.id])).rowCount)throw new AssistantError('outcome_unknown','An AI request has an uncertain outcome. It will not be repeated automatically.',409);
   await principal((await db.query('SELECT * FROM assistant_grants WHERE id=$1',[r.grant_id])).rows[0],db);
   if(r.status==='waiting_input'&&!v.message)throw new AssistantError('input_required','Reply to the assistant’s question before resuming.',400);
   const state=r.engine_state;if(state&&v.message)state.input.push({role:'user',content:v.message});
   await db.query(`UPDATE assistant_chat_turns SET status=CASE WHEN waiting_action_id IS NULL THEN 'queued' ELSE 'waiting' END,blocked_reason=NULL,assistant_message='',engine_state=$2::jsonb,lease_token=NULL,lease_until=NULL,max_cost_micros=COALESCE($3,max_cost_micros),employee_replies=employee_replies||$4::jsonb WHERE id=$1`,[r.id,JSON.stringify(state),v.maxCostDollars===undefined?null:Math.round(v.maxCostDollars*1000000),JSON.stringify(v.message?[{text:v.message,createdAt:new Date().toISOString()}]:[])]);
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
/** Review only wakes dependent work after a saved success; this never approves an action. */
export async function wakeReviewedAssignments(){
 const db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');
  const rows=(await db.query(`SELECT t.id,t.engine_state,a.id action_id,a.status,a.result,a.expires_at,a.updated_at FROM assistant_chat_turns t LEFT JOIN assistant_actions a ON a.id=t.waiting_action_id WHERE t.status='waiting' AND (a.id IS NULL OR a.status NOT IN ('awaiting_approval','running') OR a.expires_at<=now() OR (a.status='running' AND a.updated_at<now()-interval '5 minutes')) ORDER BY t.created_at LIMIT 20 FOR UPDATE OF t SKIP LOCKED`)).rows;
  for(const r of rows){
   if(r.status==='awaiting_approval'&&r.expires_at>new Date())continue;
   if(r.status==='running'&&r.updated_at>new Date(Date.now()-300000))continue;
   const output=r.engine_state?.input.find((item:{type?:string;call_id?:string})=>item.type==='function_call_output'&&item.call_id===r.engine_state.waitingCallId);
   if(r.status==='succeeded'&&output){output.output=JSON.stringify({id:r.action_id,status:r.status,result:r.result,note:'Exact human review completed. Continue only the existing employee assignment.'});delete r.engine_state.waitingCallId;await db.query("UPDATE assistant_chat_turns SET status='queued',waiting_action_id=NULL,blocked_reason=NULL,assistant_message='',engine_state=$2::jsonb WHERE id=$1",[r.id,JSON.stringify(r.engine_state)]);}
   else await db.query("UPDATE assistant_chat_turns SET status=$2,blocked_reason=$3,assistant_message=$3 WHERE id=$1",[r.id,['running','outcome_unknown'].includes(r.status)?'outcome_unknown':'blocked','The reviewed action did not confirm completion. Check its receipt. Dependent work has stopped.']);
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
/** One live step per workspace serializes conflicting records; last-step ordering gives employees a turn. */
export async function claimAssignment(turnId?:string){
 const db=await getDatabasePool().connect(),token=randomUUID();
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(8129130055)');
  const r=(await db.query(`SELECT t.id FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE t.status IN ('queued','running') AND ($1::uuid IS NULL OR t.id=$1) AND (t.lease_until IS NULL OR t.lease_until<now()) AND NOT EXISTS(SELECT 1 FROM assistant_chat_turns busy JOIN assistant_chat_threads bc ON bc.id=busy.thread_id WHERE bc.workspace_id=c.workspace_id AND busy.id<>t.id AND busy.lease_until>now()) ORDER BY t.last_advanced_at NULLS FIRST,t.created_at LIMIT 1 FOR UPDATE OF t SKIP LOCKED`,[turnId??null])).rows[0];
  const row=r?(await db.query("UPDATE assistant_chat_turns SET status='running',lease_token=$2,lease_until=now()+interval '90 seconds',deadline=now()+interval '90 seconds',last_advanced_at=now() WHERE id=$1 RETURNING id,thread_id,grant_id,engine_state,work_expires_at",[r.id,token])).rows[0]:null;
  await db.query('COMMIT');return row?{...row,token}:null;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
