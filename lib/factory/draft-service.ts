import "server-only";
import {randomBytes,randomUUID} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {z} from "zod";
import type {PoolClient} from "pg";
import type {DashboardContext} from "@/lib/dashboard/data";
import {insertAuditLog} from "@/lib/dashboard/db";
import {authorizeFactory,factoryTransaction} from "./data";
import {FactoryInputError} from "./types";
import {factoryBuildConfiguration} from "./build-config";
import {factoryBuildAssetDescriptors} from "./build-assets";
import {validateSiteBlueprint} from "./site/validate";
import {applySiteDraftPatches,parseSiteDraftPatches,siteDraftContentSchema,siteDraftTargetSchema,type SiteDraftPatch} from "./site/draft";
import type {FactoryDraftDocument,FactoryDraftRevision} from "./draft-types";
import {factoryDraftSnapshot,factoryDraftFingerprint as fingerprint} from "./draft-snapshot";

const uuid=z.string().uuid();
const costSum="COALESCE(sum(CASE WHEN c.status='settled' THEN c.actual_micros WHEN c.status IN ('reserved','uncertain') THEN c.reserved_micros ELSE 0 END),0)";
async function versionRow(db:PoolClient,context:DashboardContext,id:string,lock=false){
  if(lock)await db.query(`SELECT p.id FROM factory_projects p JOIN factory_build_versions v ON v.project_id=p.id AND v.workspace_id=p.workspace_id WHERE v.id=$1 AND v.workspace_id=$2 FOR UPDATE OF p`,[id,context.workspace.id]);
  const row=(await db.query(`SELECT v.*,pl.content approved_plan FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id AND p.workspace_id=v.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id JOIN factory_build_requests r ON r.id=v.build_request_id AND r.workspace_id=v.workspace_id JOIN factory_plans pl ON pl.id=r.plan_id AND pl.workspace_id=r.workspace_id WHERE v.id=$1 AND v.workspace_id=$2 AND l.anonymized_at IS NULL ${lock?"FOR UPDATE OF v":""}`,[id,context.workspace.id])).rows[0];
  if(!row)throw new FactoryInputError("This website draft is no longer available.");
  return row;
}
function savedDraft(row:Record<string,unknown>){
  if(row.status!=="failed"&&row.status!=="ready")throw new FactoryInputError("Wait for this website to finish before editing its draft.");
  const snapshot=factoryDraftSnapshot(row.status==="ready"?row.draft_snapshot:row.working_data,String(row.storage_prefix));
  if(!snapshot)throw new FactoryInputError("This version does not have a complete editable draft with saved images.");
  return snapshot;
}
async function allowance(db:PoolClient,workspaceId:string,requestId:string){
  const settings=(await db.query("SELECT * FROM factory_build_settings WHERE workspace_id=$1",[workspaceId])).rows[0];
  const spent=Number((await db.query(`SELECT ${costSum} used FROM factory_build_costs c JOIN factory_build_versions v ON v.id=c.version_id WHERE v.build_request_id=$1 AND c.workspace_id=$2`,[requestId,workspaceId])).rows[0].used);
  return {settings,spent,remaining:Math.max(0,Number(settings?.per_build_budget_micros??0)-spent)};
}
export async function getFactoryDraft(context:DashboardContext,versionId:string):Promise<FactoryDraftDocument>{
  uuid.parse(versionId);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const row=await versionRow(db,context,versionId),snapshot=savedDraft(row),budget=await allowance(db,context.workspace.id,row.build_request_id);
    return {versionId:row.id,fingerprint:fingerprint(snapshot),parentVersionId:row.parent_version_id,spentMicros:budget.spent,remainingMicros:budget.remaining,
      pages:snapshot.blueprint.pages.map(page=>({path:page.path,title:page.title,hero:{headline:page.hero.headline,body:page.hero.body},sections:page.sections.map(section=>({id:section.id,title:section.title,body:section.body,layout:section.layout,items:section.items}))}))};
  });
}
const revisionSchema=z.object({versionId:uuid,fingerprint:z.string().regex(/^[0-9a-f]{64}$/),requestId:uuid,mode:z.enum(["manual","ai","restore"]),pagePath:z.string().optional(),sectionId:z.string().optional(),headline:z.string().optional(),body:z.string().optional(),layout:z.string().nullable().optional(),items:z.unknown().optional(),patches:z.unknown().optional(),instruction:z.string().trim().max(2000).optional()});
export async function reviseFactoryDraft(context:DashboardContext,input:unknown){
  const data=revisionSchema.parse(input);
  if(data.patches!==undefined&&data.mode!=="manual")throw new FactoryInputError("Saved section changes can only be applied as a manual revision.");
  // A submitted batch is authoritative; old single-section fields may still exist in the form.
  let patches:SiteDraftPatch[]|undefined=data.patches===undefined?undefined:parseSiteDraftPatches(data.patches);
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    const row=await versionRow(db,context,data.versionId,true);
    const repeated=(await db.query(`SELECT v.id FROM factory_build_versions v JOIN factory_messages m ON m.id=v.message_id AND m.project_id=v.project_id WHERE v.project_id=$1 AND v.workspace_id=$2 AND m.request_id=$3`,[row.project_id,context.workspace.id,`draft:${data.requestId}`])).rows[0];
    if(repeated)return {projectId:row.project_id,versionId:repeated.id};
    let source=row,snapshot=savedDraft(row);
    if(fingerprint(snapshot)!==data.fingerprint)throw new FactoryInputError("This draft changed. Refresh it before applying your changes.");
    if((await db.query("SELECT 1 FROM factory_build_versions WHERE project_id=$1 AND workspace_id=$2 AND (status IN ('queued','running') OR version>$3) LIMIT 1",[row.project_id,context.workspace.id,row.version])).rowCount)throw new FactoryInputError("Open the newest website version and wait for any current build before editing.");
    if(data.mode==="restore"){
      if(!row.parent_version_id)throw new FactoryInputError("This draft has no previous revision to restore.");
      source=await versionRow(db,context,row.parent_version_id,true);
      if(source.build_request_id!==row.build_request_id)throw new FactoryInputError("Restoring must keep the same approved plan.");
      snapshot=savedDraft(source);
    }
    const target=data.mode==="restore"||patches?undefined:siteDraftTargetSchema.parse({pagePath:data.pagePath,sectionId:data.sectionId});
    let blueprint=snapshot.blueprint;
    if(data.mode==="manual"){
      if(!patches){
        let items=data.items;
        if(typeof items==="string"){if(items.length>15000)throw new FactoryInputError("The section items are too long.");try{items=JSON.parse(items);}catch{throw new FactoryInputError("Review the section items before saving.");}}
        patches=[{target:target!,content:siteDraftContentSchema.parse({headline:data.headline,body:data.body??"",layout:data.layout||null,items:items??null})}];
      }
      blueprint=applySiteDraftPatches(blueprint,patches);
      if(isDeepStrictEqual(blueprint,snapshot.blueprint))throw new FactoryInputError("Make a change before checking a new revision.");
    }else if(data.mode==="ai"){
      if(!data.instruction)throw new FactoryInputError("Describe the change you want in this section.");
      const page=blueprint.pages.find(page=>page.path===target!.pagePath);
      if(!page||(target!.sectionId!=="__intro__"&&!page.sections.some(section=>section.id===target!.sectionId)))throw new FactoryInputError("Choose an existing page and section.");
    }
    blueprint=validateSiteBlueprint(blueprint,row.approved_plan,factoryBuildAssetDescriptors({uploads:snapshot.inputUploads}));
    const budget=await allowance(db,context.workspace.id,row.build_request_id);
    if(!budget.settings?.enabled||!budget.settings.budget_approved_at||!factoryBuildConfiguration().configured)throw new FactoryInputError("Website building is paused or not configured.");
    if(budget.remaining<=0)throw new FactoryInputError("This approved website has used its build allowance, including previous revisions. An owner can review the allowance in Website Builder settings.");
    const id=randomUUID(),messageId=randomUUID(),prefix=`factory/${context.workspace.id}/${row.project_id}/${id}/`;
    const revision:FactoryDraftRevision={version:1,sourceVersionId:source.id,sourcePrefix:source.storage_prefix,sourceImageAssets:snapshot.imageAssets,sourceHeroKey:snapshot.heroKey,sourceProvenance:snapshot.provenance,mode:data.mode,...(target?{target}:{}),...(data.mode==="ai"?{instruction:data.instruction}:{})};
    const state={blueprint,inputUploads:snapshot.inputUploads,draftRevision:revision,correctionAttempts:0};
    const summary=data.mode==="restore"?`Restore the saved draft from website version ${source.version} and check it again.`:data.mode==="ai"?`Revise ${target!.pagePath} / ${target!.sectionId}: ${data.instruction}`:patches!.length===1?`Update the wording or layout of ${patches![0].target.pagePath} / ${patches![0].target.sectionId} and check the website.`:`Update ${patches!.length} website sections together and check the website: ${patches!.map(patch=>`${patch.target.pagePath} / ${patch.target.sectionId}`).join(", ")}.`;
    await db.query("INSERT INTO factory_messages(id,workspace_id,project_id,role,body,request_id) VALUES($1,$2,$3,'user',$4,$5)",[messageId,context.workspace.id,row.project_id,summary,`draft:${data.requestId}`]);
    await db.query(`INSERT INTO factory_build_versions(id,workspace_id,project_id,build_request_id,version,kind,parent_version_id,message_id,stage,storage_prefix,preview_token,created_by,working_data) SELECT $1,$2,$3,$4,COALESCE(max(version),0)+1,'revision',$5,$6,$7,$8,$9,$10,$11::jsonb FROM factory_build_versions WHERE project_id=$3 AND workspace_id=$2`,[id,context.workspace.id,row.project_id,row.build_request_id,row.id,messageId,data.mode==="ai"?"generate":"images",prefix,randomBytes(24).toString("hex"),context.user.id,JSON.stringify(state)]);
    await db.query("UPDATE factory_build_requests SET status='queued' WHERE id=$1",[row.build_request_id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.draft_revision_queued",targetType:"factory_project",targetId:row.project_id,metadata:{versionId:id,parentVersionId:row.id,sourceVersionId:source.id,mode:data.mode,target:target??null,...(patches?{targets:patches.map(patch=>patch.target)}:{})}});
    return {projectId:row.project_id,versionId:id};
  });
}
