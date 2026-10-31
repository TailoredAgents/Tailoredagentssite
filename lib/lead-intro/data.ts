import "server-only";
import { z } from "zod";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { IntroError, introTransaction } from "./service";

type Row={id:string;conversation_id:string;name:string;owner_name:string|null;status:string;body:string|null;due_at:Date;reason:string|null;generated_by:string|null;delivery:string|null;task_status:string|null;task_outcome:string|null;can_send:boolean};
const selection=`SELECT j.id,j.conversation_id,l.name,u.name owner_name,j.status,j.body,j.due_at,j.reason,j.generated_by,sm.status delivery,t.status task_status,t.outcome task_outcome,(g.can_send AND m.role<>'viewer') can_send
 FROM lead_intro_jobs j JOIN leads l ON l.id=j.lead_id AND l.workspace_id=j.workspace_id AND l.anonymized_at IS NULL
 JOIN sms_number_grants g ON g.number_id=j.number_id AND g.workspace_id=j.workspace_id AND g.user_id=$2
 JOIN sms_numbers n ON n.id=g.number_id AND n.workspace_id=g.workspace_id AND n.status='active'
 JOIN workspace_memberships m ON m.workspace_id=j.workspace_id AND m.user_id=g.user_id AND m.status='active'
 JOIN workspaces w ON w.id=j.workspace_id AND w.status='active'
 JOIN crm_conversations c ON c.id=j.conversation_id AND c.workspace_id=j.workspace_id AND c.deleted_at IS NULL AND c.merged_into_id IS NULL
 LEFT JOIN "user" u ON u.id=j.owner_user_id
 LEFT JOIN lead_intro_call_tasks t ON t.job_id=j.id AND t.workspace_id=j.workspace_id
 LEFT JOIN sms_outbound_intents i ON i.workspace_id=j.workspace_id AND i.request_id=j.id
 LEFT JOIN sms_messages sm ON sm.id=i.message_id AND sm.workspace_id=j.workspace_id
 WHERE j.workspace_id=$1`;
const serialize=(r:Row)=>({...r,due_at:r.due_at.toISOString()});
export type LeadIntroduction=ReturnType<typeof serialize>;
export async function getConversationIntroduction(context:DashboardContext,conversationId:string){
 const row=(await getDatabasePool().query<Row>(selection+" AND j.conversation_id=$3",[context.workspace.id,context.user.id,conversationId])).rows[0];
 return row?serialize(row):null;
}
export async function getIntroductionCalls(context:DashboardContext,scope:string){
 return (await getDatabasePool().query<Row>(selection+" AND t.status='open' AND ($3::boolean OR t.owner_user_id=$2) ORDER BY t.due_at LIMIT 100",[context.workspace.id,context.user.id,scope==='team'])).rows.map(serialize);
}
export async function completeIntroductionCall(context:DashboardContext,raw:unknown){
 const input=z.object({id:z.uuid(),outcome:z.string().trim().min(3).max(2000),status:z.enum(['completed','cancelled'])}).parse(raw);
 await introTransaction(context.workspace.id,async db=>{
  const row=(await db.query<Row>(selection+" AND j.id=$3",[context.workspace.id,context.user.id,input.id])).rows[0];
  if(!row?.can_send)throw new IntroError('Your number access does not allow updating this follow-up.');
  await db.query("UPDATE lead_intro_call_tasks SET status=$3,outcome=$4,completed_at=now() WHERE workspace_id=$1 AND job_id=$2 AND status='open'",[context.workspace.id,input.id,input.status,input.outcome]);
  await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:'lead_intro.call_'+input.status,targetType:'conversation',targetId:row.conversation_id});
 });
}
