import "server-only";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {chromium} from "playwright";
import {factoryBuildConfiguration,factoryStorageConfiguration} from "./build-config";
import {factoryPreviewUrl} from "./build-data";
import {factoryStorage,type FactoryStorage} from "./storage";
import {claimFactoryBuild,saveFactoryBuildStage,saveFactoryBuildProgress,rollbackFactoryBuildAttempt,finishFactoryBuild,failFactoryBuild,recoverFactoryBuilds,claimFactoryStorageCleanup,finishFactoryStorageCleanup} from "./build-service";
import {FactoryBuildBudgetError} from "./build-budget";
import {factorySiteExecutor,generateFactoryHero,FactoryBuildRequestNotAttemptedError} from "./build-provider";
import {generatePortableSite} from "./site/provider";
import {portableBundle,validateSiteBlueprint} from "./site/validate";
import {renderPortableSite} from "./site/render";
import {reviewSiteDepth} from "./site/quality";
import {checkPortableSite} from "./site/qa";
import {screenshotPath} from "./site/qa";
import {preparePortableImages} from "./site/images";
import {reviewPortableSite,type SiteReview} from "./site/review";
import {checkSiteDelivery} from "./site/performance";
import {createPortableExport} from "./site/package";
import type {SiteFiles,SiteQaResult} from "./site/artifacts";
import type {SiteModelExecutor,SiteBlueprint} from "./site/types";
import type {FactoryClaimedBuild,FactoryBuildManifest,FactoryBuildQa} from "./build-types";

type Working={blueprint?:SiteBlueprint;heroKey?:string;provenance?:unknown;qaReport?:FactoryBuildQa;manifest?:FactoryBuildManifest;sourceKey?:string;repaired?:boolean;
  reviewAttempts?:number;review?:{fingerprint:string;result:SiteReview};checkedManifest?:FactoryBuildManifest};
class FactoryBuildQualityError extends Error{}
export type FactoryBuildRuntime={storage:FactoryStorage;execute(build:FactoryClaimedBuild):SiteModelExecutor;hero(build:FactoryClaimedBuild,prompt:string):Promise<{bytes:Uint8Array;provenance:unknown}>;qa(files:SiteFiles):Promise<SiteQaResult>;verify(build:FactoryClaimedBuild,manifest:FactoryBuildManifest):Promise<{url:string;status:200;checkedAt:string}>};
function working(build:FactoryClaimedBuild):Working{return build.workingData as Working;}
function checkDeadline(build:FactoryClaimedBuild){if(!Number.isFinite(Date.parse(build.leaseUntil))||Date.parse(build.leaseUntil)<=Date.now())throw new Error("The website worker lease expired.");}
async function withSite(build:FactoryClaimedBuild,state:Working,runtime:FactoryBuildRuntime){
  if(!state.blueprint||state.heroKey!==`${build.storagePrefix}assets/hero.png`)throw new Error("The saved website assets are incomplete.");
  const blueprint=validateSiteBlueprint(state.blueprint,build.plan),bundle=portableBundle(blueprint);
  const image=await runtime.storage.get(state.heroKey,8_000_000);
  return {bundle,...renderPortableSite(bundle,await preparePortableImages(image))};
}
export async function verifyHostedFactoryBuild(build:FactoryClaimedBuild,manifest:FactoryBuildManifest){
  const url=factoryPreviewUrl(build.previewToken);if(!url)throw new Error("The preview domain is not configured.");
  const secret=(process.env.FACTORY_PREVIEW_SECRET||"").trim();if(secret.length<32)throw new Error("Preview verification is not configured.");
  for(const file of manifest.files){
    checkDeadline(build);
    const response=await fetch(new URL(file.path,url),{redirect:"error",cache:"no-store",headers:{"x-factory-verify":secret},signal:AbortSignal.timeout(15000)});
    if(response.status!==200||!response.headers.get("x-robots-tag")?.includes("noindex")||!response.headers.get("content-security-policy")?.includes("form-action 'none'")||response.headers.get("content-type")?.split(";")[0]!==file.contentType.split(";")[0]){await response.body?.cancel();throw new Error("The hosted preview did not pass verification.");}
    if(!response.body)throw new Error("The hosted preview returned no content.");
    const reader=response.body.getReader(),hash=createHash("sha256");let size=0;
    try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>file.size){await reader.cancel();throw new Error("The hosted preview does not match the built files.");}hash.update(p.value);}}finally{reader.releaseLock();}
    if(size!==file.size||hash.digest("hex")!==file.sha256)throw new Error("The hosted preview does not match the built files.");
  }
  return {url,status:200 as const,checkedAt:new Date().toISOString()};
}
export function defaultFactoryBuildRuntime():FactoryBuildRuntime {
  return {storage:factoryStorage(),execute:factorySiteExecutor,hero:generateFactoryHero,verify:verifyHostedFactoryBuild,
    async qa(files){
      // Generated data cannot become code. Even trusted QA gets no CRM/provider credentials.
      const browserEnv:Record<string,string>={PATH:process.env.PATH||"",HOME:tmpdir(),TMPDIR:tmpdir(),TEMP:tmpdir(),TMP:tmpdir()};
      for(const key of ["SystemRoot","WINDIR","DISPLAY","PLAYWRIGHT_BROWSERS_PATH"])if(process.env[key])browserEnv[key]=process.env[key]!;
      const browser=await chromium.launch({headless:true,env:browserEnv,chromiumSandbox:process.platform==="linux"});
      try{return await checkPortableSite({files,browser});}finally{await browser.close();}
    }};
}
/** One leased, bounded stage. Test dependencies cannot be selected through environment variables. */
export async function performFactoryBuildStage(build:FactoryClaimedBuild,dependencies:FactoryBuildRuntime){
  checkDeadline(build);
  // Never start another external write after this fixed lease. Individual storage
  // requests are bounded to 60s, below the cleanup outbox's 30-minute final pass.
  const runtime:FactoryBuildRuntime={...dependencies,storage:{
    async put(...args){checkDeadline(build);await dependencies.storage.put(...args);},
    async get(...args){checkDeadline(build);return dependencies.storage.get(...args);},
    async deletePrefix(...args){checkDeadline(build);await dependencies.storage.deletePrefix(...args);},
  }};
  const state:Working={...working(build)};
  const advance=async(nextStage:"images"|"qa"|"publish"|"verify")=>{if(!await saveFactoryBuildStage({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,nextStage,workingData:state as Record<string,unknown>,manifest:state.manifest,qaReport:state.qaReport,sourceKey:state.sourceKey}))throw new Error("This website build was paused or removed.");};
  if(build.stage==="generate"){
    const result=await generatePortableSite({plan:build.plan,assets:build.uploads.map((u,i)=>({id:u.id,path:i?`reference-${i}.png`:"assets/images/hero.png",alt:"Team-provided reference image",provenance:"provided"}))},runtime.execute(build));
    state.blueprint=result.blueprint;await advance("images");return;
  }
  if(build.stage==="images"){
    if(!state.blueprint)throw new Error("The website blueprint is missing.");
    const supplied=build.uploads[0];
    if(supplied){
      const bytes=await runtime.storage.get(supplied.storageKey,8_000_000);
      state.heroKey=`${build.storagePrefix}assets/hero.png`;
      await runtime.storage.put(state.heroKey,bytes,"image/png");
      state.provenance={kind:"provided",filename:supplied.filename,uploadId:supplied.id,notice:"Image supplied by the team; confirm publishing rights before launch."};
      state.blueprint.heroImage.alt="Team-provided reference image";state.blueprint.heroImage.caption="Team-provided image for this website concept.";
    }else{
      const image=await runtime.hero(build,state.blueprint.heroImage.prompt);
      state.heroKey=`${build.storagePrefix}assets/hero.png`;await runtime.storage.put(state.heroKey,image.bytes,"image/png");state.provenance=image.provenance;
    }
    await advance("qa");return;
  }
  if(build.stage==="qa"){
    const persist=async()=>{if(!await saveFactoryBuildProgress({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,workingData:state as Record<string,unknown>}))throw new Error("This website build was paused or removed.");};
    const boundedExecute=(kind:"review"|"repair"):SiteModelExecutor=>async request=>{
      const previousReviews=state.reviewAttempts,previousRepair=state.repaired;
      // Preprocessing has completed. Save intent before entering the provider so
      // an ambiguous request cannot become an unbounded paid retry.
      if(kind==="review")state.reviewAttempts=(previousReviews||0)+1;
      else state.repaired=true;
      await persist();
      try{return await runtime.execute(build)(request);}
      catch(error){
        // Only the provider's explicit pre-request marker restores this slot.
        // Transport errors, malformed responses and settlement failures count.
        if(error instanceof FactoryBuildRequestNotAttemptedError){
          const expectedValue=kind==="review"?state.reviewAttempts!:state.repaired!;
          const previousValue=kind==="review"?previousReviews:previousRepair;
          if(!await rollbackFactoryBuildAttempt({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,kind,expectedValue,previousValue}))throw new Error("This website build was removed or its attempt changed before recovery.");
          state.reviewAttempts=previousReviews;state.repaired=previousRepair;
        }
        throw error;
      }
    };
    const inspect = async (files:SiteFiles) => {
      const browserQa=await runtime.qa(files),depth=reviewSiteDepth(state.blueprint!,build.plan),delivery=checkSiteDelivery(files);
      const issues=[...browserQa.issues,...depth,...delivery.issues];
      return {...browserQa,passed:browserQa.passed&&!issues.some(i=>i.severity==="error"),issues,delivery};
    };
    const review = async(site:Awaited<ReturnType<typeof withSite>>,qa:Awaited<ReturnType<typeof inspect>>)=>{
      if(!qa.passed)return qa;
      const fingerprint=createHash("sha256").update(JSON.stringify(site.manifest)).digest("hex");
      if(state.review?.fingerprint!==fingerprint){
        if((state.reviewAttempts||0)>=2)throw new FactoryBuildQualityError("The visual review used its two allowed attempts. Update the plan and approve a new version to continue; your previous preview is preserved.");
        const result=await reviewPortableSite({plan:build.plan,blueprint:state.blueprint!,screenshots:qa.screenshots},boundedExecute("review"));
        state.review={fingerprint,result};
        await persist();
      }
      const issues=[...qa.issues,...state.review.result.issues];
      return {...qa,issues,passed:!issues.some(i=>i.severity==="error")};
    };
    let site=await withSite(build,state,runtime),qa=await review(site,await inspect(site.files));
    if(!qa.passed&&!state.repaired){
      const revised=await generatePortableSite({plan:build.plan,previousBlueprint:state.blueprint,repairIssues:qa.issues},boundedExecute("repair"));
      state.blueprint=revised.blueprint;
      await persist();
      site=await withSite(build,state,runtime);qa=await review(site,await inspect(site.files));
    }
    if(!qa.passed)throw new FactoryBuildQualityError(`This website needs another revision after its included repair: ${qa.issues.filter(i=>i.severity==="error").slice(0,2).map(i=>i.message).join(" ").slice(0,1000)}`);
    const screenshots={desktop:`${build.storagePrefix}screenshots/desktop.png`,mobile:`${build.storagePrefix}screenshots/mobile.png`};
    for(const view of ["desktop","mobile"] as const){const shot=qa.screenshots.find(s=>s.page==="index.html"&&s.viewport===view);if(!shot)throw new Error("Desktop and mobile screenshots are required.");await runtime.storage.put(screenshots[view],shot.bytes,"image/png");}
    const pageScreenshots:NonNullable<FactoryBuildQa["pageScreenshots"]>=[];
    for(const shot of qa.screenshots){const key=`${build.storagePrefix}pages/${screenshotPath(shot.page,shot.viewport)}`;await runtime.storage.put(key,shot.bytes,"image/png");pageScreenshots.push({page:shot.page,viewport:shot.viewport,storageKey:key});}
    const visual=state.review!.result;
    state.qaReport={passed:true,checks:["Approved page identities and content depth","Distinct content and concrete business claims","Desktop and mobile visual/content review","Mobile image and page-size budgets","Desktop and mobile layouts","Local links and images","Demo navigation and forms","Serious and critical accessibility checks","No external requests"],warnings:qa.issues.filter(i=>i.severity==="warning").map(i=>i.message),screenshots,
      designReview:{summary:visual.summary,reviewedPages:visual.reviewedPages,imageCount:visual.imageCount},delivery:{pages:qa.delivery.pages},pageScreenshots};
    // Freeze the checked bytes before publication. A deployment between stages
    // must not re-render this version with a different template or encoder.
    for(const file of site.manifest.files)await runtime.storage.put(`${build.storagePrefix}checked/${file.path}`,site.files[file.path],file.contentType);
    state.checkedManifest=site.manifest;
    await advance("publish");return;
  }
  if(build.stage==="publish"){
    if(!state.checkedManifest||!state.blueprint||!state.qaReport?.passed)throw new FactoryBuildQualityError("This build does not have a frozen, reviewed website. Update its plan and approve a new version; completed previews are preserved.");
    const files:SiteFiles={};
    for(const file of state.checkedManifest.files){
      const bytes=await runtime.storage.get(`${build.storagePrefix}checked/${file.path}`,8_000_000);
      if(bytes.byteLength!==file.size||createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new FactoryBuildQualityError("A checked website artifact changed before publication. This version has not been shared.");
      files[file.path]=bytes;
    }
    const site={bundle:portableBundle(state.blueprint),files,manifest:state.checkedManifest};
    const archive=createPortableExport({files:site.files,plan:build.plan,projectTitle:site.bundle.title,productionTasks:site.bundle.productionTasks,assetProvenance:state.provenance,blueprint:state.blueprint});
    for(const file of site.manifest.files)await runtime.storage.put(`${build.storagePrefix}preview/${file.path}`,site.files[file.path],file.contentType);
    state.manifest=site.manifest;state.sourceKey=`${build.storagePrefix}source.zip`;
    await runtime.storage.put(state.sourceKey,archive.sourceZip,"application/zip");await advance("verify");return;
  }
  if(!state.manifest||!state.qaReport||!state.sourceKey)throw new Error("The published website is incomplete.");
  const verification=await runtime.verify(build,state.manifest);
  if(!await finishFactoryBuild({versionId:build.id,leaseToken:build.leaseToken,manifest:state.manifest,qaReport:state.qaReport,sourceKey:state.sourceKey,verification}))throw new Error("This website build was paused or removed.");
}
export async function runFactoryBuildWorkerStep(injected?:FactoryBuildRuntime){
  const config=factoryBuildConfiguration();
  // Privacy cleanup continues while AI generation is paused or disconnected.
  const storage=injected?.storage||(factoryStorageConfiguration()?factoryStorage():null);
  await recoverFactoryBuilds();
  const cleanup=storage?await claimFactoryStorageCleanup():null;
  if(cleanup){let success=false;try{await storage!.deletePrefix(cleanup.storagePrefix);success=true;}catch{}await finishFactoryStorageCleanup({...cleanup,success});}
  if(!injected&&!config.configured)return cleanup?{status:"cleaned" as const,more:true}:{status:"unconfigured" as const,more:false};
  const runtime=injected||defaultFactoryBuildRuntime();
  const build=await claimFactoryBuild();if(!build)return cleanup?{status:"cleaned" as const,more:true}:{status:"idle" as const,more:false};
  try{await performFactoryBuildStage(build,runtime);return {status:"processed" as const,stage:build.stage,more:true};}
  catch(error){
    const message=error instanceof FactoryBuildBudgetError||error instanceof FactoryBuildQualityError?error.message:"This website build could not complete. Check the builder connection and saved progress before retrying. Attempted AI usage remains counted.";
    await failFactoryBuild({versionId:build.id,leaseToken:build.leaseToken,error:message});
    return {status:"failed" as const,stage:build.stage,more:true};
  }
}
