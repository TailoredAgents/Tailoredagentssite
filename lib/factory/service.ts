import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { insertAuditLog } from "@/lib/dashboard/db";
import { authorizeFactory, factoryTransaction, readFactorySettings } from "./data";
import { FactoryInputError } from "./types";
import { startFactorySchema,messageFactorySchema,approvalFactorySchema,retryFactorySchema,settingsFactorySchema } from "./validation";
import { queueApprovedFactoryBuild } from "./build-service";

async function createWorkspace(db: PoolClient, workspaceId: string, leadId: string, actorUserId: string|null) {
  // Lead lock precedes project lock, matching lead deletion. A lead with no useful
  // business fields is still a valid planning workspace.
  const lead=(await db.query("SELECT id FROM leads WHERE id=$1 AND workspace_id=$2 AND anonymized_at IS NULL FOR KEY SHARE",[leadId,workspaceId])).rows[0];
  if(!lead)throw new FactoryInputError("This lead is no longer available.");
  const projectId=randomUUID();
  const created=await db.query<{id:string}>(`INSERT INTO factory_projects(id,workspace_id,lead_id,created_by,status) VALUES($1,$2,$3,$4,'research_queued') ON CONFLICT(workspace_id,lead_id) DO NOTHING RETURNING id`,[projectId,workspaceId,leadId,actorUserId]);
  if(created.rows[0]){
    await db.query(`INSERT INTO factory_jobs(id,workspace_id,project_id,kind,request_key,requested_by) VALUES($1,$2,$3,'research','initial',$4)`,[randomUUID(),workspaceId,projectId,actorUserId]);
    return {projectId,created:true};
  }
  const existing=(await db.query<{id:string}>("SELECT id FROM factory_projects WHERE workspace_id=$1 AND lead_id=$2",[workspaceId,leadId])).rows[0];
  return {projectId:existing.id,created:false};
}
/** Call within lead intake's existing transaction. No provider request or paid work occurs here. */
export async function enqueueFactoryLead(db: PoolClient, workspaceId: string, leadId: string, actorUserId: string|null=null) {
  const settings=await readFactorySettings(db,workspaceId);
  if(!settings.researchEnabled||!settings.autoResearch||!settings.budgetApprovedAt)return null;
  return createWorkspace(db,workspaceId,leadId,actorUserId);
}
export async function startFactory(context: DashboardContext,input:unknown) {
  const data=startFactorySchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const result=await createWorkspace(db,context.workspace.id,data.leadId,context.user.id);
    if(result.created)await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.started",targetType:"factory_project",targetId:result.projectId});
    return result;
  });
}
async function projectForUpdate(db:PoolClient,context:DashboardContext,projectId:string){
  const project=(await db.query<{id:string;current_plan_id:string|null;status:string}>("SELECT id,current_plan_id,status FROM factory_projects WHERE workspace_id=$1 AND id=$2 FOR UPDATE",[context.workspace.id,projectId])).rows[0];
  if(!project)throw new FactoryInputError("This website planning workspace is no longer available.");
  return project;
}
export async function sendFactoryMessage(context:DashboardContext,input:unknown){
  const data=messageFactorySchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const project=await projectForUpdate(db,context,data.projectId);
    const requestId=`${context.user.id}:${data.requestId}`;
    const existing=(await db.query<{id:string;body:string;reference_urls:string[]}>("SELECT id,body,reference_urls FROM factory_messages WHERE project_id=$1 AND workspace_id=$2 AND request_id=$3",[project.id,context.workspace.id,requestId])).rows[0];
    if(existing){
      if(existing.body!==data.body||JSON.stringify(existing.reference_urls)!==JSON.stringify(data.referenceUrls))throw new FactoryInputError("This message request was already saved with different text. Refresh before sending another message.");
      return {projectId:project.id};
    }
    const active=(await db.query<{id:string;status:string;input_snapshot:unknown}>("SELECT id,status,input_snapshot FROM factory_jobs WHERE workspace_id=$1 AND project_id=$2 AND status IN ('queued','running') FOR UPDATE",[context.workspace.id,project.id])).rows[0];
    if(active&&(active.status==="running"||active.input_snapshot!==null))throw new FactoryInputError("The agent is working on this plan. Wait for its response before sending another direction.");
    const messageId=randomUUID();
    await db.query(`INSERT INTO factory_messages(id,workspace_id,project_id,role,body,reference_urls,request_id,author_user_id) VALUES($1,$2,$3,'user',$4,$5::jsonb,$6,$7)`,[messageId,context.workspace.id,project.id,data.body,JSON.stringify(data.referenceUrls),requestId,context.user.id]);
    if(!active)await db.query(`INSERT INTO factory_jobs(id,workspace_id,project_id,kind,request_key,requested_by,trigger_message_id,base_plan_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),context.workspace.id,project.id,project.current_plan_id?"revision":"research",`message:${messageId}`,context.user.id,messageId,project.current_plan_id]);
    await db.query("UPDATE factory_projects SET status='research_queued',updated_at=now() WHERE id=$1 AND workspace_id=$2",[project.id,context.workspace.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.message_added",targetType:"factory_project",targetId:project.id});
    return {projectId:project.id};
  });
}
export async function approveFactoryPlan(context:DashboardContext,input:unknown){
  const data=approvalFactorySchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const project=await projectForUpdate(db,context,data.projectId);
    if(project.current_plan_id!==data.planId)throw new FactoryInputError("This plan has changed. Review the latest version before approving it.");
    const active=await db.query("SELECT id FROM factory_jobs WHERE workspace_id=$1 AND project_id=$2 AND status IN ('queued','running')",[context.workspace.id,project.id]);
    if(active.rowCount)throw new FactoryInputError("Wait for the pending planning response, then review its latest plan before approving.");
    const unresolved=await db.query(`SELECT 1 FROM factory_jobs j WHERE j.workspace_id=$1 AND j.project_id=$2 AND j.status='failed' AND j.created_at > (SELECT created_at FROM factory_plans WHERE id=$3) AND NOT EXISTS (SELECT 1 FROM factory_jobs newer WHERE newer.project_id=j.project_id AND newer.workspace_id=j.workspace_id AND newer.created_at>j.created_at AND newer.status='succeeded') LIMIT 1`,[context.workspace.id,project.id,data.planId]);
    if(unresolved.rowCount)throw new FactoryInputError("The latest planning request failed. Retry it before approving so your new directions are included.");
    const inserted=await db.query<{id:string}>(`INSERT INTO factory_build_requests(id,workspace_id,project_id,plan_id,approved_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,plan_id) DO NOTHING RETURNING id`,[randomUUID(),context.workspace.id,project.id,data.planId,context.user.id]);
    const requestId=inserted.rows[0]?.id??(await db.query<{id:string}>("SELECT id FROM factory_build_requests WHERE project_id=$1 AND plan_id=$2 AND workspace_id=$3",[project.id,data.planId,context.workspace.id])).rows[0]?.id;
    // Only a fresh approval opts into visual photo selection. Catch-up of a
    // historical request keeps the original first-photo behavior.
    if(requestId)await queueApprovedFactoryBuild(db,requestId,inserted.rowCount?"visual-v1":undefined);
    await db.query("UPDATE factory_projects SET status='approved',updated_at=now() WHERE id=$1 AND workspace_id=$2",[project.id,context.workspace.id]);
    if(inserted.rowCount)await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.plan_approved",targetType:"factory_project",targetId:project.id,metadata:{planId:data.planId,buildRequestId:inserted.rows[0].id}});
    return {projectId:project.id};
  });
}
export async function retryFactoryJob(context:DashboardContext,input:unknown){
  const data=retryFactorySchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const project=await projectForUpdate(db,context,data.projectId);
    const existing=await db.query("SELECT id FROM factory_jobs WHERE workspace_id=$1 AND project_id=$2 AND request_key=$3",[context.workspace.id,project.id,`retry:${context.user.id}:${data.requestId}`]);
    if(existing.rowCount)return {projectId:project.id};
    const failed=(await db.query<{kind:string;trigger_message_id:string|null}>("SELECT kind,trigger_message_id FROM factory_jobs WHERE workspace_id=$1 AND project_id=$2 AND id=$3 AND status='failed'",[context.workspace.id,project.id,data.jobId])).rows[0];
    if(!failed)throw new FactoryInputError("Only a failed research or planning request can be retried.");
    const latest=(await db.query<{id:string}>("SELECT id FROM factory_jobs WHERE workspace_id=$1 AND project_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",[context.workspace.id,project.id])).rows[0];
    if(latest?.id!==data.jobId)throw new FactoryInputError("A newer planning request already exists. Refresh this workspace.");
    await db.query(`INSERT INTO factory_jobs(id,workspace_id,project_id,kind,request_key,requested_by,trigger_message_id,base_plan_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),context.workspace.id,project.id,failed.kind,`retry:${context.user.id}:${data.requestId}`,context.user.id,failed.trigger_message_id,project.current_plan_id]);
    await db.query("UPDATE factory_projects SET status='research_queued',updated_at=now() WHERE id=$1 AND workspace_id=$2",[project.id,context.workspace.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.job_retried",targetType:"factory_project",targetId:project.id,metadata:{failedJobId:data.jobId}});
    return {projectId:project.id};
  });
}
export async function saveFactorySettings(context:DashboardContext,input:unknown){
  const data=settingsFactorySchema.parse(input);
  if(data.autoResearch&&!data.researchEnabled)throw new FactoryInputError("Enable research before enabling automatic research for new leads.");
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"manage");
    await db.query(`INSERT INTO factory_settings(workspace_id,research_enabled,auto_research,monthly_budget_micros,budget_approved_at,updated_by) VALUES($1,$2,$3,$4,CASE WHEN $2 THEN now() ELSE NULL END,$5) ON CONFLICT(workspace_id) DO UPDATE SET research_enabled=EXCLUDED.research_enabled,auto_research=EXCLUDED.auto_research,monthly_budget_micros=EXCLUDED.monthly_budget_micros,budget_approved_at=EXCLUDED.budget_approved_at,updated_by=EXCLUDED.updated_by,updated_at=now()`,[context.workspace.id,data.researchEnabled,data.autoResearch,Math.round(data.monthlyBudgetDollars*1000000),context.user.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.settings_updated",targetType:"workspace",targetId:context.workspace.id,metadata:{researchEnabled:data.researchEnabled,autoResearch:data.autoResearch,monthlyBudgetDollars:data.monthlyBudgetDollars}});
    return {};
  });
}
