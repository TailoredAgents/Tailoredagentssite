import 'server-only';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from '@/lib/assistant/config';
import type {MeetingRecord} from './contract';
import {processingEstimate} from './grouping';
export const meetingError=(message:string,status=400)=>new AssistantError('meeting_error',message,status);
export async function meetingRole(c:DashboardContext,write=false,db:PoolClient|ReturnType<typeof getDatabasePool>=getDatabasePool()){
 const row=(await db.query("SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",[c.workspace.id,c.user.id])).rows[0];
 if(!row||(write&&row.role==='viewer'))throw meetingError('Your account cannot perform this action.',403);return row.role as string;
}
export async function getMeeting(c:DashboardContext,id:string,ownerOnly=false,db:PoolClient|ReturnType<typeof getDatabasePool>=getDatabasePool(),lock=false):Promise<MeetingRecord>{
 z.uuid().parse(id);await meetingRole(c,ownerOnly,db);
 const r=await db.query(`SELECT m.*,u.name owner_name FROM meetings m JOIN "user" u ON u.id=m.owner_user_id WHERE m.workspace_id=$1 AND m.id=$2 AND m.parent_meeting_id IS NULL AND m.status NOT IN ('deleting','deleted') AND m.expires_at>now() AND (m.owner_user_id=$3 OR (m.visibility='team' AND NOT $4)) ${lock?'FOR UPDATE OF m':''}`,[c.workspace.id,id,c.user.id,ownerOnly]);
 if(!r.rows[0])throw meetingError('This meeting is unavailable.',404);
 const parts=(await db.query(`SELECT id,part_order,created_at,duration_seconds,audio_type,received_bytes,part_transcript IS NOT NULL AS transcribed,gap_before_seconds,boundary_reason FROM meetings WHERE workspace_id=$1 AND (id=$2 OR parent_meeting_id=$2) AND status NOT IN ('deleting','deleted') ORDER BY part_order,id`,[c.workspace.id,id])).rows;
 const receiving=!!(await db.query('SELECT 1 FROM meeting_devices WHERE current_meeting_id=$1 AND (always_ready OR armed_until>now()) AND revoked_at IS NULL',[id])).rowCount;
 return {...r.rows[0],part_transcript:null,parts,receiving,total_seconds:parts.reduce((n,p)=>n+(p.duration_seconds??0),0),processing_estimate:processingEstimate(parts)};
}
export async function meetingTransaction<T>(c:DashboardContext,work:(db:PoolClient)=>Promise<T>){
 const db=await getDatabasePool().connect();try{await db.query('BEGIN');const access=await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role<>'viewer' AND w.status='active' FOR SHARE OF m,w",[c.workspace.id,c.user.id]);if(!access.rowCount)throw meetingError('Your account cannot perform this action.',403);const result=await work(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
