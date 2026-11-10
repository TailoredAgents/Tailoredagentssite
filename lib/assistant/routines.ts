import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {Principal} from './oauth';
import {AssistantError} from './config';
import {requireScopes} from './access';
export const routineSchema=z.object({id:z.uuid().optional(),expectedRevision:z.number().int().positive().optional(),title:z.string().trim().min(1).max(200),instruction:z.string().trim().min(1).max(6000),cadence:z.enum(['daily','weekdays','weekly']),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),weekday:z.number().int().min(0).max(6).default(1),enabled:z.boolean().default(true)}).refine(v=>!v.id||!!v.expectedRevision,'Read the current revision first.');
export async function nextRoutineTime(db:Pick<PoolClient,'query'>,cadence:string,time:string,weekday:number,after=new Date()){
 const r=await db.query<{next:Date}>(`SELECT candidate AS next FROM (SELECT ((($1::timestamptz AT TIME ZONE 'America/New_York')::date+n)+$2::time) AT TIME ZONE 'America/New_York' candidate,extract(dow FROM (($1::timestamptz AT TIME ZONE 'America/New_York')::date+n)) AS weekday_index FROM generate_series(0,8) n) d WHERE candidate>$1 AND ($3='daily' OR ($3='weekdays' AND weekday_index BETWEEN 1 AND 5) OR ($3='weekly' AND weekday_index=$4)) ORDER BY candidate LIMIT 1`,[after,time,cadence,weekday]);return r.rows[0].next;
}
export async function saveRoutine(p:Principal,raw:unknown){
 const v=routineSchema.parse(raw),db=getDatabasePool(),next=await nextRoutineTime(db,v.cadence,v.time,v.weekday);
 const values=[v.id??randomUUID(),p.context.workspace.id,p.context.user.id,p.grantId,v.title,v.instruction,v.cadence,v.time,v.weekday,v.enabled,next];
 const r=v.id?await db.query(`UPDATE assistant_routines SET grant_id=$4,title=$5,instruction=$6,cadence=$7,local_time=$8,weekday=$9,enabled=$10,next_run_at=$11,revision=revision+1,last_error=NULL,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revision=$12 RETURNING id,next_run_at,revision`,[...values,v.expectedRevision]):await db.query(`INSERT INTO assistant_routines(id,workspace_id,user_id,grant_id,title,instruction,cadence,local_time,weekday,enabled,next_run_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,next_run_at,revision`,values);
 if(!r.rowCount)throw new AssistantError('stale_routine','This routine changed or is unavailable.',409);
 if(!v.enabled)await db.query("UPDATE assistant_chat_turns SET status='interrupted',assistant_message='Routine paused. Work already in progress may still finish; check receipts.',engine_state=NULL,lease_token=NULL,lease_until=NULL,finished_at=now() WHERE routine_id=$1 AND status IN ('queued','running')",[v.id]);
 return {...r.rows[0],timezone:'America/New_York',enabled:v.enabled,authorizationExpiresAt:p.expiresAt,notice:'Runs while this employee connection remains valid. Results are private. Renew access and resume after authorization expires.'};
}
export async function listRoutines(p:Principal){return {items:(await getDatabasePool().query('SELECT id,title,instruction,cadence,local_time,weekday,enabled,revision,next_run_at,last_run_at,last_error FROM assistant_routines WHERE workspace_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100',[p.context.workspace.id,p.context.user.id])).rows,timezone:'America/New_York',limit:100};}
export async function setRoutineEnabled(p:Principal,id:string,revision:number,enabled:boolean){
 if(enabled)requireScopes(p,['routines:write'],true);
 const row=(await getDatabasePool().query('SELECT * FROM assistant_routines WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revision=$4',[id,p.context.workspace.id,p.context.user.id,revision])).rows[0];
 if(!row)throw new AssistantError('stale_routine','This routine changed or is unavailable.',409);
 return saveRoutine(p,{id,expectedRevision:revision,title:row.title,instruction:row.instruction,cadence:row.cadence,time:row.local_time.slice(0,5),weekday:row.weekday,enabled});
}
