import "server-only";
import {randomBytes,randomUUID} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import type {PoolClient} from "pg";
import {z} from "zod";
import type {DashboardContext} from "@/lib/dashboard/data";
import {getDatabasePool,insertAuditLog} from "@/lib/dashboard/db";
import {authorizeFactory,factoryTransaction} from "./data";
import {FactoryInputError} from "./types";
import {factoryPreviewUrl,factoryShareUrl} from "./build-data";
import {hasFactoryIdentity,factoryManifestFingerprint,factoryPublicWindowOpen} from "./public-verification";
import {factoryBuildConfiguration} from "./build-config";
import type {FactoryClaimedBuild,FactoryBuildStage,FactoryBuildStageResult,FactoryBuildFinish,FactoryBuildManifest,FactoryBuildQa} from "./build-types";
import {maximumReviewAttempts,maximumCorrectionAttempts} from "./build-types";
import {factoryDraftSnapshot} from "./draft-snapshot";
import {factoryBuildRecovery} from "./workflow";

const uuid=z.string().uuid();
const dollars=z.coerce.number().finite().min(1).refine(v=>Math.abs(Math.round(v*100)-v*100)<1e-8,"Use at most two decimal places.");
const settingsSchema=z.object({enabled:z.boolean(),monthlyBudgetDollars:dollars.max(2000),perBuildBudgetDollars:dollars.max(100)}).refine(v=>v.perBuildBudgetDollars<=v.monthlyBudgetDollars,"The per-site allowance cannot exceed the monthly allowance.");
const retrySchema=z.object({versionId:uuid,requestId:uuid});
const versionSchema=z.object({versionId:uuid});
const nextStage:Record<FactoryBuildStage,FactoryBuildStage|null>={generate:"images",images:"qa",qa:"publish",publish:"verify",verify:null};
function jsonSize(value:unknown,maximum:number){if(Buffer.byteLength(JSON.stringify(value))>maximum)throw new FactoryInputError("This website build exceeded its saved-data limit.");}
const hasControl=(value:string)=>Array.from(value).some(c=>c.charCodeAt(0)<32);
function validObjectKey(key:string,prefix:string){return key.startsWith(prefix)&&!key.includes("..")&&!key.includes("\\")&&!hasControl(key);}
function validateArtifacts(prefix:string,manifest:FactoryBuildManifest,qa:FactoryBuildQa,sourceKey:string){
  const safePath=/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:html|css|js|txt|png|jpg|jpeg|webp|svg|ico|woff2?)$/;
  if(manifest.entrypoint!=="index.html"||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>160)throw new FactoryInputError("The preview file manifest is invalid.");
  const seen=new Set<string>();let size=0;
  for(const file of manifest.files){const mime=/^([a-z]+\/[-a-z0-9+.]+)(?:;\s*charset=utf-8)?$/i.exec(file.contentType)?.[1]?.toLowerCase();if(!safePath.test(file.path)||seen.has(file.path)||!Number.isSafeInteger(file.size)||file.size<0||file.size>10485760||!/^[0-9a-f]{64}$/.test(file.sha256)||!["text/html","text/css","text/plain","application/javascript","text/javascript","image/png","image/jpeg","image/webp","image/svg+xml","image/x-icon","image/vnd.microsoft.icon","font/woff","font/woff2"].includes(mime||""))throw new FactoryInputError("A preview artifact has an unsafe path or invalid metadata.");seen.add(file.path);size+=file.size;}
  if(!seen.has("index.html")||size>52428800)throw new FactoryInputError("The preview is missing its homepage or exceeds its size limit.");
  if(sourceKey!==`${prefix}source.zip`||!qa.passed||!Array.isArray(qa.checks)||!Array.isArray(qa.warnings)||!qa.screenshots||![qa.screenshots.desktop,qa.screenshots.mobile].every(key=>typeof key==="string"&&validObjectKey(key,prefix)&&key.endsWith(".png")))throw new FactoryInputError("A portable source archive and passing desktop/mobile checks are required.");
  // Ten pages can include 20 screenshots/lab observations, dependency lists,
  // a six-dimension evidence scorecard and bounded review warnings. The former
  // 30 KB ceiling rejected valid rich reports after paid work had completed.
  // Keep a separate 100 KB ceiling; screenshot bytes and model prompts remain
  // outside this JSON report and the existing artifact/file limits still apply.
  jsonSize(manifest,120000);jsonSize(qa,100000);
}
async function lockedVersion(db:PoolClient,versionId:string,workspaceId?:string){
  // Project first, then version, matching deletion's project-to-child cascades.
  await db.query(`SELECT p.id FROM factory_projects p JOIN factory_build_versions v ON v.project_id=p.id AND v.workspace_id=p.workspace_id WHERE v.id=$1 AND ($2::uuid IS NULL OR v.workspace_id=$2) FOR UPDATE OF p`,[versionId,workspaceId??null]);
  const row=(await db.query(`SELECT * FROM factory_build_versions WHERE id=$1 AND ($2::uuid IS NULL OR workspace_id=$2) FOR UPDATE`,[versionId,workspaceId??null])).rows[0];
  if(!row)throw new FactoryInputError("This website version is no longer available.");return row;
}
async function buildTransaction<T>(work:(db:PoolClient)=>Promise<T>){const db=await getDatabasePool().connect();try{await db.query("BEGIN");const result=await work(db);await db.query("COMMIT");return result;}catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}}
async function snapshotUploads(db:PoolClient,projectId:string,workspaceId:string){
  // Freeze the normalized bytes' existing digest with the human-approved asset
  // list. Older saved snapshots may omit it; never rewrite their input history.
  return (await db.query(`SELECT id,filename,role,alt,sha256,content_type AS "contentType",byte_size AS "byteSize",storage_key AS "storageKey",created_at AS "createdAt" FROM factory_uploads WHERE project_id=$1 AND workspace_id=$2 AND status='ready' ORDER BY created_at,id LIMIT 20`,[projectId,workspaceId])).rows.map(u=>({...u,createdAt:new Date(u.createdAt).toISOString()}));
}
function preserveBuildInputs(saved:Record<string,unknown>,updated:Record<string,unknown>){return {...updated,inputUploads:saved.inputUploads??[],inputImageSelection:saved.inputImageSelection,...(saved.draftRevision?{draftRevision:saved.draftRevision}:{})};}
/** Requires an existing approval row. Called in the approval transaction; never from research completion. */
export async function queueApprovedFactoryBuild(db:PoolClient,requestId:string,imageSelection?:"visual-v1"){
  const approved=(await db.query(`SELECT r.*,p.id project,l.anonymized_at FROM factory_build_requests r JOIN factory_projects p ON p.id=r.project_id AND p.workspace_id=r.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id JOIN workspaces w ON w.id=p.workspace_id WHERE r.id=$1 AND l.anonymized_at IS NULL AND w.status='active' FOR UPDATE OF p`,[requestId])).rows[0];
  if(!approved)throw new FactoryInputError("An existing human-approved plan is required before building.");
  const existing=(await db.query("SELECT id FROM factory_build_versions WHERE build_request_id=$1 AND kind='initial'",[requestId])).rows[0];
  if(existing)return {versionId:existing.id as string};
  if((await db.query("SELECT 1 FROM factory_uploads WHERE project_id=$1 AND workspace_id=$2 AND status='pending' LIMIT 1",[approved.project_id,approved.workspace_id])).rowCount)throw new FactoryInputError("Wait for the image upload to finish before approving this website build.");
  const inputUploads=await snapshotUploads(db,approved.project_id,approved.workspace_id);
  const id=randomUUID(),token=randomBytes(24).toString("hex"),prefix=`factory/${approved.workspace_id}/${approved.project_id}/${id}/`;
  await db.query(`INSERT INTO factory_build_versions(id,workspace_id,project_id,build_request_id,version,storage_prefix,preview_token,created_by,working_data) SELECT $1,$2,$3,$4,COALESCE(max(version),0)+1,$5,$6,$7,$8::jsonb FROM factory_build_versions WHERE project_id=$3 AND workspace_id=$2`,[id,approved.workspace_id,approved.project_id,requestId,prefix,token,approved.approved_by,JSON.stringify({inputUploads,...(imageSelection?{inputImageSelection:imageSelection}:{})})]);
  return {versionId:id};
}
export async function saveFactoryBuildSettings(context:DashboardContext,input:unknown){
  const data=settingsSchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"manage");
    if(data.enabled&&!factoryBuildConfiguration().configured)throw new FactoryInputError("Connect website storage and the preview service before enabling builds.");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`factory-build-budget:${context.workspace.id}`]);
    await db.query(`INSERT INTO factory_build_settings(workspace_id,enabled,monthly_budget_micros,per_build_budget_micros,budget_approved_at,updated_by) VALUES($1,$2,$3,$4,CASE WHEN $2 THEN now() ELSE NULL END,$5) ON CONFLICT(workspace_id) DO UPDATE SET enabled=EXCLUDED.enabled,monthly_budget_micros=EXCLUDED.monthly_budget_micros,per_build_budget_micros=EXCLUDED.per_build_budget_micros,budget_approved_at=EXCLUDED.budget_approved_at,updated_by=EXCLUDED.updated_by,updated_at=now()`,[context.workspace.id,data.enabled,Math.round(data.monthlyBudgetDollars*1e6),Math.round(data.perBuildBudgetDollars*1e6),context.user.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.build_settings_updated",targetType:"workspace",targetId:context.workspace.id,metadata:data});return {};
  });
}
/** One bounded stage. Worker must finish within the fixed 15-minute lease; no renewal API. */
export async function claimFactoryBuild():Promise<FactoryClaimedBuild|null>{
  if(!factoryBuildConfiguration().configured)return null;
  return buildTransaction(async db=>{
    // Existing approved plans also become queued without inventing new approvals.
    const pending=await db.query<{id:string}>(`SELECT r.id FROM factory_build_requests r JOIN factory_projects p ON p.id=r.project_id AND p.workspace_id=r.workspace_id JOIN factory_build_settings s ON s.workspace_id=r.workspace_id WHERE s.enabled AND s.budget_approved_at IS NOT NULL AND r.status='awaiting_builder' AND NOT EXISTS(SELECT 1 FROM factory_build_versions v WHERE v.build_request_id=r.id AND v.kind='initial') AND NOT EXISTS(SELECT 1 FROM factory_uploads u WHERE u.project_id=r.project_id AND u.workspace_id=r.workspace_id AND u.status='pending') ORDER BY r.approved_at FOR UPDATE OF p SKIP LOCKED LIMIT 1`);
    if(pending.rows[0])await queueApprovedFactoryBuild(db,pending.rows[0].id);
    const row=(await db.query(`SELECT v.*,r.plan_id,pl.content plan FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id AND p.workspace_id=v.workspace_id JOIN factory_build_requests r ON r.id=v.build_request_id AND r.workspace_id=v.workspace_id JOIN factory_plans pl ON pl.id=r.plan_id AND pl.workspace_id=r.workspace_id JOIN factory_build_settings s ON s.workspace_id=v.workspace_id JOIN workspaces w ON w.id=v.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE v.status='queued' AND s.enabled AND s.budget_approved_at IS NOT NULL AND w.status='active' AND l.anonymized_at IS NULL AND NOT EXISTS(SELECT 1 FROM factory_build_versions active WHERE active.project_id=v.project_id AND active.status='running') ORDER BY v.created_at,v.id FOR UPDATE OF p SKIP LOCKED LIMIT 1`)).rows[0];
    if(!row)return null;
    const lease=randomUUID();
    const claimed=(await db.query("UPDATE factory_build_versions SET status='running',lease_token=$2,lease_until=now()+interval '15 minutes',attempts=attempts+1,error=NULL,updated_at=now() WHERE id=$1 RETURNING lease_until",[row.id,lease])).rows[0];
    await db.query("UPDATE factory_build_requests SET status='building' WHERE id=$1",[row.build_request_id]);
    const uploads=row.working_data.inputUploads??[];
    return {id:row.id,workspaceId:row.workspace_id,projectId:row.project_id,buildRequestId:row.build_request_id,planId:row.plan_id,plan:row.plan,version:row.version,stage:row.stage,leaseToken:lease,leaseUntil:new Date(claimed.lease_until).toISOString(),attempt:row.attempts+1,workingData:row.working_data,storagePrefix:row.storage_prefix,previewToken:row.preview_token,previewSlug:row.preview_slug,imageSelection:row.working_data.inputImageSelection==="visual-v1"?"visual-v1":undefined,uploads};
  });
}
async function activeBuild(db:PoolClient,id:string,lease:string){
  const row=await lockedVersion(db,id);
  if(row.status!=="running"||row.lease_token!==lease||new Date(row.lease_until).getTime()<=Date.now())return null;
  const enabled=await db.query(`SELECT 1 FROM factory_build_settings s JOIN workspaces w ON w.id=s.workspace_id JOIN factory_projects p ON p.workspace_id=s.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE s.workspace_id=$1 AND p.id=$2 AND s.enabled AND s.budget_approved_at IS NOT NULL AND w.status='active' AND l.anonymized_at IS NULL`,[row.workspace_id,row.project_id]);
  return enabled.rowCount?row:null;
}
export async function saveFactoryBuildStage(input:FactoryBuildStageResult){
  if(nextStage[input.stage]!==input.nextStage)throw new FactoryInputError("Invalid website build stage transition.");jsonSize(input.workingData,2000000);
  return buildTransaction(async db=>{
    const row=await activeBuild(db,input.versionId,input.leaseToken);if(!row||row.stage!==input.stage)return false;
    if(input.nextStage==="verify"){if(!input.manifest||!input.qaReport||!input.sourceKey)throw new FactoryInputError("Published artifacts and passing checks are required before verification.");validateArtifacts(row.storage_prefix,input.manifest,input.qaReport,input.sourceKey);}
    await db.query(`UPDATE factory_build_versions SET stage=$3,status='queued',working_data=$4::jsonb,manifest=COALESCE($5::jsonb,manifest),qa_report=COALESCE($6::jsonb,qa_report),source_key=COALESCE($7,source_key),lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`,[input.versionId,input.leaseToken,input.nextStage,JSON.stringify(preserveBuildInputs(row.working_data,input.workingData)),input.manifest?JSON.stringify(input.manifest):null,input.qaReport?JSON.stringify(input.qaReport):null,input.sourceKey??null]);return true;
  });
}
/** Persist bounded repair intent before the paid call; it survives an interrupted stage. */
export async function saveFactoryBuildProgress(input:{versionId:string;leaseToken:string;stage:FactoryBuildStage;workingData:Record<string,unknown>}){
  jsonSize(input.workingData,2000000);
  return buildTransaction(async db=>{const row=await activeBuild(db,input.versionId,input.leaseToken);if(!row||row.stage!==input.stage)return false;await db.query("UPDATE factory_build_versions SET working_data=$3::jsonb,updated_at=now() WHERE id=$1 AND lease_token=$2",[input.versionId,input.leaseToken,JSON.stringify(preserveBuildInputs(row.working_data,input.workingData))]);return true;});
}
/** Continue the same approved version after a saved correction, with a fresh QA
 * lease. This cannot advance the pipeline, create an approval or reset budgets. */
export async function requeueFactoryBuildQuality(input:{versionId:string;leaseToken:string;workingData:Record<string,unknown>}){
  jsonSize(input.workingData,2000000);
  return buildTransaction(async db=>{
    const row=await activeBuild(db,input.versionId,input.leaseToken);if(!row||row.stage!=="qa")return false;
    await db.query("UPDATE factory_build_versions SET status='queued',working_data=$3::jsonb,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2",[input.versionId,input.leaseToken,JSON.stringify(preserveBuildInputs(row.working_data,input.workingData))]);
    return true;
  });
}
/** Undo only a known pre-request intent, including when an owner just paused
 * building. Unlike progress saving, this cannot advance, publish, re-enable or
 * replace working data. The exact current value and live lease must still match.
 */
export async function rollbackFactoryBuildAttempt(input:{versionId:string;leaseToken:string;stage:FactoryBuildStage;kind:"review"|"repair"|"correction";expectedValue:number|boolean;previousValue?:number|boolean}){
  if(input.stage!=="qa"||!["review","repair","correction"].includes(input.kind))throw new FactoryInputError("Only a website QA attempt can be restored.");
  if(input.kind!=="repair"){
    const previous=input.previousValue===undefined?0:input.previousValue;
    const maximum=input.kind==="review"?maximumReviewAttempts:maximumCorrectionAttempts;
    if(typeof previous!=="number"||!Number.isInteger(previous)||previous<0||previous>=maximum||input.expectedValue!==previous+1)throw new FactoryInputError("Invalid review or correction attempt restoration.");
  }else if(input.expectedValue!==true||(input.previousValue!==undefined&&input.previousValue!==false))throw new FactoryInputError("Invalid repair attempt restoration.");
  const field=input.kind==="review"?"reviewAttempts":input.kind==="correction"?"correctionAttempts":"repaired";
  return buildTransaction(async db=>{
    const row=await lockedVersion(db,input.versionId);
    if(row.status!=="running"||row.lease_token!==input.leaseToken||row.stage!==input.stage||new Date(row.lease_until).getTime()<=Date.now()||row.working_data[field]!==input.expectedValue)return false;
    const available=await db.query(`SELECT 1 FROM factory_projects p JOIN workspaces w ON w.id=p.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE p.id=$1 AND p.workspace_id=$2 AND w.status='active' AND l.anonymized_at IS NULL`,[row.project_id,row.workspace_id]);
    if(!available.rowCount)return false;
    const updated=await db.query(`UPDATE factory_build_versions SET working_data=(CASE WHEN $6::jsonb IS NULL THEN working_data-$4::text ELSE jsonb_set(working_data,ARRAY[$4::text],$6::jsonb,true) END)-$7::text[],updated_at=now() WHERE id=$1 AND lease_token=$2 AND stage=$3 AND status='running' AND lease_until>now() AND working_data->$4::text=$5::jsonb`,[input.versionId,input.leaseToken,input.stage,field,JSON.stringify(input.expectedValue),input.previousValue===undefined?null:JSON.stringify(input.previousValue),input.kind==="correction"?["correctionPending"]:[]]);
    return Boolean(updated.rowCount);
  });
}
/** The content is already approved, QA-passed, published and privately verified.
 * Open a short, lease-bound public check before announcing workflow readiness. */
export async function openFactoryPublicVerification(input:Pick<FactoryBuildFinish,"versionId"|"leaseToken"|"manifest"|"verification">){
  return buildTransaction(async db=>{
    const row=await activeBuild(db,input.versionId,input.leaseToken);if(!row||row.stage!=="verify"||row.revoked_at||new Date(row.expires_at).getTime()<=Date.now())return false;
    const checked=Date.parse(input.verification.checkedAt);
    if(!row.qa_report?.passed||!hasFactoryIdentity(input.manifest)||!isDeepStrictEqual(input.manifest,row.manifest)||input.verification.url!==factoryPreviewUrl(row.preview_token)||input.verification.status!==200||!Number.isFinite(checked)||checked>Date.now()||checked<Date.now()-300000)throw new FactoryInputError("Verify the checked website before its public sharing check.");
    const window={leaseToken:input.leaseToken,manifestHash:factoryManifestFingerprint(input.manifest),checkedAt:new Date().toISOString()};
    await db.query("UPDATE factory_build_versions SET working_data=jsonb_set(working_data,'{publicVerification}',$3::jsonb,true),updated_at=now() WHERE id=$1 AND lease_token=$2",[row.id,input.leaseToken,JSON.stringify(window)]);
    return true;
  });
}
export async function finishFactoryBuild(input:FactoryBuildFinish){
  return buildTransaction(async db=>{
    const row=await activeBuild(db,input.versionId,input.leaseToken);if(!row||row.stage!=="verify"||row.revoked_at||new Date(row.expires_at).getTime()<=Date.now())return false;
    validateArtifacts(row.storage_prefix,input.manifest,input.qaReport,input.sourceKey);
    const expected=factoryPreviewUrl(row.preview_token),checked=Date.parse(input.verification.checkedAt);
    if(!expected||input.verification.url!==expected||input.verification.status!==200||!Number.isFinite(checked)||checked>Date.now()+30000||checked<Date.now()-300000)throw new FactoryInputError("Verify the real hosted preview before marking this website ready.");
    if(!isDeepStrictEqual(input.manifest,row.manifest)||input.sourceKey!==row.source_key)throw new FactoryInputError("The verified preview must match the published artifact manifest.");
    if(hasFactoryIdentity(input.manifest)){
      const receipt=input.verification.public,time=Date.parse(receipt?.checkedAt||"");
      const publicWindow=row.working_data.publicVerification as {checkedAt?:string}|undefined;
      if(!Number.isFinite(time)||time<Date.parse(publicWindow?.checkedAt||""))throw new FactoryInputError("Verify the public sharing link again for this build attempt.");
      if(!factoryPublicWindowOpen({status:row.status,stage:row.stage,leaseToken:row.lease_token,leaseUntil:row.lease_until,manifest:row.manifest,qaPassed:row.qa_report?.passed===true,window:row.working_data.publicVerification})||!receipt||receipt.url!==factoryShareUrl(row.preview_token,row.preview_slug)||receipt.status!==200||receipt.manifestHash!==factoryManifestFingerprint(row.manifest)||!Number.isFinite(time)||time>Date.now()+30000||time<Date.now()-300000)throw new FactoryInputError("Verify the public sharing link and identity assets before marking this website ready.");
    }
    const snapshot=factoryDraftSnapshot(row.working_data,row.storage_prefix);
    await db.query(`UPDATE factory_build_versions SET status='ready',manifest=$3::jsonb,qa_report=$4::jsonb,source_key=$5,verification=$6::jsonb,draft_snapshot=$7::jsonb,working_data='{}',lease_token=NULL,lease_until=NULL,ready_at=now(),notified_at=now(),updated_at=now() WHERE id=$1 AND lease_token=$2`,[input.versionId,input.leaseToken,JSON.stringify(input.manifest),JSON.stringify(input.qaReport),input.sourceKey,JSON.stringify(input.verification),snapshot?JSON.stringify(snapshot):null]);
    await db.query("UPDATE factory_build_requests SET status='ready' WHERE id=$1",[row.build_request_id]);
    await db.query(`INSERT INTO factory_messages(id,workspace_id,project_id,role,body,request_id) VALUES($1,$2,$3,'assistant',$4,$5) ON CONFLICT(project_id,request_id) DO NOTHING`,[randomUUID(),row.workspace_id,row.project_id,`Website version ${row.version} is ready. Open its preview or download the source from the website build panel.`,`build-ready:${row.id}`]);
    await insertAuditLog(db,{workspaceId:row.workspace_id,action:"factory.build_ready",targetType:"factory_project",targetId:row.project_id,metadata:{versionId:row.id,version:row.version}});return true;
  });
}
export async function failFactoryBuild(input:{versionId:string;leaseToken:string;error:string}){
  return buildTransaction(async db=>{
    const exists=(await db.query("SELECT project_id FROM factory_build_versions WHERE id=$1",[input.versionId])).rows[0];if(!exists)return false;
    const row=await lockedVersion(db,input.versionId);
    if(row.status!=="running"||row.lease_token!==input.leaseToken)return false;
    await db.query("UPDATE factory_build_versions SET status='failed',error=$2,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",[row.id,input.error.slice(0,1000)]);
    await db.query("UPDATE factory_build_requests SET status='failed' WHERE id=$1",[row.build_request_id]);return true;
  });
}
export async function recoverFactoryBuilds(){
  return buildTransaction(async db=>{
    // A process may die after reserving metadata or after PUT but before marking
    // the upload ready. Its deletion trigger preserves a two-pass storage cleanup.
    await db.query("DELETE FROM factory_uploads WHERE status='pending' AND created_at<now()-interval '15 minutes'");
    const rows=await db.query("SELECT v.id,v.build_request_id FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id WHERE v.status='running' AND v.lease_until<=now() FOR UPDATE OF p SKIP LOCKED LIMIT 30");
    for(const row of rows.rows){await db.query("UPDATE factory_build_versions SET status='failed',error='Website building was interrupted. Review its progress and retry explicitly.',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",[row.id]);await db.query("UPDATE factory_build_requests SET status='failed' WHERE id=$1",[row.build_request_id]);}
    await db.query(`UPDATE factory_build_costs c SET status=CASE WHEN attempted_at IS NULL THEN 'released' ELSE 'uncertain' END WHERE c.status='reserved' AND (c.version_id IS NULL OR NOT EXISTS(SELECT 1 FROM factory_build_versions v WHERE v.id=c.version_id AND v.status='running' AND v.lease_until>now()))`);
    return rows.rowCount||0;
  });
}
export async function retryFactoryBuild(context:DashboardContext,input:unknown){
  const data=retrySchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");const row=await lockedVersion(db,data.versionId,context.workspace.id);
    const request=`${context.user.id}:${data.requestId}`;
    if((await db.query("SELECT 1 FROM factory_build_retries WHERE version_id=$1 AND request_key=$2",[row.id,request])).rowCount)return {projectId:row.project_id};
    if(row.status!=="failed")throw new FactoryInputError("Only a failed website build can be retried.");
    if(row.stage==="qa"&&Number(row.working_data?.reviewAttempts)>=maximumReviewAttempts&&factoryBuildRecovery(row.error,Number(row.working_data?.reviewAttempts)||0).kind==="plan")throw new FactoryInputError("This version has no visual reviews remaining. Review the saved findings and create a checked revision within the existing allowance, or approve a revised plan for a different direction.");
    if((await db.query("SELECT 1 FROM factory_build_versions WHERE project_id=$1 AND workspace_id=$2 AND id<>$3 AND (version>$4 OR status IN ('queued','running')) LIMIT 1",[row.project_id,context.workspace.id,row.id,row.version])).rowCount)throw new FactoryInputError("Open the newest website version before retrying. Earlier drafts stay preserved in version history.");
    if(row.retry_count>=3)throw new FactoryInputError("This website version has reached its three retry limit. Review the failure before requesting another approved version.");
    await db.query("INSERT INTO factory_build_retries(version_id,request_key) VALUES($1,$2)",[row.id,request]);
    await db.query("UPDATE factory_build_versions SET status='queued',retry_count=retry_count+1,error=NULL,updated_at=now() WHERE id=$1",[row.id]);
    await db.query("UPDATE factory_build_requests SET status='queued' WHERE id=$1",[row.build_request_id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.build_retried",targetType:"factory_project",targetId:row.project_id,metadata:{versionId:row.id}});return {projectId:row.project_id};
  });
}
async function sharing(context:DashboardContext,input:unknown,restore:boolean){
  const data=versionSchema.parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");const row=await lockedVersion(db,data.versionId,context.workspace.id);
    if(row.status!=="ready")throw new FactoryInputError("Preview sharing is available after this website is ready.");
    await db.query(restore?"UPDATE factory_build_versions SET revoked_at=NULL,expires_at=now()+interval '90 days',updated_at=now() WHERE id=$1":"UPDATE factory_build_versions SET revoked_at=now(),updated_at=now() WHERE id=$1",[row.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:restore?"factory.preview_restored":"factory.preview_revoked",targetType:"factory_project",targetId:row.project_id,metadata:{versionId:row.id}});return {projectId:row.project_id};
  });
}
export async function revokeFactoryPreview(context:DashboardContext,input:unknown){return sharing(context,input,false);}
export async function restoreFactoryPreview(context:DashboardContext,input:unknown){return sharing(context,input,true);}
export async function registerFactoryUpload(context:DashboardContext,input:unknown){
  const data=z.object({projectId:uuid,filename:z.string().trim().min(1).max(180).refine(s=>!s.includes("/")&&!s.includes("\\")&&!hasControl(s)),role:z.enum(["photo","logo"]).default("photo"),alt:z.string().trim().max(240).refine(s=>!hasControl(s)).default(""),contentType:z.enum(["image/png","image/jpeg","image/webp"]),byteSize:z.number().int().min(1).max(10485760),sha256:z.string().regex(/^[0-9a-f]{64}$/)}).parse(input);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const project=await db.query("SELECT id FROM factory_projects WHERE id=$1 AND workspace_id=$2 FOR UPDATE",[data.projectId,context.workspace.id]);if(!project.rowCount)throw new FactoryInputError("This planning workspace is no longer available.");
    if(data.role==="logo"&&(await db.query("SELECT 1 FROM factory_uploads WHERE project_id=$1 AND workspace_id=$2 AND role='logo' LIMIT 1",[data.projectId,context.workspace.id])).rowCount)throw new FactoryInputError("Remove the existing logo before adding its replacement.");
    const totals=(await db.query("SELECT count(*)::int count,COALESCE(sum(byte_size),0)::bigint size FROM factory_uploads WHERE project_id=$1 AND workspace_id=$2",[data.projectId,context.workspace.id])).rows[0];if(totals.count>=20||Number(totals.size)+data.byteSize>52428800)throw new FactoryInputError("This website already has its 20-file or 50 MB upload allowance.");
    const id=randomUUID(),ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[data.contentType],storageKey=`factory/${context.workspace.id}/${data.projectId}/uploads/${id}.${ext}`;
    await db.query("INSERT INTO factory_uploads(id,workspace_id,project_id,storage_key,filename,content_type,byte_size,sha256,created_by,role,alt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[id,context.workspace.id,data.projectId,storageKey,data.filename,data.contentType,data.byteSize,data.sha256,context.user.id,data.role,data.alt]);return {id,storageKey};
  });
}
export async function completeFactoryUpload(context:DashboardContext,uploadId:string){
  uuid.parse(uploadId);return factoryTransaction(context.workspace.id,async db=>{await authorizeFactory(db,context,"edit");await db.query("SELECT p.id FROM factory_projects p JOIN factory_uploads u ON u.project_id=p.id AND u.workspace_id=p.workspace_id WHERE u.id=$1 AND u.workspace_id=$2 FOR UPDATE OF p",[uploadId,context.workspace.id]);const row=(await db.query("UPDATE factory_uploads SET status='ready' WHERE id=$1 AND workspace_id=$2 RETURNING project_id",[uploadId,context.workspace.id])).rows[0];if(!row)throw new FactoryInputError("This upload was removed before it finished.");return {projectId:row.project_id};});
}
export async function deleteFactoryUpload(context:DashboardContext,input:unknown){
  const data=z.object({uploadId:uuid}).parse(input);return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const project=(await db.query("SELECT p.id FROM factory_projects p JOIN factory_uploads u ON u.project_id=p.id AND u.workspace_id=p.workspace_id WHERE u.id=$1 AND u.workspace_id=$2 FOR UPDATE OF p",[data.uploadId,context.workspace.id])).rows[0];
    // Failed builds that have exhausted their retry allowance can no longer
    // resume. Their old input snapshot must not prevent replacing assets for a
    // newly approved version; queued/running and retryable builds still need it.
    if(project&&(await db.query("SELECT 1 FROM factory_build_versions WHERE project_id=$1 AND workspace_id=$2 AND (status IN ('queued','running') OR (status='failed' AND retry_count<3)) AND stage IN ('generate','images') AND working_data->'inputUploads' @> $3::jsonb LIMIT 1",[project.id,context.workspace.id,JSON.stringify([{id:data.uploadId}])])).rowCount)throw new FactoryInputError("This image is part of an approved build. Remove it after the build has prepared its images.");
    const row=(await db.query("DELETE FROM factory_uploads WHERE id=$1 AND workspace_id=$2 RETURNING project_id",[data.uploadId,context.workspace.id])).rows[0];return {projectId:row?.project_id};
  });
}
export async function claimFactoryStorageCleanup(){
  return buildTransaction(async db=>{const token=randomUUID();const row=(await db.query(`UPDATE factory_storage_cleanup SET status='running',lease_token=$1,lease_until=now()+interval '10 minutes',attempts=attempts+1 WHERE id=(SELECT id FROM factory_storage_cleanup WHERE (status='queued' OR (status='running' AND lease_until<=now())) AND available_at<=now() ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,storage_prefix,passes`,[token])).rows[0];return row?{id:row.id,storagePrefix:row.storage_prefix,passes:row.passes,leaseToken:token}:null;});
}
export async function finishFactoryStorageCleanup(input:{id:string;leaseToken:string;success:boolean}){
  await getDatabasePool().query(`UPDATE factory_storage_cleanup SET status=CASE WHEN $3 AND passes>=1 THEN 'done' ELSE 'queued' END,passes=passes+CASE WHEN $3 THEN 1 ELSE 0 END,available_at=now()+CASE WHEN $3 THEN interval '30 minutes' ELSE interval '5 minutes' END,lease_token=NULL,lease_until=NULL,finished_at=CASE WHEN $3 AND passes>=1 THEN now() ELSE NULL END,error=CASE WHEN $3 THEN NULL ELSE 'Storage cleanup needs another attempt.' END WHERE id=$1 AND lease_token=$2 AND status='running'`,[input.id,input.leaseToken,input.success]);
}
