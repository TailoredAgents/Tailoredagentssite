import "server-only";
import {createHash} from "node:crypto";
import type {DashboardContext} from "@/lib/dashboard/data";
import {authorizeFactory,factoryTransaction} from "./data";
import {FactoryInputError} from "./types";
import {factoryDraftFingerprint,factoryDraftSnapshot} from "./draft-snapshot";
import {zipSiteFiles,type SiteFiles} from "./site/artifacts";
import {parseFactoryDraftDiagnostic} from "./site/diagnostic";
import type {FactoryStorage} from "./storage";

async function diagnosticReference(context:DashboardContext,versionId:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId))throw new FactoryInputError("Choose an available website draft.");
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"manage");
    const row=(await db.query(`SELECT v.version,v.status,v.storage_prefix,v.working_data,v.draft_snapshot,pl.content approved_plan
      FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id AND p.workspace_id=v.workspace_id
      JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL
      JOIN factory_build_requests r ON r.id=v.build_request_id AND r.workspace_id=v.workspace_id
      JOIN factory_plans pl ON pl.id=r.plan_id AND pl.workspace_id=r.workspace_id
      WHERE v.id=$1 AND v.workspace_id=$2 AND v.status IN ('failed','ready')`,[versionId,context.workspace.id])).rows[0];
    const snapshot=row?factoryDraftSnapshot(row.status==="ready"?row.draft_snapshot:row.working_data,row.storage_prefix):null;
    if(!snapshot)throw new FactoryInputError("This website has no complete diagnostic draft.");
    const assets=Object.entries(snapshot.imageAssets).map(([id,asset])=>({id,role:id==="hero"?"photo":snapshot.blueprint.media?.find(media=>media.id===id)?.role,file:`images/${id}.png`,sha256:asset.sha256}));
    const diagnostic=parseFactoryDraftDiagnostic({version:1,kind:"factory-draft-diagnostic",websiteVersion:row.version,plan:row.approved_plan,blueprint:snapshot.blueprint,assets});
    return {diagnostic,snapshot,fingerprint:factoryDraftFingerprint(snapshot)};
  });
}

/** Private administrator download for local rendering; never runs a provider or publishes. */
export async function downloadFactoryDraftDiagnostic(context:DashboardContext,versionId:string,storage:Pick<FactoryStorage,"get">){
  const reference=await diagnosticReference(context,versionId);
  const files:SiteFiles={"draft.json":Buffer.from(JSON.stringify(reference.diagnostic,null,2))};
  let total=0;
  for(const asset of reference.diagnostic.assets){
    const saved=reference.snapshot.imageAssets[asset.id];
    const bytes=await storage.get(saved.key,8_000_000);
    total+=bytes.byteLength;
    if(!bytes.byteLength||bytes.byteLength>8_000_000||total>40_000_000||createHash("sha256").update(bytes).digest("hex")!==asset.sha256)throw new FactoryInputError("A saved draft image could not be verified.");
    files[asset.file]=bytes;
  }
  // Membership, deletion, draft state and content can change during storage reads.
  const current=await diagnosticReference(context,versionId);
  if(current.fingerprint!==reference.fingerprint||JSON.stringify(current.diagnostic)!==JSON.stringify(reference.diagnostic))throw new FactoryInputError("This draft changed. Refresh before downloading it.");
  return {bytes:zipSiteFiles(files),filename:`website-v${reference.diagnostic.websiteVersion}-private-diagnostic.zip`};
}
