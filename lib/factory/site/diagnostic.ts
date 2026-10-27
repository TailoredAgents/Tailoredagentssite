/** Portable, private draft diagnostics. This module does not read a database,
 * storage service or provider. It accepts only a saved plan, blueprint and exact
 * normalized image files so the current renderer can be checked locally. */
import {createHash} from "node:crypto";
import {z} from "zod";
import {factoryPlanSchema} from "../plan-schema";
import {preparePortableImages,preparePortableLogo,portableImageLimits,portableMobileImageBudget} from "./images";
import {validateSiteBlueprint,siteBlueprintSchema} from "./validate";
import type {SiteFiles} from "./artifacts";

export const factoryDiagnosticLimits={jsonBytes:500_000,assetBytes:portableImageLimits.sourceBytes,totalAssetBytes:40_000_000} as const;
const sourceSchema=z.object({id:z.string().min(1).max(80),title:z.string().max(300),url:z.string().url().max(2000),retrievedAt:z.string().max(100),evidence:z.string().max(1000)}).strict();
const assetSchema=z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),role:z.enum(["photo","logo"]),file:z.string().max(100),sha256:z.string().regex(/^[0-9a-f]{64}$/)}).strict();
const diagnosticSchema=z.object({version:z.literal(1),kind:z.literal("factory-draft-diagnostic"),websiteVersion:z.number().int().positive().optional(),plan:factoryPlanSchema.extend({sources:z.array(sourceSchema).max(24)}),blueprint:siteBlueprintSchema,assets:z.array(assetSchema).min(1).max(5)}).strict();
export type FactoryDraftDiagnostic=z.infer<typeof diagnosticSchema>;

/** Reject unknown top-level state and paths rather than copying an arbitrary
 * worker snapshot, archive manifest or a storage URL into a diagnostic. */
export function parseFactoryDraftDiagnostic(value:unknown):FactoryDraftDiagnostic{
  if(Buffer.byteLength(JSON.stringify(value)??"")>factoryDiagnosticLimits.jsonBytes)throw new Error("The saved draft diagnostic exceeds its content limit.");
  const diagnostic=diagnosticSchema.parse(value);
  // Upload authorization happened against the approval's frozen uploads before
  // export. Replay retains the saved bindings but does not grant new uploads or
  // need their private storage keys/metadata to check content and rendering.
  diagnostic.blueprint=validateSiteBlueprint(diagnostic.blueprint,diagnostic.plan);
  const expected=new Map<string,"photo"|"logo">([["hero","photo"],...(diagnostic.blueprint.media||[]).map(asset=>[asset.id,asset.role] as const)]);
  if(diagnostic.assets.length!==expected.size)throw new Error("The diagnostic must include exactly the saved website images.");
  const seen=new Set<string>();
  for(const asset of diagnostic.assets){
    if(seen.has(asset.id)||expected.get(asset.id)!==asset.role||asset.file!==`images/${asset.id}.png`)throw new Error("The diagnostic contains an unexpected or duplicate image path.");
    seen.add(asset.id);
  }
  return diagnostic;
}

/** The loader is supplied by the caller: local files in the replay CLI, or
 * authorized canonical storage objects in the diagnostic download handler. */
export async function prepareFactoryDiagnosticAssets(diagnostic:FactoryDraftDiagnostic,load:(file:string,maximumBytes:number)=>Promise<Uint8Array>):Promise<SiteFiles>{
  const parsed=parseFactoryDraftDiagnostic(diagnostic),files:SiteFiles={};let total=0;
  const photoCount=parsed.assets.filter(asset=>asset.role==="photo").length;
  for(const asset of parsed.assets){
    const bytes=await load(asset.file,factoryDiagnosticLimits.assetBytes);total+=bytes.byteLength;
    if(bytes.byteLength>factoryDiagnosticLimits.assetBytes||total>factoryDiagnosticLimits.totalAssetBytes)throw new Error("The saved draft images exceed the diagnostic size limit.");
    if(createHash("sha256").update(bytes).digest("hex")!==asset.sha256)throw new Error(`The saved ${asset.id} image does not match its diagnostic fingerprint.`);
    Object.assign(files,asset.role==="logo"?await preparePortableLogo(bytes,asset.id):await preparePortableImages(bytes,asset.id,{mobileBytes:portableMobileImageBudget(photoCount)}));
  }
  return files;
}
