import 'server-only';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';

export async function workTransaction<T>(c:DashboardContext,write:boolean,work:(db:PoolClient,role:string)=>Promise<T>) {
 const db=await getDatabasePool().connect();
 try {
  await db.query('BEGIN');
  const row=(await db.query<{role:string}>(`SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w`,[c.workspace.id,c.user.id])).rows[0];
  if(!row||(write&&!['owner','admin','member'].includes(row.role)))throw new SalesAccessError('Your workspace access does not allow this action.');
  const result=await work(db,row.role);
  await db.query('COMMIT');return result;
 } catch(error) {await db.query('ROLLBACK');throw error;} finally {db.release();}
}
export async function once<T>(db:PoolClient,c:DashboardContext,operation:string,requestId:string,input:unknown,work:()=>Promise<T>):Promise<T> {
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`work:${c.workspace.id}:${c.user.id}:${requestId}`]);
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const previous=(await db.query('SELECT operation,input_hash,result FROM crm_work_requests WHERE workspace_id=$1 AND actor_user_id=$2 AND request_id=$3',[c.workspace.id,c.user.id,requestId])).rows[0];
 if(previous) {if(previous.operation!==operation||previous.input_hash!==hash)throw new SalesAccessError('That request was already used for different details. Refresh before submitting a new action.');return previous.result as T;}
 const result=await work();
 await db.query('INSERT INTO crm_work_requests(workspace_id,actor_user_id,request_id,operation,input_hash,result) VALUES($1,$2,$3,$4,$5,$6)',[c.workspace.id,c.user.id,requestId,operation,hash,JSON.stringify(result)]);
 return result;
}
export async function activeTeammate(db:PoolClient,c:DashboardContext,userId:string) {
 if(!(await db.query("SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin','member') FOR SHARE",[c.workspace.id,userId])).rowCount)throw new SalesAccessError('Choose an active teammate with editing access.');
}
