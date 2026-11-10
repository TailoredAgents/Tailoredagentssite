import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import {principal} from './oauth';
import {requireScopes} from './access';
import {chatLease} from './chat-lease';
import {advanceChatTurn,type ChatEngine} from './chat-runner';
import {nextRoutineTime} from './routines';
import {finishChatTurn} from './chat-store';
import {runBookingNotificationWorker} from './booking-notifications';
import {runEmployeeNotificationWorker} from './notification-worker';
export async function enqueueDueRoutine(){
 const db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');
  const routine=(await db.query(`SELECT * FROM assistant_routines WHERE enabled AND next_run_at<=now() ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
  if(!routine){await db.query('COMMIT');return;}
  const grant=(await db.query('SELECT * FROM assistant_grants WHERE id=$1',[routine.grant_id])).rows[0];
  try{if(!grant)throw Error();const p=await principal(grant,db);requireScopes(p,['routines:write'],true);}
  catch{await db.query("UPDATE assistant_routines SET enabled=false,last_error='Connection expired, paused or revoked. Reconnect and resume this routine.',updated_at=now() WHERE id=$1",[routine.id]);await db.query('COMMIT');return;}
  if(!(await db.query("SELECT id FROM assistant_chat_turns WHERE routine_id=$1 AND status IN ('queued','running')",[routine.id])).rowCount){
   const thread=randomUUID();await db.query('INSERT INTO assistant_chat_threads(id,workspace_id,user_id,title) VALUES($1,$2,$3,$4)',[thread,routine.workspace_id,routine.user_id,routine.title.slice(0,100)]);
   await db.query("INSERT INTO assistant_chat_turns(id,thread_id,grant_id,user_message,status,routine_id) VALUES($1,$2,$3,$4,'queued',$5)",[randomUUID(),thread,routine.grant_id,routine.instruction,routine.id]);
  }
  const next=await nextRoutineTime(db,routine.cadence,routine.local_time,routine.weekday);
  await db.query('UPDATE assistant_routines SET next_run_at=$2,last_run_at=now(),last_error=NULL WHERE id=$1',[routine.id,next]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function runAssistantWorker(turnId?:string,limit=1){
 if(process.env.ASSISTANT_CHAT_ENABLED==='false'||process.env.OPERATIONS_ASSISTANT_ENABLED==='false')return {checked:0,failed:0,more:false};
 if(!turnId)await enqueueDueRoutine();
 let checked=0,failed=0;const until=Date.now()+145000;
 for(let n=0;n<limit&&Date.now()<until;n++){
  const token=randomUUID(),db=getDatabasePool();
  const row=(await db.query<{id:string;thread_id:string;grant_id:string;engine_state:ChatEngine|null}>(`UPDATE assistant_chat_turns SET status='running',lease_token=$2,lease_until=now()+interval '90 seconds',deadline=now()+interval '90 seconds' WHERE id=(SELECT id FROM assistant_chat_turns WHERE status IN ('queued','running') AND ($1::uuid IS NULL OR id=$1) AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,thread_id,grant_id,engine_state`,[turnId??null,token])).rows[0];
  if(!row)break;checked++;
  await chatLease.run({turnId:row.id,token},async()=>{
   try{const grant=(await db.query('SELECT * FROM assistant_grants WHERE id=$1',[row.grant_id])).rows[0];if(!grant)throw Error('grant_unavailable');const p=await principal(grant);requireScopes(p,[],false);await advanceChatTurn(p,row.thread_id,row.id,token,row.engine_state);}
   catch{failed++;await finishChatTurn(row.id,'Your assistant connection expired or became unavailable. Reconnect to start new work; check receipts before repeating actions.','failed');}
  });
  await db.query("UPDATE assistant_chat_turns SET lease_token=NULL,lease_until=NULL,status='queued' WHERE id=$1 AND lease_token=$2 AND status='running'",[row.id,token]);
 }
 const more=!!(await getDatabasePool().query("SELECT id FROM assistant_chat_turns WHERE status IN ('queued','running') AND (lease_until IS NULL OR lease_until<now()) LIMIT 1")).rowCount;
 const notifications=await runBookingNotificationWorker();
 const employeeNotifications=await runEmployeeNotificationWorker();
 return {checked,failed,more:more||notifications.more||employeeNotifications.more};
}
