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
import {generateSiteDraftRevision} from "./site/draft-provider";
import {boundedFactoryFailureIssues,saveFactoryFailureScreenshots} from "./build-failure-evidence";
import type {FactoryDraftRevision} from "./draft-types";
import {SiteGenerationResponseError} from "./site/errors";
import {portableBundle,validateSiteBlueprint} from "./site/validate";
import {renderPortableSite} from "./site/render";
import {reviewSiteDepth} from "./site/quality";
import {checkPortableSite} from "./site/qa";
import {screenshotPath} from "./site/qa";
import {preparePortableImages,preparePortableLogo,portableMobileImageBudget} from "./site/images";
import {factoryBuildAssetDescriptors,resolveFactoryBuildImages,type FactorySavedImage} from "./build-assets";
import {reviewPortableSite,parseSiteReview,SiteReviewResponseError,type SiteReview} from "./site/review";
import {checkSiteDelivery} from "./site/performance";
import {createPortableExport} from "./site/package";
import type {SiteFiles,SiteQaResult,SiteIssue} from "./site/artifacts";
import type {SiteModelExecutor,SiteBlueprint} from "./site/types";
import type {FactoryClaimedBuild,FactoryBuildManifest,FactoryBuildQa,FactoryBuildFailureQa} from "./build-types";
import {maximumReviewAttempts} from "./build-types";
import type {FactoryBuildActivity,FactoryBuildActivityStep} from "./build-progress";

type Working={generationResponse?:unknown;activity?:FactoryBuildActivity;blueprint?:SiteBlueprint;heroKey?:string;provenance?:unknown;imageAssets?:Record<string,FactorySavedImage>;qaReport?:FactoryBuildQa;manifest?:FactoryBuildManifest;sourceKey?:string;repaired?:boolean;draftRevision?:FactoryDraftRevision;
  repairResponse?:{blueprintHash:string;issues:SiteIssue[];raw:unknown};lastFailedQa?:FactoryBuildFailureQa;
  reviewAttempts?:number;review?:{fingerprint:string;result:SiteReview};reviewResponse?:{fingerprint:string;raw:unknown;requireScorecard?:boolean;imageCount?:number};checkedManifest?:FactoryBuildManifest};
class FactoryBuildQualityError extends Error{}
export type FactoryBuildRuntime={storage:FactoryStorage;execute(build:FactoryClaimedBuild):SiteModelExecutor;hero(build:FactoryClaimedBuild,prompt:string,slotId?:string):Promise<{bytes:Uint8Array;provenance:unknown}>;qa(files:SiteFiles):Promise<SiteQaResult>;verify(build:FactoryClaimedBuild,manifest:FactoryBuildManifest):Promise<{url:string;status:200;checkedAt:string}>};
function working(build:FactoryClaimedBuild):Working{return build.workingData as Working;}
function checkDeadline(build:FactoryClaimedBuild){if(!Number.isFinite(Date.parse(build.leaseUntil))||Date.parse(build.leaseUntil)<=Date.now())throw new Error("The website worker lease expired.");}
async function withSite(build:FactoryClaimedBuild,state:Working,runtime:FactoryBuildRuntime){
  if(!state.blueprint||state.heroKey!==`${build.storagePrefix}assets/hero.png`)throw new Error("The saved website assets are incomplete.");
  const blueprint=validateSiteBlueprint(state.blueprint,build.plan,factoryBuildAssetDescriptors(build)),bundle=portableBundle(blueprint);
  const assets:SiteFiles={},slots=resolveFactoryBuildImages(build,blueprint),mobileBytes=portableMobileImageBudget(slots.filter(slot=>slot.role==="photo").length);
  for(const slot of slots){
    const saved=state.imageAssets?.[slot.id],key=`${build.storagePrefix}assets/${slot.id}.png`;
    if(saved&&saved.key!==key||!saved&&slot.id!=="hero")throw new Error("A saved image is outside its approved build.");
    const image=await runtime.storage.get(key,8_000_000);
    if(saved&&createHash("sha256").update(image).digest("hex")!==saved.sha256)throw new Error("A saved website image changed after preparation.");
    Object.assign(assets,slot.role==="logo"?await preparePortableLogo(image,slot.id):await preparePortableImages(image,slot.id,{mobileBytes}));
  }
  return {bundle,...renderPortableSite(bundle,assets)};
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
  const persist=async()=>{if(!await saveFactoryBuildProgress({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,workingData:state as Record<string,unknown>}))throw new Error("This website build was paused or removed.");};
  const report=async(step:FactoryBuildActivityStep)=>{state.activity={stage:build.stage,step,startedAt:new Date().toISOString()};await persist();};
  const advance=async(nextStage:"images"|"qa"|"publish"|"verify")=>{if(!await saveFactoryBuildStage({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,nextStage,workingData:state as Record<string,unknown>,manifest:state.manifest,qaReport:state.qaReport,sourceKey:state.sourceKey}))throw new Error("This website build was paused or removed.");};
  const reuseRevisionImages=async()=>{
    const revision=state.draftRevision;if(!revision)return;
    if(!state.blueprint||revision.version!==1||!/^[0-9a-f-]{36}$/i.test(revision.sourceVersionId)||revision.sourcePrefix!==`factory/${build.workspaceId}/${build.projectId}/${revision.sourceVersionId}/`||revision.sourceHeroKey!==`${revision.sourcePrefix}assets/hero.png`)throw new Error("The saved draft does not belong to this website.");
    state.imageAssets={...state.imageAssets};
    for(const slot of resolveFactoryBuildImages(build,state.blueprint)){
      const source=revision.sourceImageAssets[slot.id],key=`${build.storagePrefix}assets/${slot.id}.png`;
      const expected=createHash("sha256").update(JSON.stringify({id:slot.id,role:slot.role,source:slot.source,uploadId:slot.uploadId,prompt:slot.prompt})).digest("hex");
      if(!source||source.key!==`${revision.sourcePrefix}assets/${slot.id}.png`||source.inputHash!==expected)throw new Error("A draft revision cannot change its saved image identities.");
      const saved=state.imageAssets[slot.id];
      if(saved){if(saved.key!==key||saved.sha256!==source.sha256||saved.inputHash!==expected)throw new Error("The saved revision image changed.");continue;}
      if(build.stage==="images")await report("supplied_image");
      const bytes=await runtime.storage.get(source.key,8_000_000);
      if(createHash("sha256").update(bytes).digest("hex")!==source.sha256)throw new Error("A saved draft image could not be verified.");
      await runtime.storage.put(key,bytes,"image/png");
      state.imageAssets[slot.id]={...source,key};
      if(slot.id==="hero")state.heroKey=key;
      state.provenance=revision.sourceProvenance;await persist();
    }
  };
  if(build.stage==="generate"){
    if(state.draftRevision){
      const revision=state.draftRevision;
      if(revision.mode!=="ai"||!revision.target||!revision.instruction||!state.blueprint)throw new Error("The draft revision request is incomplete.");
      await reuseRevisionImages();
      // The scoped editor sees the actual previous render. A saved paid response
      // is replayed without another browser pass or provider request.
      const screenshots=state.generationResponse===undefined?(await runtime.qa((await withSite(build,state,runtime)).files)).screenshots:undefined;
      await report("generating");
      const result=await generateSiteDraftRevision({plan:build.plan,previousBlueprint:state.blueprint,target:revision.target,instruction:revision.instruction,assets:factoryBuildAssetDescriptors(build),repairScreenshots:screenshots},async request=>{
        if(state.generationResponse!==undefined)return state.generationResponse;
        const raw=await runtime.execute(build)(request);
        if(Buffer.byteLength(JSON.stringify(raw))>1_000_000)throw new SiteGenerationResponseError("The draft correction exceeded its saved-data limit.");
        state.generationResponse=raw;await persist();return raw;
      });
      state.blueprint=result.blueprint;delete state.generationResponse;await advance("images");return;
    }
    await report("generating");
    const result=await generatePortableSite({plan:build.plan,assets:factoryBuildAssetDescriptors(build)},async request=>{
      // Human-approved input is immutable. Revalidate a saved paid response on
      // explicit retry instead of charging again for the same generation.
      if(state.generationResponse!==undefined)return state.generationResponse;
      const raw=await runtime.execute(build)(request);
      if(Buffer.byteLength(JSON.stringify(raw))>1_000_000)throw new SiteGenerationResponseError("The website response exceeded its saved-data limit.");
      state.generationResponse=raw;await persist();return raw;
    });
    resolveFactoryBuildImages(build,result.blueprint);
    state.blueprint=result.blueprint;delete state.generationResponse;await advance("images");return;
  }
  if(build.stage==="images"){
    await reuseRevisionImages();
    if(!state.blueprint)throw new Error("The website blueprint is missing.");
    const slots=resolveFactoryBuildImages(build,state.blueprint);
    state.imageAssets={...state.imageAssets};
    for(const slot of slots){
      const key=`${build.storagePrefix}assets/${slot.id}.png`,inputHash=createHash("sha256").update(JSON.stringify({id:slot.id,role:slot.role,source:slot.source,uploadId:slot.uploadId,prompt:slot.prompt})).digest("hex");
      const saved=state.imageAssets[slot.id];
      if(saved){
        if(saved.key!==key||saved.inputHash!==inputHash)throw new Error("An approved image changed after its preparation.");
        const bytes=await runtime.storage.get(key,8_000_000);
        if(createHash("sha256").update(bytes).digest("hex")!==saved.sha256)throw new Error("A saved website image could not be verified.");
        continue;
      }
      await report(slot.source==="provided"?"supplied_image":"generating_image");
      let bytes:Uint8Array,provenance:unknown;
      if(slot.id==="hero"&&state.heroKey===key){
        // A one-image build saved by an older worker can resume without paying
        // for that image again when its next-stage transition was interrupted.
        bytes=await runtime.storage.get(key,8_000_000);provenance=state.provenance;
      }else if(slot.source==="provided"){
        const supplied=build.uploads.find(upload=>upload.id===slot.uploadId)!;
        bytes=await runtime.storage.get(supplied.storageKey,8_000_000);
        provenance={kind:"provided",role:slot.role,filename:supplied.filename,uploadId:supplied.id,notice:"Image supplied by the team; confirm publishing rights before launch."};
        if(slot.id==="hero"){
          state.blueprint.heroImage.alt=supplied.alt?.trim()||"Business photo supplied by the team";
          state.blueprint.heroImage.caption="Team-provided image for this website concept.";
        }
      }else{
        // Each request independently reserves against the existing monthly and
        // per-build allowance. A failed later slot cannot regenerate saved ones.
        const image=await runtime.hero(build,slot.prompt,slot.id);bytes=image.bytes;provenance=image.provenance;
      }
      await runtime.storage.put(key,bytes,"image/png");
      state.imageAssets[slot.id]={key,inputHash,sha256:createHash("sha256").update(bytes).digest("hex"),provenance};
      if(slot.id==="hero"){state.heroKey=key;state.provenance=provenance;}
      // Persist every successful image before attempting another paid request.
      await persist();
    }
    state.provenance={version:2,assets:slots.map(slot=>({id:slot.id,role:slot.role,sha256:state.imageAssets![slot.id].sha256,provenance:state.imageAssets![slot.id].provenance}))};
    await advance("qa");return;
  }
  if(build.stage==="qa"){
    const boundedExecute=(kind:"review"|"repair"):SiteModelExecutor=>async request=>{
      const previousReviews=state.reviewAttempts,previousRepair=state.repaired;
      // Preprocessing has completed. Save intent before entering the provider so
      // an ambiguous request cannot become an unbounded paid retry.
      if(kind==="review")state.reviewAttempts=(previousReviews||0)+1;
      else state.repaired=true;
      await report(kind==="review"?"design_review":"repairing");
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
    // A paid correction can fail local validation just like initial generation.
    // Recover its saved response against the exact original blueprint/issues;
    // do not spend another repair slot or call the model again on explicit retry.
    if(state.repairResponse){
      const saved=state.repairResponse;
      if(!state.repaired||!state.blueprint||createHash("sha256").update(JSON.stringify(state.blueprint)).digest("hex")!==saved.blueprintHash)throw new FactoryBuildQualityError("The saved website correction no longer matches its original blueprint. This version has not been shared.");
      const revised=await generatePortableSite({plan:build.plan,previousBlueprint:state.blueprint,repairIssues:saved.issues,assets:factoryBuildAssetDescriptors(build)},async()=>saved.raw);
      state.blueprint=revised.blueprint;delete state.repairResponse;await persist();
    }
    const inspect = async (files:SiteFiles) => {
      await report(state.repaired?"rechecking":"browser_checks");
      const browserQa=await runtime.qa(files),depth=reviewSiteDepth(state.blueprint!,build.plan),delivery=checkSiteDelivery(files);
      const issues=[...browserQa.issues,...depth,...delivery.issues];
      return {...browserQa,passed:browserQa.passed&&!issues.some(i=>i.severity==="error"),issues,delivery};
    };
    const review = async(site:Awaited<ReturnType<typeof withSite>>,qa:Awaited<ReturnType<typeof inspect>>)=>{
      if(!qa.passed)return qa;
      const fingerprint=createHash("sha256").update(JSON.stringify(site.manifest)).digest("hex");
      if(state.review?.fingerprint!==fingerprint){
        let result:SiteReview|undefined;
        if(state.reviewResponse?.fingerprint===fingerprint){
          try{result=parseSiteReview(state.reviewResponse.raw,state.blueprint!.pages.map(p=>p.path),{requireScorecard:state.reviewResponse.requireScorecard===true,imageCount:state.reviewResponse.imageCount});}
          catch(error){if(!(error instanceof SiteReviewResponseError))throw error;}
        }
        if(!result){
          if((state.reviewAttempts||0)>=maximumReviewAttempts)throw new FactoryBuildQualityError("The visual review used its three allowed requests, including recovery. Update the plan and approve a new version to continue; your previous preview is preserved.");
          result=await reviewPortableSite({plan:build.plan,blueprint:state.blueprint!,screenshots:qa.screenshots},async request=>{
            const raw=await boundedExecute("review")(request);
            // Keep the paid response private before local validation can reject it.
            // No screenshots, request prompts or credentials are stored here.
            if(Buffer.byteLength(JSON.stringify(raw))>100000)throw new SiteReviewResponseError("The design review response exceeds its saved-data limit.");
            const imageCount=(request.body.input as Array<{content?:Array<{type?:string}>}>).flatMap(message=>message.content||[]).filter(item=>item.type==="input_image").length;
            state.reviewResponse={fingerprint,raw,requireScorecard:true,imageCount};await persist();return raw;
          });
        }
        state.review={fingerprint,result};
        await persist();
      }
      const issues=[...qa.issues,...state.review.result.issues];
      return {...qa,issues,passed:!issues.some(i=>i.severity==="error")};
    };
    const rememberFailure=async(site:Awaited<ReturnType<typeof withSite>>,qa:Awaited<ReturnType<typeof inspect>>)=>{
      if(qa.passed){if(state.lastFailedQa){delete state.lastFailedQa;await persist();}return;}
      const visual=state.review?.fingerprint===createHash("sha256").update(JSON.stringify(site.manifest)).digest("hex")?state.review.result:undefined;
      const report:FactoryBuildFailureQa={checkedAt:qa.checkedAt,issues:boundedFactoryFailureIssues(qa.issues),screenshots:{},
        ...(visual?{designReview:{summary:visual.summary,reviewedPages:visual.reviewedPages,imageCount:visual.imageCount,...(visual.reviewVersion?{reviewVersion:visual.reviewVersion,overallScore:visual.overallScore,scorecard:visual.scorecard}:{})}}:{})};
      state.lastFailedQa=report;await persist();
      // Keep diagnostic images private. Store the useful errors first so a
      // screenshot-storage interruption cannot erase the original QA finding.
      await saveFactoryFailureScreenshots({report,qa,prefix:build.storagePrefix,pages:site.manifest.files.filter(file=>file.path.endsWith(".html")).map(file=>file.path),storage:runtime.storage});
      await persist();
    };
    await report("preparing");
    let site=await withSite(build,state,runtime),qa=await review(site,await inspect(site.files));
    await rememberFailure(site,qa);
    if(!qa.passed&&!state.repaired){
      // Scorecard failures can follow up to 20 optional review warnings. Keep
      // actual blockers inside the bounded correction request before refinements.
      const issues=[...qa.issues.filter(issue=>issue.severity==="error"),...qa.issues.filter(issue=>issue.severity==="warning")].slice(0,20),blueprintHash=createHash("sha256").update(JSON.stringify(state.blueprint)).digest("hex");
      const revised=await generatePortableSite({plan:build.plan,previousBlueprint:state.blueprint,repairIssues:issues,repairScreenshots:qa.screenshots,assets:factoryBuildAssetDescriptors(build)},async request=>{
        const raw=await boundedExecute("repair")(request);
        if(Buffer.byteLength(JSON.stringify(raw))>1_000_000)throw new SiteGenerationResponseError("The website correction exceeded its saved-data limit.");
        state.repairResponse={blueprintHash,issues,raw};await persist();return raw;
      });
      state.blueprint=revised.blueprint;delete state.repairResponse;
      await persist();
      site=await withSite(build,state,runtime);qa=await review(site,await inspect(site.files));await rememberFailure(site,qa);
    }
    if(!qa.passed)throw new FactoryBuildQualityError(`This website needs another revision after its included repair: ${qa.issues.filter(i=>i.severity==="error").slice(0,2).map(i=>i.message).join(" ").slice(0,1000)}`);
    await report("saving");
    const screenshots={desktop:`${build.storagePrefix}screenshots/desktop.png`,mobile:`${build.storagePrefix}screenshots/mobile.png`};
    for(const view of ["desktop","mobile"] as const){const shot=qa.screenshots.find(s=>s.page==="index.html"&&s.viewport===view);if(!shot)throw new Error("Desktop and mobile screenshots are required.");await runtime.storage.put(screenshots[view],shot.bytes,"image/png");}
    const pageScreenshots:NonNullable<FactoryBuildQa["pageScreenshots"]>=[];
    for(const shot of qa.screenshots){const key=`${build.storagePrefix}pages/${screenshotPath(shot.page,shot.viewport)}`;await runtime.storage.put(key,shot.bytes,"image/png");pageScreenshots.push({page:shot.page,viewport:shot.viewport,storageKey:key});}
    const visual=state.review!.result;
    state.qaReport={passed:true,checks:["Approved page identities and content depth","Distinct content and concrete business claims","Desktop and mobile visual/content review","Mobile image and page-size budgets","Desktop and mobile layouts","Local links and images","Demo navigation and forms","Serious and critical accessibility checks","No external requests"],warnings:qa.issues.filter(i=>i.severity==="warning").map(i=>i.message),screenshots,
      designReview:{summary:visual.summary,reviewedPages:visual.reviewedPages,imageCount:visual.imageCount,...(visual.reviewVersion?{reviewVersion:visual.reviewVersion,overallScore:visual.overallScore,scorecard:visual.scorecard}:{})},delivery:{pages:qa.delivery.pages},...(qa.labPerformance?{labPerformance:qa.labPerformance}:{}),pageScreenshots};
    // Freeze the checked bytes before publication. A deployment between stages
    // must not re-render this version with a different template or encoder.
    for(const file of site.manifest.files)await runtime.storage.put(`${build.storagePrefix}checked/${file.path}`,site.files[file.path],file.contentType);
    state.checkedManifest=site.manifest;
    await advance("publish");return;
  }
  if(build.stage==="publish"){
    await report("publishing");
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
  await report("verifying");
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
    const message=error instanceof FactoryBuildBudgetError||error instanceof FactoryBuildQualityError||error instanceof SiteReviewResponseError||error instanceof SiteGenerationResponseError?error.message:"This website build could not complete. Check the builder connection and saved progress before retrying. Attempted AI usage remains counted.";
    await failFactoryBuild({versionId:build.id,leaseToken:build.leaseToken,error:message});
    return {status:"failed" as const,stage:build.stage,more:true};
  }
}
