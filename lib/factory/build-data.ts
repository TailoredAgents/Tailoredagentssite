import "server-only";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { authorizeFactory,factoryTransaction } from "./data";
import { FactoryInputError } from "./types";
import type { FactoryBuildSettings,FactoryProjectBuilds,FactoryBuildVersion,FactoryUpload } from "./build-types";
import {factoryBuildConfiguration} from "./build-config";
import {readBuildActivity} from "./build-progress";
import {readFactoryFailureEvidence as failureEvidence,isFactoryEvidencePage} from "./build-failure-evidence";
import {factoryDraftSnapshot} from "./draft-snapshot";
import {factoryPublicWindowOpen} from "./public-verification";

export function factoryPreviewOrigin() {
  const configured=(process.env.FACTORY_PREVIEW_ORIGIN||"").trim();
  try{const url=new URL(configured);if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||["tailoredagents.com","www.tailoredagents.com","mail.tailoredagents.com"].includes(url.hostname))return null;return url.origin;}catch{return null;}
}
export function factoryPreviewUrl(token:string){const origin=factoryPreviewOrigin();return origin?`${origin}/p/${token}/`:null;}
export function factoryShareUrl(token:string,slug?:string|null){return factoryPreviewOrigin() ? slug ? `https://www.tailoredagents.com/preview/${slug}` : factoryPreviewUrl(token) : null;}
const iso=(v:Date|string|null)=>v?new Date(v).toISOString():null;
export async function readFactoryBuildSettings(db:Pick<PoolClient,"query">,workspaceId:string):Promise<FactoryBuildSettings>{
  const row=(await db.query("SELECT * FROM factory_build_settings WHERE workspace_id=$1",[workspaceId])).rows[0];
  return {enabled:row?.enabled??false,monthlyBudgetMicros:Number(row?.monthly_budget_micros??50000000),perBuildBudgetMicros:Number(row?.per_build_budget_micros??5000000),budgetApprovedAt:iso(row?.budget_approved_at??null)};
}
async function buildInfo(db:PoolClient,context:DashboardContext){
  const role=await authorizeFactory(db,context);
  const cost=(await db.query(`SELECT COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0)::text micros FROM factory_build_costs WHERE workspace_id=$1 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date`,[context.workspace.id])).rows[0];
  const config=factoryBuildConfiguration();
  return {settings:await readFactoryBuildSettings(db,context.workspace.id),monthSpentMicros:Number(cost?.micros??0),canManage:["owner","admin"].includes(role),canEdit:role!=="viewer",config:{configured:config.configured,reason:config.reason??undefined}};
}
export async function getFactoryBuildSettings(context:DashboardContext){return factoryTransaction(context.workspace.id,db=>buildInfo(db,context));}
export async function getFactoryProjectBuilds(context:DashboardContext,projectId:string):Promise<FactoryProjectBuilds|null>{
  return factoryTransaction(context.workspace.id,async db=>{
    const info=await buildInfo(db,context);
    if(!/^[0-9a-f-]{36}$/i.test(projectId))return null;
    const project=await db.query("SELECT id FROM factory_projects WHERE id=$1 AND workspace_id=$2",[projectId,context.workspace.id]);
    if(!project.rowCount)return null;
    const rows=(await db.query(`SELECT v.*,r.plan_id,p.version plan_version FROM factory_build_versions v JOIN factory_build_requests r ON r.id=v.build_request_id AND r.workspace_id=v.workspace_id JOIN factory_plans p ON p.id=r.plan_id AND p.workspace_id=r.workspace_id WHERE v.workspace_id=$1 AND v.project_id=$2 ORDER BY v.version DESC LIMIT 100`,[context.workspace.id,projectId])).rows;
    const versions:FactoryBuildVersion[]=rows.map(v=>({id:v.id,version:v.version,planId:v.plan_id,planVersion:v.plan_version,status:v.status,stage:v.stage,error:v.error,createdAt:iso(v.created_at)!,updatedAt:iso(v.updated_at)!,activity:readBuildActivity(v.working_data?.activity,v.stage),readyAt:iso(v.ready_at),previewUrl:v.status==="ready"&&!v.revoked_at&&new Date(v.expires_at).getTime()>Date.now()?factoryShareUrl(v.preview_token,v.preview_slug):null,sourceReady:v.status==="ready"&&Boolean(v.source_key),qaReport:v.qa_report,failedQa:v.status==="failed"?failureEvidence(v.working_data?.lastFailedQa,v.storage_prefix):null,revokedAt:iso(v.revoked_at),expiresAt:iso(v.expires_at)!,retryCount:v.retry_count,reviewAttempts:Number.isSafeInteger(v.working_data?.reviewAttempts)?Math.max(0,Math.min(3,v.working_data.reviewAttempts)):0,kind:v.kind,parentVersionId:v.parent_version_id,draftAvailable:info.canEdit&&["failed","ready"].includes(v.status)&&Boolean(factoryDraftSnapshot(v.status==="ready"?v.draft_snapshot:v.working_data,v.storage_prefix))}));
    const uploads=(await db.query<FactoryUpload&{createdAt:Date}>(`SELECT id,filename,role,alt,content_type AS "contentType",byte_size AS "byteSize",created_at AS "createdAt" FROM factory_uploads WHERE workspace_id=$1 AND project_id=$2 AND status='ready' ORDER BY created_at DESC`,[context.workspace.id,projectId])).rows.map(u=>({...u,createdAt:iso(u.createdAt)!}));
    return {...info,versions,uploads};
  });
}
/** Capability lookup for the separate preview service. Never cache its result. */
export async function getFactoryPreviewResolution(token:string,options:{verification?:boolean}={}){
  if(!/^(?:[0-9a-f]{48}|[a-z][a-z0-9-]{1,63})$/.test(token))return null;
  const row=(await getDatabasePool().query(`SELECT v.id,v.storage_prefix,v.manifest,v.expires_at,v.status,v.stage,v.lease_token,v.lease_until,v.qa_report,v.working_data,s.enabled FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id AND p.workspace_id=v.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id JOIN workspaces w ON w.id=v.workspace_id LEFT JOIN factory_build_settings s ON s.workspace_id=v.workspace_id WHERE (v.preview_token=$1 OR v.preview_slug=$1) AND v.revoked_at IS NULL AND v.expires_at>now() AND v.manifest IS NOT NULL AND w.status='active' AND l.anonymized_at IS NULL AND (v.status='ready' OR (v.status='running' AND v.stage='verify' AND v.lease_until>now()))`,[token])).rows[0];
  if(!row)return null;
  const publicCheck=row.enabled===true&&factoryPublicWindowOpen({status:row.status,stage:row.stage,leaseToken:row.lease_token,leaseUntil:row.lease_until,manifest:row.manifest,qaPassed:row.qa_report?.passed===true,window:row.working_data.publicVerification});
  if(row.status!=="ready"&&!publicCheck&&!options.verification)return null;
  // ready here means safe to serve anonymously. CRM READY/notifications still
  // require the final public receipt; a failed check immediately closes access.
  return {versionId:row.id,storagePrefix:`${row.storage_prefix}preview/`,manifest:row.manifest,expiresAt:iso(row.expires_at)!,ready:row.status==="ready"||publicCheck};
}
export async function getFactorySourceDownload(context:DashboardContext,versionId:string){
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context);
    if(!/^[0-9a-f-]{36}$/i.test(versionId))throw new FactoryInputError("Choose a completed website version.");
    const row=(await db.query("SELECT source_key,version,storage_prefix FROM factory_build_versions WHERE id=$1 AND workspace_id=$2 AND status='ready'",[versionId,context.workspace.id])).rows[0];
    if(!row?.source_key||!row.source_key.startsWith(row.storage_prefix))throw new FactoryInputError("The source download is not available for this version.");
    return {storageKey:row.source_key,filename:`website-v${row.version}.zip`};
  });
}
export async function getFactoryScreenshotDownload(context:DashboardContext,versionId:string,view:"desktop"|"mobile",page?:string){
  if(!["desktop","mobile"].includes(view)||page!==undefined&&!isFactoryEvidencePage(page))throw new FactoryInputError("Choose an available preview screenshot.");
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context);
    if(!/^[0-9a-f-]{36}$/i.test(versionId))throw new FactoryInputError("Choose a completed website version.");
    const row=(await db.query(`SELECT v.qa_report,v.version,v.storage_prefix,v.status,v.working_data->'lastFailedQa' failed_qa FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id AND p.workspace_id=v.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL WHERE v.id=$1 AND v.workspace_id=$2 AND v.status IN ('ready','failed')`,[versionId,context.workspace.id])).rows[0];
    const report=row?.status==="failed"?failureEvidence(row.failed_qa,row.storage_prefix):row?.qa_report;
    const key=page&&page!=="index.html"?report?.pageScreenshots?.find((shot:{page:string;viewport:string;storageKey:string})=>shot.page===page&&shot.viewport===view)?.storageKey:report?.screenshots?.[view];
    if(typeof key!=="string"||!key.startsWith(row.storage_prefix)||key.includes("..")||!key.endsWith(".png"))throw new FactoryInputError("This screenshot is not available.");
    if(row.status==="ready"&&key!==(page&&page!=="index.html"?`${row.storage_prefix}pages/screenshots/${page.split("/")[0]}-${view}.png`:`${row.storage_prefix}screenshots/${view}.png`))throw new FactoryInputError("This screenshot is not available.");
    return {storageKey:key,filename:`website-v${row.version}-${page&&page!=="index.html"?page.replace(/[^a-z0-9-]/g,"-")+"-":""}${view}.png`};
  });
}
export async function getFactoryUploadDownload(context:DashboardContext,uploadId:string){
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context);
    if(!/^[0-9a-f-]{36}$/i.test(uploadId))throw new FactoryInputError("Choose an existing reference image.");
    const row=(await db.query("SELECT storage_key,filename,content_type FROM factory_uploads WHERE id=$1 AND workspace_id=$2 AND status='ready'",[uploadId,context.workspace.id])).rows[0];
    if(!row)throw new FactoryInputError("This reference image is not available.");
    return {storageKey:row.storage_key as string,filename:row.filename as string,contentType:row.content_type as string};
  });
}
