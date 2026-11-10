import 'server-only';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from '@/lib/assistant/config';
import type {MeetingRecord} from './contract';
export const meetingError=(message:string,status=400)=>new AssistantError('meeting_error',message,status);
export async function meetingRole(c:DashboardContext,write=false,db:PoolClient|ReturnType<typeof getDatabasePool>=getDatabasePool()){
 const row=(await db.query("SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",[c.workspace.id,c.user.id])).rows[0];
 if(!row||(write&&row.role==='viewer'))throw meetingError('Your account cannot perform this action.',403);return row.role as string;
}
export async function getMeeting(c:DashboardContext,id:string,ownerOnly=false,db:PoolClient|ReturnType<typeof getDatabasePool>=getDatabasePool(),lock=false):Promise<MeetingRecord>{
 z.uuid().parse(id);await meetingRole(c,ownerOnly,db);
 const r=await db.query(`SELECT m.*,u.name owner_name FROM meetings m JOIN "user" u ON u.id=m.owner_user_id WHERE m.workspace_id=$1 AND m.id=$2 AND m.status NOT IN ('deleting','deleted') AND m.expires_at>now() AND (m.owner_user_id=$3 OR (m.visibility='team' AND NOT $4)) ${lock?'FOR UPDATE OF m':''}`,[c.workspace.id,id,c.user.id,ownerOnly]);
 if(!r.rows[0])throw meetingError('This meeting is unavailable.',404);return r.rows[0];
}
export async function meetingTransaction<T>(c:DashboardContext,work:(db:PoolClient)=>Promise<T>){
 const db=await getDatabasePool().connect();try{await db.query('BEGIN');const access=await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role<>'viewer' AND w.status='active' FOR SHARE OF m,w",[c.workspace.id,c.user.id]);if(!access.rowCount)throw meetingError('Your account cannot perform this action.',403);const result=await work(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
