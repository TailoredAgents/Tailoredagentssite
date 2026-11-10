import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {Principal} from './oauth';
import {AssistantError} from './config';
import {requireScopes} from './access';
import {routineSchema,timezoneSchema} from './routine-contract';
export {routineSchema} from './routine-contract';
export async function nextRoutineTime(db:Pick<PoolClient,'query'>,cadence:string,time:string,weekday:number,after=new Date(),timezone='America/New_York'){
 timezone=timezoneSchema.parse(timezone);
 const r=await db.query<{next:Date}>(`SELECT candidate AS next FROM (SELECT ((($1::timestamptz AT TIME ZONE $5)::date+n)+$2::time) AT TIME ZONE $5 candidate,extract(dow FROM (($1::timestamptz AT TIME ZONE $5)::date+n)) AS weekday_index FROM generate_series(0,8) n) d WHERE candidate>$1 AND ($3='daily' OR ($3='weekdays' AND weekday_index BETWEEN 1 AND 5) OR ($3='weekly' AND weekday_index=$4)) ORDER BY candidate LIMIT 1`,[after,time,cadence,weekday,timezone]);return r.rows[0].next;
}
export async function saveRoutine(p:Principal,raw:unknown){
 const v=routineSchema.parse(raw);requireScopes(p,v.enabled?['routines:write']:[],v.enabled);
 if(v.enabled&&v.template!=='custom'&&process.env.ASSISTANT_PROACTIVE_ENABLED==='false')throw new AssistantError('proactive_paused','Proactive routines are temporarily paused.',503);
 if(v.enabled&&(v.template==='follow_up'||(v.template==='watch'&&v.triggers.includes('reply')))&&!p.scopes.includes('conversations:read'))throw new AssistantError('routine_scope','Enable conversation reading before choosing conversation follow-ups.',403);
 const db=await getDatabasePool().connect();
 try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[p.context.workspace.id+':'+p.context.user.id+':routines']);
  if(!v.id&&Number((await db.query('SELECT count(*) n FROM assistant_routines WHERE workspace_id=$1 AND user_id=$2',[p.context.workspace.id,p.context.user.id])).rows[0].n)>=30)throw new AssistantError('routine_limit','An employee can save up to 30 routines. Reuse an existing one.',409);
  const next=v.template==='watch'?new Date(Date.now()+300000):await nextRoutineTime(db,v.cadence,v.time,v.weekday,new Date(),v.timezone);
  const values=[v.id??randomUUID(),p.context.workspace.id,p.context.user.id,p.grantId,v.title,v.instruction,v.cadence,v.time,v.weekday,v.enabled,next,v.template,v.timezone,Math.round(v.maxCostDollars*1000000),v.notify,[...new Set(v.triggers)],v.dailyRunLimit];
  const r=v.id?await db.query(`UPDATE assistant_routines SET grant_id=$4,title=$5,instruction=$6,cadence=$7,local_time=$8,weekday=$9,enabled=$10,next_run_at=$11,template=$12,timezone=$13,max_cost_micros=$14,notify=$15,triggers=$16,daily_run_limit=$17,revision=revision+1,last_error=NULL,scan_token=NULL,scan_until=NULL,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revision=$18 RETURNING id,next_run_at,revision`,[...values,v.expectedRevision]):await db.query(`INSERT INTO assistant_routines(id,workspace_id,user_id,grant_id,title,instruction,cadence,local_time,weekday,enabled,next_run_at,template,timezone,max_cost_micros,notify,triggers,daily_run_limit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id,next_run_at,revision`,values);
  if(!r.rowCount)throw new AssistantError('stale_routine','This routine changed or is unavailable.',409);
  if(v.id){
   await db.query("UPDATE assistant_actions SET status='cancelled',error_code='routine_changed',updated_at=now() WHERE status='awaiting_approval' AND id IN(SELECT waiting_action_id FROM assistant_chat_turns WHERE routine_id=$1)",[v.id]);
   await db.query("UPDATE assistant_chat_turns SET status='interrupted',assistant_message='Routine settings changed or were paused. Work already issued may finish; check receipts.',engine_state=NULL,finished_at=now() WHERE routine_id=$1 AND status IN ('queued','running','waiting','waiting_input','paused','blocked')",[v.id]);
   await db.query("DELETE FROM assistant_proactive_seen s USING assistant_chat_turns t WHERE s.routine_id=$1 AND s.turn_id=t.id AND t.status='interrupted' AND NOT EXISTS(SELECT 1 FROM assistant_chat_requests request WHERE request.turn_id=t.id AND request.status='reserved')",[v.id]);
   await db.query("UPDATE assistant_employee_notifications SET resolved_at=now() WHERE source_type='turn' AND source_id IN(SELECT id FROM assistant_chat_turns WHERE routine_id=$1) AND resolved_at IS NULL",[v.id]);
  }
  await db.query('COMMIT');return {...r.rows[0],timezone:v.timezone,enabled:v.enabled,maxCostDollars:v.maxCostDollars,authorizationExpiresAt:p.expiresAt,notice:'Runs while this employee connection remains valid. Results are private. Renew access and resume after authorization expires. Template routines prepare recommendations and files; they never send or change customer records.'};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function listRoutines(p:Principal){return {items:(await getDatabasePool().query('SELECT id,title,instruction,cadence,local_time,weekday,enabled,revision,next_run_at,last_run_at,last_error,template,timezone,max_cost_micros,notify,triggers,daily_run_limit FROM assistant_routines WHERE workspace_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100',[p.context.workspace.id,p.context.user.id])).rows,limit:100};}
export async function setRoutineEnabled(p:Principal,id:string,revision:number,enabled:boolean){
 if(enabled)requireScopes(p,['routines:write'],true);
 const row=(await getDatabasePool().query('SELECT * FROM assistant_routines WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revision=$4',[id,p.context.workspace.id,p.context.user.id,revision])).rows[0];
 if(!row)throw new AssistantError('stale_routine','This routine changed or is unavailable.',409);
 return saveRoutine(p,{id,expectedRevision:revision,title:row.title,instruction:row.instruction,cadence:row.cadence,time:row.local_time.slice(0,5),weekday:row.weekday,enabled,template:row.template,timezone:row.timezone,maxCostDollars:Number(row.max_cost_micros)/1000000,notify:row.notify,triggers:row.triggers,dailyRunLimit:row.daily_run_limit});
}
