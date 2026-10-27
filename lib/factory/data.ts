import "server-only";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { leadDisplayName,leadCompanyName } from "@/lib/operations/format";
import {factoryShareUrl} from "./build-data";
import { FactoryAccessError, type FactoryWorkspace, type FactoryProjectWorkspace, type FactoryProjectSummary, type FactorySettings, type FactoryPlan, type FactoryMessage, type FactoryJob, type FactoryBuildRequest } from "./types";

export async function factoryTransaction<T>(workspaceId: string, work: (db: PoolClient) => Promise<T>) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`factory-work:${workspaceId}`]);
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
export async function authorizeFactory(db: Pick<PoolClient,"query">, context: DashboardContext, permission: "read" | "edit" | "manage" = "read") {
  const role = (await db.query<{role:string}>(`SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w`, [context.workspace.id,context.user.id])).rows[0]?.role;
  if (!role || (permission!=="read" && role==="viewer") || (permission==="manage" && !["owner","admin"].includes(role))) throw new FactoryAccessError("Your workspace access does not allow this website planning action.");
  return role;
}
const date = (value: Date | string | null) => value ? new Date(value).toISOString() : null;
export async function readFactorySettings(db: Pick<PoolClient,"query">, workspaceId: string): Promise<FactorySettings> {
  const row = (await db.query<{research_enabled:boolean;auto_research:boolean;monthly_budget_micros:string;budget_approved_at:Date|null}>("SELECT research_enabled,auto_research,monthly_budget_micros,budget_approved_at FROM factory_settings WHERE workspace_id=$1", [workspaceId])).rows[0];
  return {researchEnabled:row?.research_enabled??false,autoResearch:row?.auto_research??false,monthlyBudgetMicros:Number(row?.monthly_budget_micros??25000000),budgetApprovedAt:date(row?.budget_approved_at??null)};
}
const projectSelect = `SELECT p.id,p.lead_id AS "leadId",l.name AS "leadName",l.organization AS "companyName",l.phone,l.email,p.status,p.current_plan_id AS "currentPlanId",v.version AS "currentPlanVersion",p.created_at AS "createdAt",p.updated_at AS "updatedAt",(SELECT json_build_object('id',b.id,'version',b.version,'status',b.status,'token',b.preview_token,'slug',b.preview_slug,'revoked',b.revoked_at,'expires',b.expires_at) FROM factory_build_versions b WHERE b.project_id=p.id AND b.workspace_id=p.workspace_id ORDER BY b.version DESC LIMIT 1) AS "buildRaw" FROM factory_projects p JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL LEFT JOIN factory_plans v ON v.id=p.current_plan_id AND v.project_id=p.id AND v.workspace_id=p.workspace_id`;
type ProjectRow = Omit<FactoryProjectSummary,"createdAt"|"updatedAt"> & {createdAt:Date;updatedAt:Date;phone:string|null;email:string|null;buildRaw:{id:string;version:number;status:import("./build-types").FactoryBuildStatus;token:string;slug:string;revoked:string|null;expires:string}|null};
function projectDto(row: ProjectRow): FactoryProjectSummary {
  const {phone,email,buildRaw,...project}=row;
  const identity={name:row.leadName,organization:row.companyName,phone,email};
  return {...project,leadName:leadDisplayName(identity),companyName:leadCompanyName(identity),createdAt:date(row.createdAt)!,updatedAt:date(row.updatedAt)!,latestBuild:buildRaw?{id:buildRaw.id,version:buildRaw.version,status:buildRaw.status,previewUrl:buildRaw.status==="ready"&&!buildRaw.revoked&&Date.parse(buildRaw.expires)>Date.now()?factoryShareUrl(buildRaw.token,buildRaw.slug):null}:null};
}
async function workspaceInfo(db: PoolClient, context: DashboardContext, role: string) {
  const settings = await readFactorySettings(db,context.workspace.id);
  const costs = (await db.query<{micros:string}>(`SELECT COALESCE(sum(CASE WHEN status='released' THEN 0 ELSE COALESCE(actual_micros,reserved_micros) END),0)::text AS micros FROM factory_costs WHERE workspace_id=$1 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date`,[context.workspace.id])).rows[0];
  const { getFactoryConfiguration } = await import("./config");
  const config = getFactoryConfiguration();
  return {settings,canManage:["owner","admin"].includes(role),canEdit:role!=="viewer",monthSpentMicros:Number(costs?.micros??0),config:{configured:config.configured,reason:config.configured?undefined:"Add FACTORY_OPENAI_API_KEY or the existing OPENAI_API_KEY to enable research."}};
}
export async function getFactoryWorkspace(context: DashboardContext): Promise<FactoryWorkspace> {
  return factoryTransaction(context.workspace.id,async db=>{
    const role = await authorizeFactory(db,context);
    const info = await workspaceInfo(db,context,role);
    const projects=(await db.query<ProjectRow>(`${projectSelect} WHERE p.workspace_id=$1 ORDER BY p.updated_at DESC,p.id LIMIT 200`,[context.workspace.id])).rows.map(projectDto);
    return {...info,projects};
  });
}
export async function getFactoryLeadProject(context: DashboardContext, leadId: string): Promise<FactoryProjectSummary|null> {
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context);
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return null;
    const row=(await db.query<ProjectRow>(`${projectSelect} WHERE p.workspace_id=$1 AND p.lead_id=$2`,[context.workspace.id,leadId])).rows[0];
    return row?projectDto(row):null;
  });
}
export async function getFactoryProject(context: DashboardContext, projectId: string): Promise<FactoryProjectWorkspace|null> {
  return factoryTransaction(context.workspace.id,async db=>{
    const role = await authorizeFactory(db,context);
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
    const row=(await db.query<ProjectRow>(`${projectSelect} WHERE p.workspace_id=$1 AND p.id=$2`,[context.workspace.id,projectId])).rows[0];
    if(!row)return null;
    const scope=[context.workspace.id,projectId];
    const messages=(await db.query<FactoryMessage & {createdAt:Date}>(`SELECT m.id,m.role,m.body,m.reference_urls AS "referenceUrls",u.name AS "authorName",m.created_at AS "createdAt" FROM factory_messages m LEFT JOIN "user" u ON u.id=m.author_user_id WHERE m.workspace_id=$1 AND m.project_id=$2 ORDER BY m.created_at,m.id`,scope)).rows.map(v=>({...v,createdAt:date(v.createdAt)!}));
    const plans=(await db.query<FactoryPlan & {createdAt:Date}>(`SELECT id,version,content,change_summary AS "changeSummary",created_at AS "createdAt" FROM factory_plans WHERE workspace_id=$1 AND project_id=$2 ORDER BY version DESC`,scope)).rows.map(v=>({...v,createdAt:date(v.createdAt)!}));
    const jobs=(await db.query<FactoryJob & {createdAt:Date;finishedAt:Date|null}>(`SELECT id,kind,status,stage,error,created_at AS "createdAt",finished_at AS "finishedAt" FROM factory_jobs WHERE workspace_id=$1 AND project_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30`,scope)).rows.map(v=>({...v,createdAt:date(v.createdAt)!,finishedAt:date(v.finishedAt)}));
    const buildRequests=(await db.query<FactoryBuildRequest & {approvedAt:Date}>(`SELECT b.id,b.plan_id AS "planId",p.version AS "planVersion",u.name AS "approvedByName",b.approved_at AS "approvedAt",b.status FROM factory_build_requests b JOIN factory_plans p ON p.id=b.plan_id AND p.project_id=b.project_id AND p.workspace_id=b.workspace_id LEFT JOIN "user" u ON u.id=b.approved_by WHERE b.workspace_id=$1 AND b.project_id=$2 ORDER BY b.approved_at DESC`,scope)).rows.map(v=>({...v,approvedAt:date(v.approvedAt)!}));
    return {...await workspaceInfo(db,context,role),project:projectDto(row),messages,plans,jobs,buildRequests};
  });
}
