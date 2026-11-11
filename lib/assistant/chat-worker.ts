import 'server-only';
import {getDatabasePool} from '@/lib/dashboard/db';
import {principal} from './oauth';
import {requireScopes} from './access';
import {chatLease} from './chat-lease';
import {advanceChatTurn} from './chat-runner';
import {enqueueRoutineWork} from './proactive-worker';
import {routinePolicy} from './routine-policy';
import {finishChatTurn} from './chat-store';
import {runBookingNotificationWorker} from './booking-notifications';
import {runEmployeeNotificationWorker} from './notification-worker';
import {claimAssignment,wakeReviewedAssignments} from './assignments';
import {processDocuments} from './documents';
import type {DashboardContext} from '@/lib/dashboard/data';
export async function advanceReviewedWork(c:DashboardContext,actionId:string){
 const rows=(await getDatabasePool().query(`SELECT t.id FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE t.waiting_action_id=$1 AND c.workspace_id=$2 AND c.user_id=$3 AND t.status='waiting' LIMIT 3`,[actionId,c.workspace.id,c.user.id])).rows;
 for(const row of rows)await runAssistantWorker(row.id,30);
}
export async function enqueueDueRoutine(){return enqueueRoutineWork();}
export async function runAssistantWorker(turnId?:string,limit=1){
 if(!turnId)await processDocuments(1);
 if(process.env.ASSISTANT_CHAT_ENABLED==='false'||process.env.OPERATIONS_ASSISTANT_ENABLED==='false')return {checked:0,failed:0,more:false};
 await wakeReviewedAssignments();
 if(!turnId)for(let i=0;i<5;i++)if(!await enqueueDueRoutine())break;
 let checked=0,failed=0;const until=Date.now()+145000;
 for(let n=0;n<limit&&Date.now()<until;n++){
  const db=getDatabasePool(),row=await claimAssignment(turnId);
  if(!row)break;checked++;
  const token=row.token;
  const routine=(await db.query('SELECT r.template FROM assistant_chat_turns t JOIN assistant_routines r ON r.id=t.routine_id WHERE t.id=$1',[row.id])).rows[0];
  await routinePolicy.run({recommendationsOnly:!!routine&&routine.template!=='custom'},()=>chatLease.run({turnId:row.id,token},async()=>{
   try{if(row.work_expires_at<=new Date()){await finishChatTurn(row.id,'This assignment’s seven-day window ended. Saved results remain available.','failed');return;}const grant=(await db.query('SELECT * FROM assistant_grants WHERE id=$1',[row.grant_id])).rows[0];if(!grant)throw Error('grant_unavailable');const p=await principal(grant);requireScopes(p,[],false);await advanceChatTurn(p,row.thread_id,row.id,token,row.engine_state);}
   catch{await finishChatTurn(row.id,'Your assistant connection expired or became unavailable. Reconnect to start new work; check receipts before repeating actions.','failed');}
  }));
  const settled=await db.query("UPDATE assistant_chat_turns SET lease_token=NULL,lease_until=NULL,status=CASE WHEN status='running' THEN 'queued' ELSE status END WHERE id=$1 AND lease_token=$2 RETURNING status",[row.id,token]);
  const status=settled.rows[0]?.status??(await db.query('SELECT status FROM assistant_chat_turns WHERE id=$1',[row.id])).rows[0]?.status;
  if(['failed','outcome_unknown'].includes(status))failed++;
 }
 const more=!!(await getDatabasePool().query("SELECT id FROM assistant_chat_turns WHERE status IN ('queued','running') AND (lease_until IS NULL OR lease_until<now()) LIMIT 1")).rowCount;
 const notifications=await runBookingNotificationWorker();
 const employeeNotifications=await runEmployeeNotificationWorker();
 return {checked,failed:failed+employeeNotifications.failed,more:more||notifications.more||employeeNotifications.more};
}
