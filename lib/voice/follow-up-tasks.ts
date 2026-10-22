import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { lineAccess, VoiceAccessError, VoiceInputError } from "./data";
import { callSummarySchema } from "./analysis-provider";

const uuid=z.uuid();
const fields=z.object({title:z.string().trim().min(2).max(300),ownerUserId:z.string().trim().min(1).max(200),dueAt:z.string().datetime({offset:true}).refine(value=>Number.isFinite(Date.parse(value)),"Choose a valid due date."),notes:z.string().trim().max(4000).default("")});
const createSchema=fields.extend({recordingId:uuid,suggestionIndex:z.coerce.number().int().min(0).max(4)});
const updateSchema=fields.extend({taskId:uuid});
const completeSchema=z.object({taskId:uuid,status:z.enum(["completed","cancelled"]),outcome:z.string().trim().min(2).max(2000)});
type CallContext={source_id:string;conversation_id:string;line_id:string;customer:string};
export type CallFollowUpTask={id:string;title:string;ownerId:string;ownerName:string;dueAt:string;notes:string;status:string;outcome:string|null;conversationId:string;customer:string;members:{id:string;name:string}[];canEdit:boolean};
async function transaction<T>(context:DashboardContext,work:(db:PoolClient)=>Promise<T>) {
  const db=await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    for(const key of ["unified-work","agency-voice","agency-sales"]) await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${key}:${context.workspace.id}`]);
    const result=await work(db);await db.query("COMMIT");return result;
  } catch(error) {await db.query("ROLLBACK");throw error;} finally {db.release();}
}
async function access(db:Pick<PoolClient,"query">,context:DashboardContext,sourceId:string,mutate=false) {
  const row=(await db.query<CallContext>(`SELECT s.id source_id,s.conversation_id,v.line_id,COALESCE(p.name,b.name,s.external_addresses[1],'Customer') customer FROM crm_conversation_sources s JOIN voice_conversations v ON v.id=s.voice_conversation_id AND v.workspace_id=s.workspace_id JOIN crm_conversations c ON c.id=s.conversation_id AND c.workspace_id=s.workspace_id LEFT JOIN contacts p ON p.id=c.contact_id AND p.workspace_id=c.workspace_id LEFT JOIN crm_businesses b ON b.id=COALESCE(c.business_id,p.business_id) AND b.workspace_id=c.workspace_id WHERE s.workspace_id=$1 AND s.id=$2 AND s.channel='call' AND s.visible AND c.merged_into_id IS NULL AND b.anonymized_at IS NULL`,[context.workspace.id,sourceId])).rows[0];
  if(!row)throw new VoiceInputError("This call follow-up is unavailable.");
  const permission=await lineAccess(db,context,row.line_id);
  if(mutate && permission.role==='viewer')throw new VoiceAccessError("Your dashboard access is read-only.");
  return {...row,role:permission.role};
}
async function members(db:Pick<PoolClient,"query">,workspace:string,line:string) {
  return (await db.query<{id:string;name:string}>(`SELECT u.id,u.name FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id JOIN voice_line_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer' AND g.line_id=$2 AND g.can_read ORDER BY u.name LIMIT 200`,[workspace,line])).rows;
}
async function assignee(db:PoolClient,context:DashboardContext,line:string,user:string) {
  const allowed=await db.query(`SELECT 1 FROM workspace_memberships m JOIN voice_line_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role<>'viewer' AND g.line_id=$3 AND g.can_read FOR SHARE OF m,g`,[context.workspace.id,user,line]);
  if(!allowed.rowCount)throw new VoiceInputError("Choose an active teammate who can access this call.");
}
async function recording(db:Pick<PoolClient,"query">,context:DashboardContext,id:string) {
  const r=(await db.query<{id:string;source_id:string;status:string;expires_at:Date;summary:unknown;transcript:string|null}>(`SELECT r.*,s.id source_id FROM voice_call_recordings r JOIN voice_calls c ON c.id=r.call_id AND c.workspace_id=r.workspace_id JOIN crm_conversation_sources s ON s.voice_conversation_id=c.voice_conversation_id AND s.workspace_id=c.workspace_id WHERE r.id=$1 AND r.workspace_id=$2`,[id,context.workspace.id])).rows[0];
  if(!r)throw new VoiceInputError("This call recording is unavailable.");
  const call=await access(db,context,r.source_id,true);
  if(r.status!=='ready' || r.expires_at.getTime()<=Date.now() || !r.transcript)throw new VoiceInputError("This recording's suggestions are no longer available.");
  const parsed=callSummarySchema.safeParse(r.summary);
  if(!parsed.success)throw new VoiceInputError("There are no available follow-up suggestions for this call.");
  return {r,call,summary:parsed.data};
}
export async function getCallFollowUpOptions(context:DashboardContext,recordingId:string,suggestionIndex:number) {
  const {r,call,summary}=await recording(getDatabasePool(),context,uuid.parse(recordingId));
  if(!Number.isInteger(suggestionIndex) || !summary.followUps[suggestionIndex])throw new VoiceInputError("Choose an available call follow-up.");
  const existing=(await getDatabasePool().query<{taskId:string}>("SELECT task_id AS \"taskId\" FROM voice_follow_up_tasks WHERE workspace_id=$1 AND recording_id=$2 AND suggestion_index=$3",[context.workspace.id,r.id,suggestionIndex])).rows[0];
  return {members:await members(getDatabasePool(),context.workspace.id,call.line_id),defaultOwnerId:context.user.id,taskId:existing?.taskId??null};
}
export async function createCallFollowUpTask(context:DashboardContext,input:unknown) {
  const p=createSchema.parse(input);
  return transaction(context,async db=>{
    const {r,call,summary}=await recording(db,context,p.recordingId);
    const suggestion=summary.followUps[p.suggestionIndex];
    if(!suggestion || !r.transcript!.includes(suggestion.quote))throw new VoiceInputError("This suggested follow-up is no longer available.");
    const existing=(await db.query<{task_id:string}>("SELECT task_id FROM voice_follow_up_tasks WHERE workspace_id=$1 AND recording_id=$2 AND suggestion_index=$3",[context.workspace.id,r.id,p.suggestionIndex])).rows[0];
    if(existing)return existing.task_id;
    await assignee(db,context,call.line_id,p.ownerUserId);
    const id=randomUUID();
    await db.query("INSERT INTO crm_tasks(id,workspace_id,conversation_source_id,owner_user_id,kind,title,due_at,notes) VALUES($1,$2,$3,$4,'follow_up',$5,$6,$7)",[id,context.workspace.id,call.source_id,p.ownerUserId,p.title,p.dueAt,p.notes||null]);
    await db.query("INSERT INTO voice_follow_up_tasks(workspace_id,recording_id,suggestion_index,task_id,created_by_user_id) VALUES($1,$2,$3,$4,$5)",[context.workspace.id,r.id,p.suggestionIndex,id,context.user.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"voice.follow_up_task.created",targetType:"crm_task",targetId:id,metadata:{recordingId:r.id,suggestionIndex:p.suggestionIndex,sourceId:call.source_id,ownerUserId:p.ownerUserId}});
    return id;
  });
}
type TaskRow={id:string;conversation_source_id:string;title:string;owner_user_id:string|null;owner_name:string|null;due_at:Date;notes:string|null;status:string;completion_outcome:string|null};
async function taskRow(db:Pick<PoolClient,"query">,context:DashboardContext,id:string,mutate=false) {
  if(!uuid.safeParse(id).success)throw new VoiceInputError("This follow-up task is unavailable.");
  const row=(await db.query<TaskRow>(`SELECT t.*,u.name owner_name FROM crm_tasks t LEFT JOIN "user" u ON u.id=t.owner_user_id WHERE t.workspace_id=$1 AND t.id=$2 AND t.conversation_source_id IS NOT NULL`,[context.workspace.id,uuid.parse(id)])).rows[0];
  if(!row)throw new VoiceInputError("This follow-up task is unavailable.");
  const call=await access(db,context,row.conversation_source_id,mutate);
  return {row,call};
}
export async function getCallFollowUpTask(context:DashboardContext,id:string):Promise<CallFollowUpTask> {
  const {row,call}=await taskRow(getDatabasePool(),context,id);
  return {id:row.id,title:row.title,ownerId:row.owner_user_id||"",ownerName:row.owner_name||"Unassigned",dueAt:row.due_at.toISOString(),notes:row.notes||"",status:row.status,outcome:row.completion_outcome,conversationId:call.conversation_id,customer:call.customer,members:await members(getDatabasePool(),context.workspace.id,call.line_id),canEdit:call.role!=='viewer'};
}
export async function updateCallFollowUpTask(context:DashboardContext,input:unknown) {
  const p=updateSchema.parse(input);
  await transaction(context,async db=>{
    const {row,call}=await taskRow(db,context,p.taskId,true);
    if(row.status!=='open')throw new VoiceInputError("This task has already been completed or cancelled.");
    await assignee(db,context,call.line_id,p.ownerUserId);
    await db.query("UPDATE crm_tasks SET title=$3,owner_user_id=$4,due_at=$5,notes=$6,updated_at=now() WHERE workspace_id=$1 AND id=$2",[context.workspace.id,row.id,p.title,p.ownerUserId,p.dueAt,p.notes||null]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"voice.follow_up_task.updated",targetType:"crm_task",targetId:row.id,metadata:{}});
  });
}
export async function completeCallFollowUpTask(context:DashboardContext,input:unknown) {
  const p=completeSchema.parse(input);
  await transaction(context,async db=>{
    const {row}=await taskRow(db,context,p.taskId,true);
    if(row.status!=='open')throw new VoiceInputError("This task has already been completed or cancelled.");
    await db.query("UPDATE crm_tasks SET status=$3,completion_outcome=$4,completed_at=CASE WHEN $3='completed' THEN now() ELSE NULL END,updated_at=now() WHERE workspace_id=$1 AND id=$2",[context.workspace.id,row.id,p.status,p.outcome]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:`voice.follow_up_task.${p.status}`,targetType:"crm_task",targetId:row.id,metadata:{}});
  });
}
