import {createHash,randomUUID} from "node:crypto";
import sharp from "sharp";
import {readFile,readdir} from "node:fs/promises";
import type {Pool} from "pg";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import type {DashboardContext} from "@/lib/dashboard/data";
import {getDatabasePool} from "@/lib/dashboard/db";
import {approveFactoryPlan,startFactory} from "./service";
import {claimFactoryBuild,saveFactoryBuildStage,saveFactoryBuildProgress,finishFactoryBuild,saveFactoryBuildSettings,failFactoryBuild,retryFactoryBuild,revokeFactoryPreview,restoreFactoryPreview,recoverFactoryBuilds,registerFactoryUpload,completeFactoryUpload,deleteFactoryUpload,claimFactoryStorageCleanup,finishFactoryStorageCleanup,queueApprovedFactoryBuild,rollbackFactoryBuildAttempt} from "./build-service";
import {getFactoryProjectBuilds,getFactoryPreviewResolution,getFactorySourceDownload,getFactoryScreenshotDownload,getFactoryUploadDownload} from "./build-data";
import {FactoryBuildBudgetError,reserveFactoryBuildCost,attemptFactoryBuildCost,settleFactoryBuildCost,uncertainFactoryBuildCost} from "./build-budget";
import {FactoryBuildRequestNotAttemptedError} from "./build-provider";
import type {FactoryClaimedBuild,FactoryBuildQa,FactoryBuildManifest} from "./build-types";
import type {FactoryPlanContent} from "./types";
import {fixtureBlueprint} from "./site/fixtures";
import type {SiteBlueprint} from "./site/types";
import type {SiteScorecard} from "./site/review";
import {runFactoryBuildWorkerStep,type FactoryBuildRuntime} from "./build-worker";
import {getFactoryDraft,reviseFactoryDraft} from "./draft-service";
vi.mock("server-only",()=>({}));
vi.mock("./build-config",()=>({factoryBuildConfiguration:()=>({configured:true,reason:null})}));
const url=process.env.TEST_FACTORY_BUILD_DATABASE_URL;
const ws="00000000-0000-4000-8000-000000000001",otherWs="00000000-0000-4000-8000-000000000993";
const actor=(id="build-owner",workspace=ws,role:DashboardContext["role"]="owner"):DashboardContext=>({user:{id,name:id,email:`${id}@example.test`},workspace:{id:workspace,name:"Build fixture",slug:"build"},role});
const owner=actor(),member=actor("build-member",ws,"member"),viewer=actor("build-viewer",ws,"owner"),other=actor("build-other",otherWs);
let pool:Pool;
const manifest:FactoryBuildManifest={entrypoint:"index.html",files:[{path:"index.html",contentType:"text/html; charset=utf-8",size:40,sha256:"a".repeat(64)}]};
const approvedPlan:FactoryPlanContent={summary:"Approved sparse concept",goal:"Introduce a new business concept",audience:"Local customers",knownDetails:[],uncertainties:["Business identity is unconfirmed"],assumptions:["Use a provisional concept name"],pages:[{title:"Home",purpose:"Introduction",sections:["Services","Contact"]},{title:"Services",purpose:"Explain proposed services",sections:["Overview"]}],callsToAction:["Get in touch"],design:{direction:"Warm and modern",palette:["Blue","Cream"],typography:"Humanist",imagery:"Illustrative abstract architecture"},previewFeatures:["Demonstration contact form"],productionIntegrations:["Connect the real contact form"],sources:[]};
const blueprint:SiteBlueprint=fixtureBlueprint("general","centered",true);
blueprint.pages=blueprint.pages.filter(p=>p.path!=="approach/index.html");
blueprint.brandName="New Business Concept";

function qa(job:FactoryClaimedBuild):FactoryBuildQa{return {passed:true,checks:["Desktop layout","Mobile layout"],warnings:[],screenshots:{desktop:`${job.storagePrefix}screenshots/desktop.png`,mobile:`${job.storagePrefix}screenshots/mobile.png`}};}
async function prepared(approve=true,company="",content:FactoryPlanContent=approvedPlan){
  const leadId=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email) VALUES($1,$2,'Sparse person',$3,NULL)",[leadId,ws,company]);
  const {projectId}=await startFactory(member,{leadId});
  const job=(await pool.query("UPDATE factory_jobs SET status='succeeded' WHERE project_id=$1 RETURNING id",[projectId])).rows[0];const planId=randomUUID();
  await pool.query(`INSERT INTO factory_plans(id,workspace_id,project_id,version,content,change_summary,job_id) VALUES($1,$2,$3,1,$5::jsonb,'Initial concept',$4)`,[planId,ws,projectId,job.id,JSON.stringify(content)]);
  await pool.query("UPDATE factory_projects SET current_plan_id=$1,status='plan_ready' WHERE id=$2",[planId,projectId]);
  if(approve)await approveFactoryPlan(member,{projectId,planId});
  return {leadId,projectId,planId};
}
async function enable(monthly=50,perBuild=5){return saveFactoryBuildSettings(owner,{enabled:true,monthlyBudgetDollars:monthly,perBuildBudgetDollars:perBuild});}
async function toVerification(){
  let job=(await claimFactoryBuild())!;expect(job.stage).toBe("generate");
  for(const [stage,nextStage] of [["generate","images"],["images","qa"],["qa","publish"],["publish","verify"]] as const){
    expect(await saveFactoryBuildStage({versionId:job.id,leaseToken:job.leaseToken,stage,nextStage,workingData:{html:"Synthetic safe fixture"},...(nextStage==="verify"?{manifest,qaReport:qa(job),sourceKey:`${job.storagePrefix}source.zip`}:{})})).toBe(true);
    job=(await claimFactoryBuild())!;expect(job.stage).toBe(nextStage);
  }return job;
}
function finish(job:FactoryClaimedBuild){return finishFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,manifest,qaReport:qa(job),sourceKey:`${job.storagePrefix}source.zip`,verification:{url:`https://previews.example.test/p/${job.previewToken}/`,status:200,checkedAt:new Date().toISOString()}});}
function scoredReview<T extends object>(value:T){return {...value,scorecard:Object.fromEntries(["firstImpression","composition","imagery","copy","usefulness","mobile"].map(key=>[key,{score:90,evidence:[{page:"index.html",observation:"Synthetic evidence: the fixture is intentionally evaluated by injected providers."}],improvement:"Preserve the approved synthetic test composition."}]))};}
function mediaBlueprint(){const result=structuredClone(blueprint),items=result.pages[0].sections.find(section=>section.id==="services")!.items;["Describe your central objective and explore the information needed to define a useful starting point. Bring the questions that matter most to you.","Compare different approaches to your project and consider the practical constraints behind each option. Identify the decisions that need further discussion before choosing a direction.","Outline a manageable next step with clear priorities and responsibilities. Use your initial discussion to determine which information is needed before a scope can be agreed."].forEach((body,index)=>{items[index].body=body;});return result;}

async function fixtureRuntime(){
  const objects=new Map<string,Uint8Array>(),image=new Uint8Array(await sharp({create:{width:1200,height:800,channels:3,background:"#456078"}}).png().toBuffer());
  const runtime:FactoryBuildRuntime={storage:{async put(key,bytes){objects.set(key,Uint8Array.from(bytes));},async get(key){const value=objects.get(key);if(!value)throw Error("Fixture object missing");return value;},async deletePrefix(prefix){for(const key of objects.keys())if(key.startsWith(prefix))objects.delete(key);}},
    execute:build=>async request=>{
      let id:string;
      try{id=await reserveFactoryBuildCost({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,requestKey:`fixture-${randomUUID()}`,reservedMicros:request.reservedMicros});}
      catch(error){if(error instanceof FactoryBuildBudgetError)throw new FactoryBuildRequestNotAttemptedError(error.message);throw error;}
      try{
        try{await attemptFactoryBuildCost(id,build.leaseToken);}
        catch(error){if(error instanceof FactoryBuildBudgetError)throw new FactoryBuildRequestNotAttemptedError(error.message);throw error;}
        await settleFactoryBuildCost(id,{actualMicros:100000,providerId:"synthetic-model"});
        return {id:"synthetic-model",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(request.stage==="review"?scoredReview({verdict:"pass",summary:"The synthetic design follows the approved direction.",issues:[]}):blueprint)}]}]};
      }catch(error){await uncertainFactoryBuildCost(id);throw error;}
    },
    async hero(build){const id=await reserveFactoryBuildCost({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,requestKey:"fixture-image",reservedMicros:2000000});await attemptFactoryBuildCost(id,build.leaseToken);await settleFactoryBuildCost(id,{actualMicros:130000,providerId:"synthetic-image"});return {bytes:image,provenance:{kind:"generated",model:"synthetic-fixture"}};},
    async qa(files){expect(files["index.html"]).toBeTruthy();expect(files["services/index.html"]).toBeTruthy();return {passed:true,issues:[],checkedAt:new Date().toISOString(),screenshots:Object.keys(files).filter(p=>p.endsWith(".html")).flatMap(page=>(["desktop","mobile"] as const).map(viewport=>({page,viewport,bytes:image})))};},
    async verify(build,siteManifest){const resolution=await getFactoryPreviewResolution(build.previewToken,{verification:true});expect(resolution?.ready).toBe(false);for(const file of siteManifest.files)expect(objects.get(`${build.storagePrefix}preview/${file.path}`)?.byteLength).toBe(file.size);return {url:`https://previews.example.test/p/${build.previewToken}/`,status:200,checkedAt:new Date().toISOString()};}
  };return {runtime,objects};
}
function unzipStored(bytes:Uint8Array){const buffer=Buffer.from(bytes),files=new Map<string,Buffer>();let offset=0;while(buffer.readUInt32LE(offset)===0x04034b50){expect(buffer.readUInt16LE(offset+8)).toBe(0);const size=buffer.readUInt32LE(offset+18),nameSize=buffer.readUInt16LE(offset+26),extraSize=buffer.readUInt16LE(offset+28),name=buffer.toString("utf8",offset+30,offset+30+nameSize),start=offset+30+nameSize+extraSize;files.set(name,buffer.subarray(start,start+size));offset=start+size;}return files;}
describe.skipIf(!url)("Website builds, artifacts and separate spending",()=>{
  beforeAll(async()=>{
    const parsed=new URL(url!);if(!["127.0.0.1","localhost"].includes(parsed.hostname)||parsed.port!=="55433"||parsed.pathname!=="/ta_factory_build_test"||parsed.search||parsed.hash)throw Error("Use exact local ta_factory_build_test on55433.");
    vi.stubEnv("DATABASE_URL",url!);vi.stubEnv("BETTER_AUTH_SECRET","build-test-secret-".repeat(4));vi.stubEnv("FACTORY_PREVIEW_ORIGIN","https://previews.example.test");
    pool=getDatabasePool();await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
    for(const name of (await readdir("db/migrations")).filter(v=>v.endsWith(".sql")).sort()){
      if((await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[name])).rowCount)continue;
      const db=await pool.connect();try{await db.query("BEGIN");await db.query(await readFile(`db/migrations/${name}`,"utf8"));await db.query("INSERT INTO schema_migrations(filename) VALUES($1)",[name]);await db.query("COMMIT");}catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
    }
  },60000);
  beforeEach(async()=>{
    await pool.query("DELETE FROM factory_projects");await pool.query("DELETE FROM factory_build_settings");await pool.query("DELETE FROM factory_settings");await pool.query("DELETE FROM factory_costs");await pool.query("DELETE FROM factory_build_costs");await pool.query("DELETE FROM factory_storage_cleanup");await pool.query("DELETE FROM leads");
    await pool.query(`INSERT INTO workspaces(id,slug,name,kind) VALUES($1,'build-other','Other build fixture','internal') ON CONFLICT(id) DO UPDATE SET status='active'`,[otherWs]);
    for(const [ctx,role] of [[owner,"owner"],[member,"member"],[viewer,"viewer"],[other,"owner"]] as const){await pool.query(`INSERT INTO "user"(id,name,email) VALUES($1,$1,$2) ON CONFLICT(id) DO NOTHING`,[ctx.user.id,ctx.user.email]);await pool.query(`INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active'`,[randomUUID(),ctx.workspace.id,ctx.user.id,role]);}
  });
  afterAll(async()=>{await pool?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
  it("requires exact human approval and keeps building disabled until separately enabled",async()=>{
    const project=await prepared(false);await enable();expect(await claimFactoryBuild()).toBeNull();
    await expect(approveFactoryPlan(viewer,{projectId:project.projectId,planId:project.planId})).rejects.toThrow("workspace access");
    await saveFactoryBuildSettings(owner,{enabled:false,monthlyBudgetDollars:50,perBuildBudgetDollars:5});
    await Promise.all([approveFactoryPlan(member,{projectId:project.projectId,planId:project.planId}),approveFactoryPlan(owner,{projectId:project.projectId,planId:project.planId})]);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_versions")).rows[0].n).toBe(1);expect(await claimFactoryBuild()).toBeNull();
    await enable();const job=(await claimFactoryBuild())!;expect(job.planId).toBe(project.planId);expect(job.plan.summary).toBe("Approved sparse concept");
    expect(await claimFactoryBuild()).toBeNull();
    await expect(saveFactoryBuildSettings(member,{enabled:true,monthlyBudgetDollars:50,perBuildBudgetDollars:5})).rejects.toThrow("workspace access");
    const db=await pool.connect();try{await expect(queueApprovedFactoryBuild(db,randomUUID())).rejects.toThrow("human-approved");}finally{db.release();}
  });
  it("exposes only verified previews, immutable sources and scoped screenshots; revocation is immediate",async()=>{
    const project=await prepared(true,"Cosmo’s Heating and Air Conditioning");await enable();const job=await toVerification();
    const slug=(await pool.query("SELECT preview_slug FROM factory_build_versions WHERE id=$1",[job.id])).rows[0].preview_slug;
    expect(slug).toBe("cosmos-heating-air");expect(await getFactoryPreviewResolution(slug)).toBeNull();
    expect(await getFactoryPreviewResolution(job.previewToken)).toBeNull();expect((await getFactoryPreviewResolution(job.previewToken,{verification:true}))?.ready).toBe(false);
    await expect(finishFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,manifest,qaReport:qa(job),sourceKey:`${job.storagePrefix}source.zip`,verification:{url:"https://example.test",status:200,checkedAt:new Date().toISOString()}})).rejects.toThrow("real hosted preview");
    expect(await finish(job)).toBe(true);expect(await finish(job)).toBe(false);expect((await getFactoryPreviewResolution(job.previewToken))?.ready).toBe(true);expect((await getFactoryPreviewResolution(slug))?.ready).toBe(true);
    expect((await getFactorySourceDownload(member,job.id)).storageKey).toBe(`${job.storagePrefix}source.zip`);expect((await getFactoryScreenshotDownload(member,job.id,"mobile")).filename).toContain("mobile.png");
    await expect(getFactorySourceDownload(other,job.id)).rejects.toThrow("not available");expect(await getFactoryProjectBuilds(other,project.projectId)).toBeNull();
    await expect(revokeFactoryPreview(viewer,{versionId:job.id})).rejects.toThrow("workspace access");
    await revokeFactoryPreview(member,{versionId:job.id});expect(await getFactoryPreviewResolution(job.previewToken)).toBeNull();expect(await getFactoryPreviewResolution(slug)).toBeNull();expect((await getFactorySourceDownload(member,job.id)).storageKey).toContain("source.zip");
    await restoreFactoryPreview(member,{versionId:job.id});expect(await getFactoryPreviewResolution(job.previewToken)).not.toBeNull();expect(await getFactoryPreviewResolution(slug)).not.toBeNull();
    await pool.query("UPDATE factory_build_versions SET expires_at=now()-interval '1 second' WHERE id=$1",[job.id]);expect(await getFactoryPreviewResolution(job.previewToken)).toBeNull();expect(await getFactoryPreviewResolution(slug)).toBeNull();
    await expect(pool.query("UPDATE factory_build_versions SET source_key='altered.zip' WHERE id=$1",[job.id])).rejects.toThrow("immutable");
  });
  it("keeps same-company aliases unique and never uses a person's name for missing companies",async()=>{
    await Promise.all([prepared(true,"Northline Works"),prepared(true,"Northline Works")]);
    const slugs=(await pool.query("SELECT preview_slug FROM factory_build_versions ORDER BY preview_slug")).rows.map(r=>r.preview_slug);
    expect(slugs).toEqual(["northline-works","northline-works-2"]);
    await prepared(true,"");
    expect((await pool.query("SELECT preview_slug FROM factory_build_versions WHERE preview_slug LIKE 'website-%'")).rows[0].preview_slug).toMatch(/^website-[a-f0-9]{8}$/);
  });
  it("rejects unsafe artifact paths, failed QA and out-of-order transitions",async()=>{
    await prepared();await enable();const job=(await claimFactoryBuild())!;
    await expect(saveFactoryBuildStage({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",nextStage:"verify",workingData:{}})).rejects.toThrow("transition");
    expect(await saveFactoryBuildStage({versionId:job.id,leaseToken:randomUUID(),stage:"generate",nextStage:"images",workingData:{}})).toBe(false);
    await saveFactoryBuildStage({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",nextStage:"images",workingData:{}});
    let current=(await claimFactoryBuild())!;await saveFactoryBuildStage({versionId:current.id,leaseToken:current.leaseToken,stage:"images",nextStage:"qa",workingData:{}});
    current=(await claimFactoryBuild())!;await saveFactoryBuildStage({versionId:current.id,leaseToken:current.leaseToken,stage:"qa",nextStage:"publish",workingData:{}});current=(await claimFactoryBuild())!;
    await expect(saveFactoryBuildStage({versionId:current.id,leaseToken:current.leaseToken,stage:"publish",nextStage:"verify",workingData:{},manifest:{...manifest,files:[{...manifest.files[0],path:"../source.zip"}]},qaReport:qa(current),sourceKey:`${current.storagePrefix}source.zip`})).rejects.toThrow("unsafe path");
    await expect(saveFactoryBuildStage({versionId:current.id,leaseToken:current.leaseToken,stage:"publish",nextStage:"verify",workingData:{},manifest,qaReport:{...qa(current),passed:false},sourceKey:`${current.storagePrefix}source.zip`})).rejects.toThrow("passing desktop/mobile");
  });
  it("preserves a full ten-page quality report through publication while enforcing its 100 KB ceiling",async()=>{
    const project=await prepared();await enable();let current=(await claimFactoryBuild())!;
    for(const [stage,nextStage] of [["generate","images"],["images","qa"],["qa","publish"]] as const){
      expect(await saveFactoryBuildStage({versionId:current.id,leaseToken:current.leaseToken,stage,nextStage,workingData:{}})).toBe(true);
      current=(await claimFactoryBuild())!;
    }
    const pages=Array.from({length:10},(_,index)=>index===0?"index.html":`service-${index}-a-detailed-customer-service-overview/index.html`);
    const scorecard=Object.fromEntries(["firstImpression","composition","imagery","copy","usefulness","mobile"].map(dimension=>[dimension,{score:88,
      evidence:[0,1].map(index=>({page:pages[index],observation:`Synthetic ${dimension} evidence. `.padEnd(500,"e")})),
      improvement:`Optional synthetic ${dimension} refinement. `.padEnd(500,"i"),
    }])) as SiteScorecard;
    const report:FactoryBuildQa={...qa(current),checks:["Ten-page synthetic QA fixture"],warnings:Array.from({length:20},(_,index)=>`Synthetic optional refinement ${index}. `.padEnd(700,"w")),
      designReview:{reviewVersion:2,overallScore:88,summary:"Synthetic full-size assessment. ".padEnd(1400,"s"),reviewedPages:pages,imageCount:24,scorecard},
      delivery:{pages:pages.map(page=>({page,mobileBytes:650000,desktopBytes:900000,mobileInitialBytes:300000,desktopInitialBytes:450000,
        mobileResources:[page,"assets/site.css","assets/runtime.js",...Array.from({length:5},(_,index)=>`assets/images/illustrative-business-photo-${index}-mobile.webp`),...Array.from({length:4},(_,index)=>`assets/fonts/licensed-display-family-${index}.woff2`)],
        desktopResources:[page,"assets/site.css","assets/runtime.js",...Array.from({length:5},(_,index)=>`assets/images/illustrative-business-photo-${index}-desktop.webp`),...Array.from({length:4},(_,index)=>`assets/fonts/licensed-display-family-${index}.woff2`)],
      }))},
      labPerformance:pages.flatMap(page=>(["desktop","mobile"] as const).map(viewport=>({page,viewport,environment:"isolated-local-chromium" as const,network:"in-memory-unthrottled" as const,domContentLoadedMs:120,loadMs:150,firstContentfulPaintMs:140,largestContentfulPaintMs:160,cumulativeLayoutShift:0.01,longTaskCount:0,measurementWindowMs:250}))),
      pageScreenshots:pages.flatMap((page,index)=>(["desktop","mobile"] as const).map(viewport=>({page,viewport,storageKey:`${current.storagePrefix}pages/screenshots/page-${index}-${viewport}.png`})))};
    const size=Buffer.byteLength(JSON.stringify(report));expect(size).toBeGreaterThan(30000);expect(size).toBeLessThan(100000);
    const fullManifest:FactoryBuildManifest={entrypoint:"index.html",files:pages.map(page=>({...manifest.files[0],path:page}))};
    const publish={versionId:current.id,leaseToken:current.leaseToken,stage:"publish" as const,nextStage:"verify" as const,workingData:{},manifest:fullManifest,sourceKey:`${current.storagePrefix}source.zip`};
    await expect(saveFactoryBuildStage({...publish,qaReport:{...report,warnings:[...report.warnings,"x".repeat(100001)]}})).rejects.toThrow("saved-data limit");
    expect((await pool.query("SELECT stage,status,qa_report FROM factory_build_versions WHERE id=$1",[current.id])).rows[0]).toMatchObject({stage:"publish",status:"running",qa_report:null});
    expect(await saveFactoryBuildStage({...publish,qaReport:report})).toBe(true);
    current=(await claimFactoryBuild())!;expect(current.stage).toBe("verify");
    expect(await finishFactoryBuild({versionId:current.id,leaseToken:current.leaseToken,manifest:fullManifest,qaReport:report,sourceKey:`${current.storagePrefix}source.zip`,verification:{url:`https://previews.example.test/p/${current.previewToken}/`,status:200,checkedAt:new Date().toISOString()}})).toBe(true);
    const saved=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];expect(saved.status).toBe("ready");expect(saved.qaReport).toEqual(report);
  });
  it("serializes concurrent reservations, counts uncertain costs, and refuses replayed provider attempts",async()=>{
    await prepared();await enable(2,1);const job=(await claimFactoryBuild())!;
    const requests=await Promise.allSettled([reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"one",reservedMicros:600000}),reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"two",reservedMicros:600000})]);
    expect(requests.filter(r=>r.status==="fulfilled")).toHaveLength(1);const receipt=(requests.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<string>).value;
    await attemptFactoryBuildCost(receipt,job.leaseToken);await expect(attemptFactoryBuildCost(receipt,job.leaseToken)).rejects.toThrow("already attempted");await uncertainFactoryBuildCost(receipt);
    await expect(reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"more",reservedMicros:500000})).rejects.toThrow("this approved website");
    await settleFactoryBuildCost(receipt,{actualMicros:200000,providerId:"synthetic-provider",usage:{inputTokens:100}});
    const allowed=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"within-cap",reservedMicros:500000});expect(allowed).toBeTruthy();
    await uncertainFactoryBuildCost(allowed);expect((await pool.query("SELECT status FROM factory_build_costs WHERE id=$1",[allowed])).rows[0].status).toBe("released");
  });
  it("pauses before a reserved request starts and stops further work after an unexpected overage",async()=>{
    await prepared();await enable();const job=(await claimFactoryBuild())!;const id=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"request",reservedMicros:100000});
    await saveFactoryBuildSettings(owner,{enabled:false,monthlyBudgetDollars:50,perBuildBudgetDollars:5});await expect(attemptFactoryBuildCost(id,job.leaseToken)).rejects.toThrow("paused");
    await enable();await attemptFactoryBuildCost(id,job.leaseToken);await expect(settleFactoryBuildCost(id,{actualMicros:110000})).rejects.toThrow("exceeded its reservation");expect((await pool.query("SELECT enabled FROM factory_build_settings WHERE workspace_id=$1",[ws])).rows[0].enabled).toBe(false);
  });
  it("recovers interrupted leases without automatic paid retries and enforces bounded explicit retries",async()=>{
    await prepared();await enable();let job=(await claimFactoryBuild())!;const cost=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"interrupted",reservedMicros:100000});await attemptFactoryBuildCost(cost,job.leaseToken);
    await pool.query("UPDATE factory_build_versions SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);expect(await recoverFactoryBuilds()).toBe(1);expect(await claimFactoryBuild()).toBeNull();expect((await pool.query("SELECT status FROM factory_build_costs WHERE id=$1",[cost])).rows[0].status).toBe("uncertain");
    const input={versionId:job.id,requestId:randomUUID()};await Promise.all([retryFactoryBuild(member,input),retryFactoryBuild(member,input)]);expect((await pool.query("SELECT retry_count FROM factory_build_versions WHERE id=$1",[job.id])).rows[0].retry_count).toBe(1);
    for(let count=1;count<=3;count++){job=(await claimFactoryBuild())!;await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"Synthetic build failed"});if(count<3)await retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()});}
    await expect(retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()})).rejects.toThrow("three retry");
  });
  it("scopes uploaded images and keeps storage cleanup durable after lead removal",async()=>{
    const project=await prepared();
    const upload=await registerFactoryUpload(member,{projectId:project.projectId,filename:"logo.png",contentType:"image/png",byteSize:1024,sha256:"b".repeat(64)});
    await expect(getFactoryUploadDownload(member,upload.id)).rejects.toThrow("not available");await completeFactoryUpload(member,upload.id);expect((await getFactoryUploadDownload(member,upload.id)).filename).toBe("logo.png");
    await expect(getFactoryUploadDownload(other,upload.id)).rejects.toThrow("not available");await expect(registerFactoryUpload(viewer,{projectId:project.projectId,filename:"logo.png",contentType:"image/png",byteSize:1024,sha256:"b".repeat(64)})).rejects.toThrow("workspace access");
    await deleteFactoryUpload(member,{uploadId:upload.id});const cleanup=(await claimFactoryStorageCleanup())!;expect(cleanup.storagePrefix).toBe(upload.storageKey);await finishFactoryStorageCleanup({...cleanup,success:true});expect(await claimFactoryStorageCleanup()).toBeNull();
    await pool.query("UPDATE factory_storage_cleanup SET available_at=now() WHERE id=$1",[cleanup.id]);const second=(await claimFactoryStorageCleanup())!;expect(second.passes).toBe(1);await finishFactoryStorageCleanup({...second,success:true});expect((await pool.query("SELECT status FROM factory_storage_cleanup WHERE id=$1",[second.id])).rows[0].status).toBe("done");
  });
  it.each(["delete","anonymize"])("rejects late publication after lead %s and retains cost and prefix cleanup",async mode=>{
    const project=await prepared();await enable();const job=await toVerification();const cost=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"verify",requestKey:"receipt",reservedMicros:10000});await attemptFactoryBuildCost(cost,job.leaseToken);
    if(mode==="delete")await pool.query("DELETE FROM leads WHERE id=$1",[project.leadId]);else await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1",[project.leadId]);
    expect(await getFactoryPreviewResolution(job.previewToken,{verification:true})).toBeNull();await expect(finish(job)).rejects.toThrow("no longer available");
    expect((await pool.query("SELECT version_id FROM factory_build_costs WHERE id=$1",[cost])).rows[0].version_id).toBeNull();expect((await pool.query("SELECT storage_prefix FROM factory_storage_cleanup WHERE storage_prefix=$1",[job.storagePrefix])).rowCount).toBe(1);
    await settleFactoryBuildCost(cost,{actualMicros:5000});expect((await pool.query("SELECT actual_micros FROM factory_build_costs WHERE id=$1",[cost])).rows[0].actual_micros).toBe("5000");
  });
  it("runs all five injected stages with typed generation, local assets, source ZIP and verified publication",async()=>{
    const project=await prepared();await enable();const {runtime,objects}=await fixtureRuntime();
    for(const stage of ["generate","images","qa","publish","verify"]){const result=await runFactoryBuildWorkerStep(runtime);expect(result).toMatchObject({status:"processed",stage});}
    const result=(await getFactoryProjectBuilds(member,project.projectId))!;expect(result.versions[0]).toMatchObject({status:"ready",sourceReady:true});expect(result.versions[0].previewUrl).toContain("/preview/");
    const source=await getFactorySourceDownload(member,result.versions[0].id),archive=unzipStored(objects.get(source.storageKey)!);expect(archive.has("build.mjs")).toBe(true);expect(archive.has("render.yaml")).toBe(true);expect(archive.has("package-lock.json")).toBe(true);expect(archive.has("site/services/index.html")).toBe(true);expect(archive.has("site/assets/images/hero.png")).toBe(false);expect(archive.has("site/assets/images/hero-mobile.webp")).toBe(true);expect(archive.has("site/assets/images/hero-desktop.webp")).toBe(true);expect(result.versions[0].qaReport?.designReview?.reviewedPages).toEqual(["index.html","services/index.html"]);expect(result.versions[0].qaReport?.pageScreenshots).toHaveLength(4);
    const prefix=source.storageKey.slice(0,-"source.zip".length);for(const [name,bytes]of archive)if(name.startsWith("site/"))expect(bytes).toEqual(Buffer.from(objects.get(`${prefix}preview/${name.slice(5)}`)!));
    expect(result.monthSpentMicros).toBe(330000);expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE status='settled'")).rows[0].n).toBe(3);
  });
  it("freezes approved logo and photo roles and publishes every selected optimized asset through the complete worker",async()=>{
    const project=await prepared(false),{runtime,objects}=await fixtureRuntime();
    const image=await sharp({create:{width:900,height:600,channels:4,background:{r:42,g:88,b:74,alpha:.6}}}).png().toBuffer();
    async function upload(role:"logo"|"photo",filename:string,alt:string){const saved=await registerFactoryUpload(member,{projectId:project.projectId,role,alt,filename,contentType:"image/png",byteSize:image.length,sha256:"a".repeat(64)});objects.set(saved.storageKey,image);await completeFactoryUpload(member,saved.id);return saved;}
    const logo=await upload("logo","brand.png","Approved business logo"),hero=await upload("photo","hero.png","Team supplied main business photo"),detail=await upload("photo","detail.png","Team supplied detail photo");
    await expect(upload("logo","replacement.png","Another logo")).rejects.toThrow("existing logo");
    await approveFactoryPlan(member,{projectId:project.projectId,planId:project.planId});
    await pool.query("UPDATE factory_uploads SET alt='Changed after approval' WHERE id=$1",[hero.id]);
    const saved=(await pool.query("SELECT working_data FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0].working_data.inputUploads;
    expect(saved.find((item:{id:string})=>item.id===hero.id)).toMatchObject({role:"photo",alt:"Team supplied main business photo"});
    const concept=mediaBlueprint();
    concept.media=[{id:"brand",role:"logo",source:"provided",uploadId:logo.id,prompt:"",alt:"Approved business logo",caption:"Team-provided logo"},{id:"detail",role:"photo",source:"provided",uploadId:detail.id,prompt:"",alt:"Team supplied detail photo",caption:"Team-provided business photo"},{id:"atmosphere",role:"photo",source:"generated",uploadId:null,prompt:"Illustrative architectural detail with natural light and considered material, no text.",alt:"Illustrative architectural detail",caption:"Illustrative concept imagery"}];
    concept.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:"brand",pageImages:[{pagePath:"services/index.html",assetId:"detail"}],sectionImages:[{pagePath:"index.html",sectionId:"benefits",assetId:"atmosphere",itemIndex:null}]};
    const execute=runtime.execute;runtime.execute=build=>async request=>{const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};if(request.stage!=="review")response.output[0].content[0].text=JSON.stringify(concept);return response;};
    await enable();for(let step=0;step<5;step++){const result=await runFactoryBuildWorkerStep(runtime);expect(result.status,JSON.stringify((await getFactoryProjectBuilds(member,project.projectId))!.versions[0])).toBe("processed");}
    const result=(await getFactoryProjectBuilds(member,project.projectId))!,version=result.versions[0],archive=unzipStored(objects.get((await getFactorySourceDownload(member,version.id)).storageKey)!);
    for(const name of ["brand.webp","hero-mobile.webp","detail-desktop.webp","atmosphere-mobile.webp"])expect(archive.has(`site/assets/images/${name}`)).toBe(true);
    expect(archive.get("site/index.html")!.toString()).toContain("brand.webp");expect(archive.get("site/services/index.html")!.toString()).toContain("detail-desktop.webp");
    expect(version.qaReport?.designReview).toMatchObject({reviewVersion:2,overallScore:90});
    expect(result.monthSpentMicros).toBe(330000);expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE stage='images'")).rows[0].n).toBe(1);
  });
  it("retains an uncertain image charge and retries only its slot while preserving earlier prepared images",async()=>{
    const project=await prepared(),{runtime}=await fixtureRuntime(),concept=mediaBlueprint(),execute=runtime.execute;
    concept.media=[{id:"detail",role:"photo",source:"generated",uploadId:null,prompt:"Illustrative architectural close-up with intentional natural lighting and no text.",alt:"Illustrative detail",caption:"Illustrative concept image"}];
    concept.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[{pagePath:"services/index.html",assetId:"detail"}],sectionImages:[]};
    runtime.execute=build=>async request=>{const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};if(request.stage!=="review")response.output[0].content[0].text=JSON.stringify(concept);return response;};
    const image=await sharp({create:{width:1000,height:700,channels:3,background:"#466c60"}}).png().toBuffer(),calls:string[]=[];let fail=true;
    runtime.hero=async(build,_prompt,id="hero")=>{
      calls.push(id);const cost=await reserveFactoryBuildCost({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,requestKey:`fixture-image:${id}:${randomUUID()}`,reservedMicros:2000000});
      await attemptFactoryBuildCost(cost,build.leaseToken);
      if(id==="detail"&&fail){fail=false;await uncertainFactoryBuildCost(cost);throw new Error("Synthetic ambiguous provider failure");}
      await settleFactoryBuildCost(cost,{actualMicros:130000});return {bytes:image,provenance:{kind:"synthetic-test"}};
    };
    await enable();expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    expect(calls).toEqual(["hero","detail"]);expect((await pool.query("SELECT status,reserved_micros FROM factory_build_costs WHERE status='uncertain'")).rows[0]).toEqual({status:"uncertain",reserved_micros:"2000000"});
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<4;step++){const result=await runFactoryBuildWorkerStep(runtime);expect(result.status,JSON.stringify((await getFactoryProjectBuilds(member,project.projectId))!.versions[0])).toBe("processed");}
    expect(calls).toEqual(["hero","detail","detail"]);expect((await getFactoryProjectBuilds(member,project.projectId))!.monthSpentMicros).toBe(2460000);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE status='uncertain'")).rows[0].n).toBe(1);
  });
  it("does not accept a newly saved unscored review as a legacy review on explicit retry",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;let reviews=0;
    runtime.execute=build=>async request=>{const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};if(request.stage==="review"&&++reviews===1)response.output[0].content[0].text=JSON.stringify({verdict:"pass",summary:"Synthetic assessment omitted its required scorecard.",issues:[]});return response;};
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];expect(version.error).toContain("scorecard");
    expect((await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0].working_data.reviewResponse.requireScorecard).toBe(true);
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(2);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].qaReport?.designReview?.reviewVersion).toBe(2);
  });
  it("saves live activity before work, exposes only safe progress, and clears it between stages",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime();
    const original={...runtime},seen:string[]=[];
    const check=async(expected:string)=>{
      const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
      expect(version.status).toBe("running");expect(version.activity?.step).toBe(expected);
      expect(Date.parse(version.updatedAt)).toBeGreaterThanOrEqual(Date.parse(version.activity!.startedAt)-1000);
      expect(version).not.toHaveProperty("workingData");expect(version).not.toHaveProperty("blueprint");
      seen.push(expected);
    };
    runtime.execute=build=>async request=>{await check(request.stage==="review"?"design_review":"generating");return original.execute(build)(request);};
    runtime.hero=async(...args)=>{await check("generating_image");return original.hero(...args);};
    runtime.qa=async(...args)=>{await check("browser_checks");return original.qa(...args);};
    runtime.verify=async(...args)=>{await check("verifying");return original.verify(...args);};
    const save=runtime.storage.put;
    runtime.storage.put=async(key,...args)=>{if(key.includes("/checked/"))await check("saving");if(key.includes("/preview/"))await check("publishing");await save(key,...args);};
    for(let stage=0;stage<5;stage++){
      expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
      expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].activity).toBeNull();
    }
    expect(new Set(seen)).toEqual(new Set(["generating","generating_image","browser_checks","design_review","saving","publishing","verifying"]));
  });
  it("retains rejected paid generation for diagnosis and never charges again just to revalidate it",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;let requests=0;
    runtime.execute=build=>async request=>{
      requests++;const raw=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      const invalid=structuredClone(blueprint);invalid.interactions!.forms=[{pagePath:"index.html",sectionId:"missing",fields:["name"],submitLabel:"Preview"}];
      raw.output[0].content[0].text=JSON.stringify(invalid);return raw;
    };
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const row=(await pool.query("SELECT * FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0];
    expect(row.working_data.generationResponse).toBeTruthy();expect(row.error).toContain("A form references a missing");
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0]).not.toHaveProperty("generationResponse");
    await retryFactoryBuild(member,{versionId:row.id,requestId:randomUUID()});
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");expect(requests).toBe(1);
    expect((await getFactoryProjectBuilds(member,project.projectId))!.monthSpentMicros).toBe(100000);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs")).rows[0].n).toBe(1);
  });
  it("resumes saved generation with closing contact links without a new provider request",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime();
    const saved=structuredClone(blueprint);
    saved.pages[0].sections.push({id:"contact",kind:"contact",layout:"split",eyebrow:"Next step",title:"Discuss your needs",body:"Prepare an inquiry.",items:[{title:"Write to us",body:"Tell the team what you have in mind."}]});
    saved.interactions!.actions.push({pagePath:"index.html",sectionId:"contact",itemIndex:0,label:"Explore our services",targetPage:"services/index.html",targetSection:null});
    const raw={id:"resp_saved_fixture",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(saved)}]}]};
    await pool.query("UPDATE factory_build_versions SET working_data=working_data||$2::jsonb WHERE project_id=$1",[project.projectId,JSON.stringify({generationResponse:raw})]);
    runtime.execute=()=>async()=>{throw Error("A saved response must not be regenerated");};
    expect(await runFactoryBuildWorkerStep(runtime)).toMatchObject({status:"processed",stage:"generate"});
    const row=(await pool.query("SELECT stage,working_data FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0];
    expect(row.stage).toBe("images");expect(row.working_data.blueprint).toBeTruthy();expect(row.working_data.generationResponse).toBeUndefined();
  });
  it("recovers a saved palette-validation failure without changing approval or charging for design again",async()=>{
    const plan=structuredClone(approvedPlan);
    plan.design.palette=["Background: off-white #F5F7F8","Surface: white #FFFFFF; navy #142B40 for inverted feature bands","Ink: charcoal #24323D","Muted: slate #52616B, contrast-tested on its surface","Accent: cooling teal #087F8C","AccentSecondary: warm amber #F3AD46 for restrained highlights with dark text"];
    const project=await prepared(false,"",plan);
    await approveFactoryPlan(member,{projectId:project.projectId,planId:project.planId});await enable();
    const job=(await claimFactoryBuild())!,raw={id:"resp_saved_palette_fixture",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(blueprint)}]}]};
    const cost=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"saved-design",reservedMicros:200000});
    await attemptFactoryBuildCost(cost,job.leaseToken);await settleFactoryBuildCost(cost,{actualMicros:100000,providerId:raw.id});
    expect(await saveFactoryBuildProgress({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",workingData:{...job.workingData,generationResponse:raw}})).toBe(true);
    // Reproduce the durable state left by the old palette parser, then recover
    // through the real retry path using the new parser and the same paid response.
    await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"The generated website did not pass validation: Website palette text must have at least 4.5:1 contrast on its backgrounds."});
    const before=(await getFactoryProjectBuilds(member,project.projectId))!;
    expect(before.versions[0]).toMatchObject({id:job.id,planId:project.planId,status:"failed",stage:"generate",retryCount:0});
    expect(before.versions[0]).not.toHaveProperty("generationResponse");expect(before.monthSpentMicros).toBe(100000);
    expect((await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[job.id])).rows[0].working_data.generationResponse).toEqual(raw);
    const receipts=(await pool.query("SELECT id,status,actual_micros,provider_id FROM factory_build_costs WHERE version_id=$1",[job.id])).rows;
    const {runtime}=await fixtureRuntime(),execute=vi.fn(()=>async()=>{throw Error("A saved design response must not trigger another paid request");});runtime.execute=execute;
    await retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()});
    expect(await runFactoryBuildWorkerStep(runtime)).toMatchObject({status:"processed",stage:"generate"});expect(execute).not.toHaveBeenCalled();
    const row=(await pool.query("SELECT stage,working_data FROM factory_build_versions WHERE id=$1",[job.id])).rows[0];
    expect(row.stage).toBe("images");expect(row.working_data.generationResponse).toBeUndefined();
    expect(row.working_data.blueprint.design.palette).toEqual({background:"#f5f7f8",surface:"#ffffff",ink:"#24323d",muted:"#52616b",accent:"#087f8c",accentSecondary:"#f3ad46"});
    const after=(await getFactoryProjectBuilds(member,project.projectId))!;
    expect(after.versions[0]).toMatchObject({id:job.id,version:job.version,planId:project.planId,status:"queued",stage:"images",retryCount:1});expect(after.monthSpentMicros).toBe(before.monthSpentMicros);
    expect((await pool.query("SELECT id,status,actual_micros,provider_id FROM factory_build_costs WHERE version_id=$1",[job.id])).rows).toEqual(receipts);
    expect((await pool.query("SELECT content FROM factory_plans WHERE id=$1",[project.planId])).rows[0].content).toEqual(plan);
  });
  it("keeps failed verification private and preserves artifacts for an explicit retry",async()=>{
    const project=await prepared();await enable();const {runtime,objects}=await fixtureRuntime();for(let step=0;step<4;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    runtime.verify=async()=>{throw Error("Unreachable hosted preview");};expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");const row=(await pool.query("SELECT id,preview_token,source_key FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0];
    expect(objects.has(row.source_key)).toBe(true);expect(await getFactoryPreviewResolution(row.preview_token)).toBeNull();await expect(getFactorySourceDownload(member,row.id)).rejects.toThrow("not available");
  });
  it("repairs a visual defect once, reviews the changed version and retains the complete report",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviews=0,repairs=0;
    runtime.execute=build=>async request=>{
      const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      if(request.stage==="review"){
        reviews++;
        response.output[0].content[0].text=JSON.stringify(scoredReview(reviews===1?{verdict:"revise",summary:"The heading needs a clearer subject.",issues:[{page:"index.html",category:"content",severity:"error",message:"Make the homepage heading describe the proposed service."}]}:{verdict:"pass",summary:"The revised direction is clear.",issues:[]}));
      }
      if(request.stage==="repair"){repairs++;const changed=structuredClone(blueprint);changed.pages[0].hero.headline="Explore a practical service concept";response.output[0].content[0].text=JSON.stringify(changed);}
      return response;
    };
    for(let step=0;step<5;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    expect(version.status).toBe("ready");expect(reviews).toBe(2);expect(repairs).toBe(1);
    expect(version.qaReport?.designReview?.summary).toBe("The revised direction is clear.");
    expect(version.qaReport?.delivery?.pages.every(p=>p.mobileBytes<800000)).toBe(true);
  });
  it("keeps a failed visual review private without starting a third review or second repair",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviews=0,repairs=0;
    runtime.execute=build=>async request=>{
      const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      if(request.stage==="review"){reviews++;response.output[0].content[0].text=JSON.stringify(scoredReview({verdict:"revise",summary:"A material copy issue remains.",issues:[{page:"index.html",category:"content",severity:"error",message:"Replace unsupported business claims with proposed service explanations."}]}));}
      if(request.stage==="repair"){repairs++;const changed=structuredClone(blueprint);changed.pages[0].hero.headline="Explore the proposed direction";response.output[0].content[0].text=JSON.stringify(changed);}
      return response;
    };
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    expect(version.error).toContain("another revision");expect(reviews).toBe(2);expect(repairs).toBe(1);
      expect(version.reviewAttempts).toBe(2);
    expect(version.failedQa?.issues.some(issue=>issue.message.includes("Replace unsupported"))).toBe(true);
    expect(version.failedQa?.screenshots.desktop).toContain("failed/screenshots/desktop.png");
    expect((await getFactoryScreenshotDownload(member,version.id,"desktop")).storageKey).toBe(version.failedQa?.screenshots.desktop);
    await expect(getFactoryScreenshotDownload(other,version.id,"desktop")).rejects.toThrow();
    await expect(getFactorySourceDownload(member,version.id)).rejects.toThrow();
    expect(JSON.stringify(version)).not.toContain("repairResponse");expect(JSON.stringify(version)).not.toContain("generationResponse");
    const row=(await pool.query("SELECT preview_token FROM factory_build_versions WHERE id=$1",[version.id])).rows[0];
    expect(await getFactoryPreviewResolution(row.preview_token)).toBeNull();
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");expect(reviews).toBe(2);expect(repairs).toBe(1);
  });
  it("checkpoints an invalid paid correction before validation and never buys a replacement on retry",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;let repairs=0;
    runtime.execute=build=>async request=>{
      const raw=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      if(request.stage==="review")raw.output[0].content[0].text=JSON.stringify(scoredReview({verdict:"revise",summary:"Improve the heading",issues:[{page:"index.html",category:"design",severity:"error",message:"Use a clearer heading."}]}));
      if(request.stage==="repair"){repairs++;raw.output[0].content[0].text="invalid paid correction fixture";}
      return raw;
    };
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    const state=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0].working_data;
    expect(state.repaired).toBe(true);expect(state.repairResponse.raw.output[0].content[0].text).toBe("invalid paid correction fixture");expect(state.lastFailedQa.issues).toHaveLength(1);
    const before=(await pool.query("SELECT count(*)::int n,sum(actual_micros)::text total FROM factory_build_costs WHERE version_id=$1",[version.id])).rows[0];
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    expect(repairs).toBe(1);expect((await pool.query("SELECT count(*)::int n,sum(actual_micros)::text total FROM factory_build_costs WHERE version_id=$1",[version.id])).rows[0]).toEqual(before);
  });
  it("recovers a saved correction with the same blueprint and only pays for the remaining assessment",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime();
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const job=(await claimFactoryBuild())!,original=job.workingData.blueprint as SiteBlueprint,revised=structuredClone(original);revised.pages[0].hero.headline="A carefully considered starting point";
    const raw={id:"saved-repair",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(revised)}]}]};
    const cost=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"qa",requestKey:"saved-repair",reservedMicros:200000});await attemptFactoryBuildCost(cost,job.leaseToken);await settleFactoryBuildCost(cost,{actualMicros:100000,providerId:raw.id});
    const saved={...job.workingData,repaired:true,repairResponse:{blueprintHash:createHash("sha256").update(JSON.stringify(original)).digest("hex"),issues:[{code:"review_design",page:"index.html",severity:"error",message:"Use a clearer heading."}],raw},lastFailedQa:{checkedAt:new Date().toISOString(),issues:[],screenshots:{}}};
    await saveFactoryBuildProgress({versionId:job.id,leaseToken:job.leaseToken,stage:"qa",workingData:saved});await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"Synthetic interruption after saving paid correction"});
    const execute=runtime.execute,stages:string[]=[];runtime.execute=build=>async request=>{stages.push(request.stage);expect(request.stage).toBe("review");return execute(build)(request);};
    await retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()});expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const accepted=(await pool.query("SELECT working_data,stage FROM factory_build_versions WHERE id=$1",[job.id])).rows[0];
    expect(accepted.stage).toBe("publish");expect(accepted.working_data.blueprint.pages[0].hero.headline).toBe(revised.pages[0].hero.headline);expect(accepted.working_data.repairResponse).toBeUndefined();expect(accepted.working_data.lastFailedQa).toBeUndefined();expect(stages).toEqual(["review"]);
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0]).toMatchObject({id:job.id,planId:project.planId,status:"ready",failedQa:null});
    expect((await pool.query("SELECT status,actual_micros,provider_id FROM factory_build_costs WHERE id=$1",[cost])).rows[0]).toMatchObject({status:"settled",actual_micros:"100000",provider_id:"saved-repair"});
  });
  it("reuses a completed visual review after a storage interruption instead of charging again",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute,put=runtime.storage.put;
    let reviews=0,interrupt=true;
    runtime.execute=build=>async request=>{if(request.stage==="review")reviews++;return execute(build)(request);};
    runtime.storage.put=async(key,...args)=>{if(interrupt&&key.endsWith("screenshots/desktop.png")){interrupt=false;throw Error("Synthetic storage interruption");}return put(key,...args);};
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");expect(reviews).toBe(1);
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    // Simulate interruption between saving the response and its parsed report.
    await pool.query("UPDATE factory_build_versions SET working_data=working_data-'review' WHERE id=$1",[version.id]);
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(1);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].qaReport?.designReview?.imageCount).toBe(8);
  });
  it("retains an invalid paid assessment and recovers through one explicit retry, repair and final review",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviews=0,repairs=0;
    runtime.execute=build=>async request=>{
      const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      if(request.stage==="review"){
        reviews++;
        response.output[0].content[0].text=JSON.stringify(scoredReview(reviews===1?{verdict:"pass",summary:"Invalid path.",issues:[{page:"all",category:"design",severity:"warning",message:"Tighten the heading."}]}:reviews===2?{summary:"Fix the heading.",issues:[{page:"index.html",category:"content",severity:"error",message:"Explain the service in the heading."}]}:{summary:"Ready to share.",issues:[]}));
      }
      if(request.stage==="repair"){repairs++;const changed=structuredClone(blueprint);changed.pages[0].hero.headline="Explore the proposed service experience";response.output[0].content[0].text=JSON.stringify(changed);}
      return response;
    };
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    expect(version.error).toContain("unknown page");
    const state=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0].working_data;
    expect(state.reviewResponse.raw.output[0].content[0].text).toContain('"page":"all"');expect(state.reviewAttempts).toBe(1);expect(state.review).toBeUndefined();
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(3);expect(repairs).toBe(1);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE status='settled'")).rows[0].n).toBe(6);
  });
  it("stops after three unusable review responses across explicit retries and keeps all charges",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;let reviews=0;
    runtime.execute=build=>async request=>{const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};if(request.stage==="review"){reviews++;response.output[0].content[0].text="not an assessment";}return response;};
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    for(let attempt=0;attempt<4;attempt++){
      if(attempt){const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});}
      expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    }
    expect(reviews).toBe(3);const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];expect(version.error).toContain("three allowed requests");expect(version.previewUrl).toBeNull();
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE stage='qa' AND status='settled'")).rows[0].n).toBe(3);
  });
  it("reserves visual review within the original per-site cap before any review provider call",async()=>{
    await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviewResponses=0;
    runtime.execute=build=>async request=>{const response=await execute(build)(request);if(request.stage==="review")reviewResponses++;return response;};
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    await enable(50,1);
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");expect(reviewResponses).toBe(0);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE status='settled'")).rows[0].n).toBe(2);
  });
  it("does not consume visual review slots after two denied budgets and resumes when the allowance is restored",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviews=0;
    runtime.execute=build=>async request=>{const response=await execute(build)(request);if(request.stage==="review")reviews++;return response;};
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    await enable(50,1);
    for(let denial=0;denial<2;denial++){
      if(denial)await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
      expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
      const state=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0].working_data;
      expect(state.reviewAttempts).toBeUndefined();expect(state.repaired).toBeUndefined();expect(reviews).toBe(0);
      expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE status='settled'")).rows[0].n).toBe(2);
    }
    await enable();await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(1);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
  });
  it("preserves the repair slot after a known preflight denial and reuses the completed first review",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviews=0,repairs=0,denyRepair=true;
    runtime.execute=build=>async request=>{
      if(request.stage==="repair"&&denyRepair){denyRepair=false;throw new FactoryBuildRequestNotAttemptedError("Synthetic pre-request allowance denial.");}
      const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      if(request.stage==="review"){
        reviews++;response.output[0].content[0].text=JSON.stringify(scoredReview(reviews===1?{verdict:"revise",summary:"The heading needs a clear subject.",issues:[{page:"index.html",category:"content",severity:"error",message:"Describe the proposed service in the main heading."}]}:{verdict:"pass",summary:"The revised service direction is clear.",issues:[]}));
      }
      if(request.stage==="repair"){repairs++;const changed=structuredClone(blueprint);changed.pages[0].hero.headline="Explore this proposed service direction";response.output[0].content[0].text=JSON.stringify(changed);}
      return response;
    };
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    const state=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0].working_data;
    expect(state.reviewAttempts).toBe(1);expect(state.review.result.issues).toHaveLength(1);expect(state.repaired).toBeUndefined();expect(reviews).toBe(1);expect(repairs).toBe(0);
    await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(2);expect(repairs).toBe(1);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE stage='qa' AND status='settled'")).rows[0].n).toBe(3);
  });
  it("does not consume a review slot when screenshot preprocessing fails before invoking the executor",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute,inspect=runtime.qa;
    let reviews=0;
    runtime.execute=build=>async request=>{if(request.stage==="review")reviews++;return execute(build)(request);};
    runtime.qa=async files=>{const result=await inspect(files);return {...result,screenshots:result.screenshots.filter(shot=>shot.page!=="services/index.html"||shot.viewport!=="mobile")};};
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    const state=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0].working_data;
    expect(state.reviewAttempts).toBeUndefined();expect(reviews).toBe(0);
    runtime.qa=inspect;await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(1);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
  });
  it("restores a denied repair while building is paused, then completes after an explicit re-enable and retry",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    let reviews=0,repairs=0,pauseRepair=true;
    runtime.execute=build=>async request=>{
      if(request.stage==="repair"&&pauseRepair){pauseRepair=false;await saveFactoryBuildSettings(owner,{enabled:false,monthlyBudgetDollars:50,perBuildBudgetDollars:5});}
      const response=await execute(build)(request) as {output:Array<{content:Array<{text:string}>}>};
      if(request.stage==="review"){
        reviews++;response.output[0].content[0].text=JSON.stringify(scoredReview(reviews===1?{verdict:"revise",summary:"Make the main heading clearer.",issues:[{page:"index.html",category:"content",severity:"error",message:"Explain the proposed service in the homepage heading."}]}:{verdict:"pass",summary:"The revised heading is clear.",issues:[]}));
      }
      if(request.stage==="repair"){repairs++;const changed=structuredClone(blueprint);changed.pages[0].hero.headline="A proposed service with a clear direction";response.output[0].content[0].text=JSON.stringify(changed);}
      return response;
    };
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    const version=(await getFactoryProjectBuilds(member,project.projectId))!.versions[0];
    const row=(await pool.query("SELECT stage,status,working_data FROM factory_build_versions WHERE id=$1",[version.id])).rows[0];
    expect(row).toMatchObject({stage:"qa",status:"failed"});expect(row.working_data.repaired).toBeUndefined();expect(row.working_data.reviewAttempts).toBe(1);
    expect((await pool.query("SELECT enabled FROM factory_build_settings WHERE workspace_id=$1",[ws])).rows[0].enabled).toBe(false);
    expect(reviews).toBe(1);expect(repairs).toBe(0);expect(await claimFactoryBuild()).toBeNull();
    await enable();await retryFactoryBuild(member,{versionId:version.id,requestId:randomUUID()});
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect(reviews).toBe(2);expect(repairs).toBe(1);expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
  });
  it("allows only an exact leased counter rollback while paused and preserves every unrelated field",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime();
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const job=(await claimFactoryBuild())!;
    await pool.query("UPDATE factory_build_versions SET working_data=working_data||$2::jsonb WHERE id=$1",[job.id,JSON.stringify({reviewAttempts:2,repaired:true,unrelated:{keep:"unchanged"}})]);
    const before=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[job.id])).rows[0].working_data;
    await saveFactoryBuildSettings(owner,{enabled:false,monthlyBudgetDollars:50,perBuildBudgetDollars:5});
    const restore={versionId:job.id,leaseToken:job.leaseToken,stage:"qa" as const,kind:"review" as const,expectedValue:2,previousValue:1};
    expect(await rollbackFactoryBuildAttempt({...restore,leaseToken:randomUUID()})).toBe(false);
    expect(await rollbackFactoryBuildAttempt({...restore,expectedValue:1,previousValue:0})).toBe(false);
    await expect(rollbackFactoryBuildAttempt({...restore,previousValue:0})).rejects.toThrow("Invalid review");
    await expect(rollbackFactoryBuildAttempt({...restore,stage:"publish"})).rejects.toThrow("Only a website QA");
    expect(await rollbackFactoryBuildAttempt(restore)).toBe(true);
    const after=(await pool.query("SELECT status,stage,working_data FROM factory_build_versions WHERE id=$1",[job.id])).rows[0];
    expect(after).toMatchObject({status:"running",stage:"qa"});expect(after.working_data).toEqual({...before,reviewAttempts:1});
    expect(await rollbackFactoryBuildAttempt(restore)).toBe(false);
    expect(await rollbackFactoryBuildAttempt({versionId:job.id,leaseToken:job.leaseToken,stage:"qa",kind:"repair",expectedValue:true,previousValue:false})).toBe(true);
    expect((await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[job.id])).rows[0].working_data).toEqual({...before,reviewAttempts:1,repaired:false});
    expect((await pool.query("SELECT enabled FROM factory_build_settings WHERE workspace_id=$1",[ws])).rows[0].enabled).toBe(false);
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].previewUrl).toBeNull();
  });
  it("refuses intent rollback after lease expiration or relationship removal",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime();
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const job=(await claimFactoryBuild())!;
    await pool.query("UPDATE factory_build_versions SET working_data=working_data||'{\"reviewAttempts\":1}'::jsonb,lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
    const input={versionId:job.id,leaseToken:job.leaseToken,stage:"qa" as const,kind:"review" as const,expectedValue:1};
    expect(await rollbackFactoryBuildAttempt(input)).toBe(false);
    await pool.query("UPDATE factory_build_versions SET lease_until=now()+interval '15 minutes' WHERE id=$1",[job.id]);
    await pool.query("UPDATE workspaces SET status='archived' WHERE id=$1",[ws]);
    try{expect(await rollbackFactoryBuildAttempt(input)).toBe(false);}
    finally{await pool.query("UPDATE workspaces SET status='active' WHERE id=$1",[ws]);}
    await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1",[project.leadId]);
    // The retention trigger removes its Factory project immediately.
    await expect(rollbackFactoryBuildAttempt(input)).rejects.toThrow("no longer available");
    await pool.query("DELETE FROM leads WHERE id=$1",[project.leadId]);
    await expect(rollbackFactoryBuildAttempt(input)).rejects.toThrow("no longer available");
  });
  it("publishes the frozen checked bytes without re-rendering from a subsequently changed image",async()=>{
    const project=await prepared();await enable();const {runtime,objects}=await fixtureRuntime();
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const row=(await pool.query("SELECT storage_prefix,working_data FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0];
    // A source can disappear after review; publication must use the frozen outputs.
    objects.delete(`${row.storage_prefix}assets/hero.png`);
    for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].status).toBe("ready");
    for(const file of row.working_data.checkedManifest.files)expect(objects.get(`${row.storage_prefix}preview/${file.path}`)).toEqual(objects.get(`${row.storage_prefix}checked/${file.path}`));
  });
  it("rejects changed checked bytes and pre-upgrade publication jobs instead of sharing unreviewed output",async()=>{
    const project=await prepared();await enable();const {runtime,objects}=await fixtureRuntime();
    for(let step=0;step<3;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    const row=(await pool.query("SELECT id,storage_prefix FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0];
    const key=`${row.storage_prefix}checked/index.html`,original=objects.get(key)!;
    const modified=Uint8Array.from(original);modified[0]^=1;objects.set(key,modified);
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].error).toContain("artifact changed");
    expect([...objects.keys()].some(key=>key.includes("/preview/"))).toBe(false);
    objects.set(key,original);
    await pool.query("UPDATE factory_build_versions SET working_data=working_data-'checkedManifest' WHERE id=$1",[row.id]);
    await retryFactoryBuild(member,{versionId:row.id,requestId:randomUUID()});
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");
    expect((await getFactoryProjectBuilds(member,project.projectId))!.versions[0].error).toContain("frozen, reviewed website");
  });
  it("does not advance a model result after building was paused during its request",async()=>{
    const project=await prepared();await enable();const {runtime}=await fixtureRuntime(),execute=runtime.execute;
    runtime.execute=build=>async request=>{const result=await execute(build)(request);await saveFactoryBuildSettings(owner,{enabled:false,monthlyBudgetDollars:50,perBuildBudgetDollars:5});return result;};
    expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");expect((await getFactoryProjectBuilds(member,project.projectId))?.versions[0].status).toBe("failed");expect((await pool.query("SELECT actual_micros FROM factory_build_costs WHERE status='settled'")).rows[0].actual_micros).toBe("100000");
  });
  it("cleans a pending upload after project removal and refuses late finalization",async()=>{
    const project=await prepared(),upload=await registerFactoryUpload(member,{projectId:project.projectId,filename:"logo.png",contentType:"image/png",byteSize:512,sha256:"c".repeat(64)});await pool.query("DELETE FROM leads WHERE id=$1",[project.leadId]);await expect(completeFactoryUpload(member,upload.id)).rejects.toThrow("removed");expect((await pool.query("SELECT status FROM factory_storage_cleanup WHERE storage_prefix=$1",[upload.storageKey])).rows[0].status).toBe("queued");
  });
  it("recovers abandoned pending uploads without losing completed reference images",async()=>{
    const project=await prepared();
    const input={projectId:project.projectId,filename:"logo.png",contentType:"image/png",byteSize:512,sha256:"c".repeat(64)};
    const pending=await registerFactoryUpload(member,input),completed=await registerFactoryUpload(member,input);await completeFactoryUpload(member,completed.id);
    await pool.query("UPDATE factory_uploads SET created_at=now()-interval '16 minutes' WHERE id=ANY($1::uuid[])",[[pending.id,completed.id]]);
    await recoverFactoryBuilds();expect((await pool.query("SELECT id FROM factory_uploads WHERE project_id=$1",[project.projectId])).rows.map(v=>v.id)).toEqual([completed.id]);expect((await pool.query("SELECT status FROM factory_storage_cleanup WHERE storage_prefix=$1",[pending.storageKey])).rows[0].status).toBe("queued");
  });
  it("freezes approved image inputs across stages and retries until the image has been copied",async()=>{
    const project=await prepared(false),input={projectId:project.projectId,filename:"approved.png",contentType:"image/png",byteSize:512,sha256:"d".repeat(64)};
    const original=await registerFactoryUpload(member,input);
    await expect(approveFactoryPlan(member,{projectId:project.projectId,planId:project.planId})).rejects.toThrow("upload to finish");
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_requests WHERE project_id=$1",[project.projectId])).rows[0].n).toBe(0);
    await completeFactoryUpload(member,original.id);await approveFactoryPlan(member,{projectId:project.projectId,planId:project.planId});
    const later=await registerFactoryUpload(member,{...input,filename:"later.png"});await completeFactoryUpload(member,later.id);
    await enable();let job=(await claimFactoryBuild())!;expect(job.uploads.map(u=>u.id)).toEqual([original.id]);
    await expect(deleteFactoryUpload(member,{uploadId:original.id})).rejects.toThrow("part of an approved build");
    await deleteFactoryUpload(member,{uploadId:later.id});
    // Worker-controlled output cannot replace the authoritative approved inputs.
    await saveFactoryBuildStage({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",nextStage:"images",workingData:{inputUploads:[]}});
    job=(await claimFactoryBuild())!;expect(job.uploads.map(u=>u.id)).toEqual([original.id]);
    await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"Synthetic image failure"});
    await expect(deleteFactoryUpload(member,{uploadId:original.id})).rejects.toThrow("part of an approved build");
    await retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()});job=(await claimFactoryBuild())!;expect(job.uploads.map(u=>u.id)).toEqual([original.id]);
    await saveFactoryBuildStage({versionId:job.id,leaseToken:job.leaseToken,stage:"images",nextStage:"qa",workingData:{}});
    await deleteFactoryUpload(member,{uploadId:original.id});expect((await pool.query("SELECT 1 FROM factory_storage_cleanup WHERE storage_prefix=$1",[original.storageKey])).rowCount).toBe(1);
  });
  it("allows a replacement logo after an image build exhausts retries without changing its approval or charges",async()=>{
    const project=await prepared(false),input={projectId:project.projectId,filename:"old-logo.png",role:"logo",contentType:"image/png",byteSize:512,sha256:"d".repeat(64)};
    const original=await registerFactoryUpload(member,input);await completeFactoryUpload(member,original.id);
    await approveFactoryPlan(member,{projectId:project.projectId,planId:project.planId});await enable();
    let job=(await claimFactoryBuild())!;
    const costId=await reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:job.stage,requestKey:"saved-design",reservedMicros:200000});
    await attemptFactoryBuildCost(costId,job.leaseToken);await settleFactoryBuildCost(costId,{actualMicros:100000,providerId:"synthetic-model"});
    await saveFactoryBuildStage({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",nextStage:"images",workingData:{}});
    job=(await claimFactoryBuild())!;
    for(let retry=0;retry<=3;retry++){
      await expect(deleteFactoryUpload(member,{uploadId:original.id})).rejects.toThrow("part of an approved build");
      await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"Synthetic image failure"});
      if(retry===3)break;
      await expect(deleteFactoryUpload(member,{uploadId:original.id})).rejects.toThrow("part of an approved build");
      await retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()});
      // Even the final allowed retry must keep its inputs while queued/running.
      await expect(deleteFactoryUpload(member,{uploadId:original.id})).rejects.toThrow("part of an approved build");
      job=(await claimFactoryBuild())!;
    }
    const before=(await pool.query("SELECT status,retry_count,working_data,build_request_id FROM factory_build_versions WHERE id=$1",[job.id])).rows[0];
    expect(before).toMatchObject({status:"failed",retry_count:3});
    await expect(retryFactoryBuild(member,{versionId:job.id,requestId:randomUUID()})).rejects.toThrow("three retry limit");
    await deleteFactoryUpload(member,{uploadId:original.id});
    const replacement=await registerFactoryUpload(member,{...input,filename:"replacement-logo.png"});await completeFactoryUpload(member,replacement.id);
    expect((await getFactoryProjectBuilds(member,project.projectId))!.uploads.map(upload=>upload.id)).toEqual([replacement.id]);
    expect((await pool.query("SELECT status,retry_count,working_data,build_request_id FROM factory_build_versions WHERE id=$1",[job.id])).rows[0]).toEqual(before);
    expect((await pool.query("SELECT status,actual_micros FROM factory_build_costs WHERE id=$1",[costId])).rows[0]).toMatchObject({status:"settled",actual_micros:"100000"});
    expect((await pool.query("SELECT storage_prefix FROM factory_storage_cleanup")).rows.map(row=>row.storage_prefix)).toEqual([original.storageKey]);
  });

  describe("Saved website draft revisions",()=>{
    async function editableFixture(ready=false){
      const project=await prepared();await enable();const resources=await fixtureRuntime();
      for(let step=0;step<(ready?5:2);step++)expect((await runFactoryBuildWorkerStep(resources.runtime)).status).toBe("processed");
      if(!ready){const job=(await claimFactoryBuild())!;expect(await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"Synthetic design needs a shorter introduction."})).toBe(true);}
      const version=(await pool.query("SELECT * FROM factory_build_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1",[project.projectId])).rows[0];
      const draft=await getFactoryDraft(member,version.id);
      return {...project,...resources,version,draft};
    }
    function manual(draft:Awaited<ReturnType<typeof getFactoryDraft>>,requestId=randomUUID()){
      return {versionId:draft.versionId,fingerprint:draft.fingerprint,requestId,mode:"manual",pagePath:"index.html",sectionId:"__intro__",headline:"A clear next step for your project",body:draft.pages[0].hero.body,layout:null,items:null};
    }
    it("allows an editable saved draft only to an active editing teammate, and removes access with its lead",async()=>{
      const data=await editableFixture();expect(data.draft.pages).toHaveLength(2);expect(data.draft.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(data.draft)).not.toContain("inputHash");expect(JSON.stringify(data.draft)).not.toContain(data.version.storage_prefix);
      await expect(getFactoryDraft(viewer,data.version.id)).rejects.toThrow("workspace access");await expect(reviseFactoryDraft(viewer,manual(data.draft))).rejects.toThrow("workspace access");
      await expect(getFactoryDraft(other,data.version.id)).rejects.toThrow("no longer available");await expect(reviseFactoryDraft(other,manual(data.draft))).rejects.toThrow("no longer available");
      await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1",[data.leadId]);
      await expect(getFactoryDraft(member,data.version.id)).rejects.toThrow("no longer available");await expect(reviseFactoryDraft(member,manual(data.draft))).rejects.toThrow("no longer available");
    });
    it("queues only the chosen patch, reuses exact approval, rejects stale/current builds, and deduplicates retries",async()=>{
      const data=await editableFixture(),input=manual(data.draft),original=structuredClone(data.version.working_data);
      await expect(reviseFactoryDraft(member,{...input,fingerprint:"0".repeat(64)})).rejects.toThrow("draft changed");
      const result=await reviseFactoryDraft(member,input);expect(await reviseFactoryDraft(member,input)).toEqual(result);
      const child=(await pool.query("SELECT * FROM factory_build_versions WHERE id=$1",[result.versionId])).rows[0];
      const expected=structuredClone(original.blueprint);expected.pages[0].hero.headline=input.headline;
      expect(child).toMatchObject({kind:"revision",parent_version_id:data.version.id,build_request_id:data.version.build_request_id,status:"queued",stage:"images",version:2});
      expect(child.working_data.blueprint).toEqual(expected);expect(child.working_data.inputUploads).toEqual(original.inputUploads);expect(child.working_data.repaired).toBe(true);
      expect((await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[data.version.id])).rows[0].working_data).toEqual(original);
      expect((await pool.query("SELECT count(*)::int n FROM factory_build_requests WHERE project_id=$1",[data.projectId])).rows[0].n).toBe(1);
      expect((await pool.query("SELECT count(*)::int n FROM factory_build_versions WHERE project_id=$1",[data.projectId])).rows[0].n).toBe(2);
      await expect(reviseFactoryDraft(member,{...input,requestId:randomUUID()})).rejects.toThrow("newest website version");
      await expect(retryFactoryBuild(member,{versionId:data.version.id,requestId:randomUUID()})).rejects.toThrow("newest website version");
      expect((await pool.query("SELECT retry_count,status,working_data FROM factory_build_versions WHERE id=$1",[data.version.id])).rows[0]).toMatchObject({retry_count:0,status:"failed",working_data:original});
      await expect(getFactoryDraft(member,child.id)).rejects.toThrow("finish before editing");
      const job=(await claimFactoryBuild())!;await failFactoryBuild({versionId:job.id,leaseToken:job.leaseToken,error:"Synthetic queued revision stopped."});
      await expect(reviseFactoryDraft(member,{...input,requestId:randomUUID()})).rejects.toThrow("newest website version");
      await expect(retryFactoryBuild(member,{versionId:data.version.id,requestId:randomUUID()})).rejects.toThrow("newest website version");
    });
    it("copies saved images without generation, keeps ready parents immutable, and restores as another checked revision",async()=>{
      const data=await editableFixture(true),initial=structuredClone(data.version),hero=vi.fn(data.runtime.hero);data.runtime.hero=hero;
      const execute=data.runtime.execute,stages:string[]=[];data.runtime.execute=job=>async request=>{stages.push(request.stage);return execute(job)(request);};
      const revision=await reviseFactoryDraft(member,manual(data.draft));
      for(let step=0;step<4;step++)expect((await runFactoryBuildWorkerStep(data.runtime)).status).toBe("processed");
      expect(hero).not.toHaveBeenCalled();expect(stages).toEqual(["review"]);
      const child=(await pool.query("SELECT * FROM factory_build_versions WHERE id=$1",[revision.versionId])).rows[0];
      expect(child.status).toBe("ready");expect(child.draft_snapshot.blueprint.pages[0].hero.headline).toBe("A clear next step for your project");
      expect(data.objects.get(`${child.storage_prefix}assets/hero.png`)).toEqual(data.objects.get(`${initial.storage_prefix}assets/hero.png`));
      const preserved=(await pool.query("SELECT * FROM factory_build_versions WHERE id=$1",[initial.id])).rows[0];
      for(const key of ["manifest","qa_report","source_key","preview_token","storage_prefix","draft_snapshot","working_data","status"])expect(preserved[key]).toEqual(initial[key]);
      await expect(pool.query("UPDATE factory_build_versions SET draft_snapshot='{}'::jsonb WHERE id=$1",[initial.id])).rejects.toThrow("immutable");
      const current=await getFactoryDraft(member,child.id),restore=await reviseFactoryDraft(member,{versionId:child.id,fingerprint:current.fingerprint,requestId:randomUUID(),mode:"restore"});
      const restored=(await pool.query("SELECT * FROM factory_build_versions WHERE id=$1",[restore.versionId])).rows[0];
      expect(restored).toMatchObject({version:3,parent_version_id:child.id,build_request_id:initial.build_request_id,status:"queued",stage:"images"});
      expect(restored.working_data.blueprint).toEqual(initial.draft_snapshot.blueprint);expect(restored.working_data.draftRevision.sourceVersionId).toBe(initial.id);
      for(let step=0;step<4;step++)expect((await runFactoryBuildWorkerStep(data.runtime)).status).toBe("processed");
      expect(hero).not.toHaveBeenCalled();expect((await getFactoryDraft(member,restore.versionId)).pages[0].hero.headline).toBe(data.draft.pages[0].hero.headline);
      expect((await pool.query("SELECT count(*)::int n FROM factory_build_requests WHERE project_id=$1",[data.projectId])).rows[0].n).toBe(1);
    });
    it("applies an AI patch only to the selected introduction with real screenshot context and no new images",async()=>{
      const data=await editableFixture(),execute=data.runtime.execute,hero=vi.fn(data.runtime.hero),requests:unknown[]=[];data.runtime.hero=hero;
      const target="services/index.html",patch={headline:"Explore the right next step",body:"Compare the questions and priorities for your project before choosing a direction.",layout:null,items:null};
      data.runtime.execute=job=>async request=>{
        const raw=await execute(job)(request);
        if(request.stage!=="generate")return raw;
        requests.push(request.body);
        return {...raw as Record<string,unknown>,output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(patch)}]}]};
      };
      const revision=await reviseFactoryDraft(member,{versionId:data.version.id,fingerprint:data.draft.fingerprint,requestId:randomUUID(),mode:"ai",pagePath:target,sectionId:"__intro__",instruction:"Make this introduction clearer and more concise."});
      for(let step=0;step<5;step++)expect((await runFactoryBuildWorkerStep(data.runtime)).status).toBe("processed");
      expect(requests).toHaveLength(1);expect(JSON.stringify(requests[0])).toContain("input_image");expect(hero).not.toHaveBeenCalled();
      const child=(await pool.query("SELECT * FROM factory_build_versions WHERE id=$1",[revision.versionId])).rows[0],expected=structuredClone(data.version.working_data.blueprint);
      const changed=expected.pages.find((page:SiteBlueprint["pages"][number])=>page.path===target);changed.hero.headline=patch.headline;changed.hero.body=patch.body;
      expect(child.status).toBe("ready");expect(child.draft_snapshot.blueprint).toEqual(expected);
      expect((await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[data.version.id])).rows[0].working_data).toEqual(data.version.working_data);
    });
    it("revalidates a saved invalid AI patch on retry without another provider charge",async()=>{
      const data=await editableFixture(),execute=data.runtime.execute,calls=vi.fn(),hero=vi.fn(data.runtime.hero);data.runtime.hero=hero;
      data.runtime.execute=job=>async request=>{
        calls();const raw=await execute(job)(request);
        return {...raw as Record<string,unknown>,output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({headline:"Useful next steps",body:"A short introduction.",layout:"not-a-layout",items:null})}]}]};
      };
      const revision=await reviseFactoryDraft(member,{versionId:data.version.id,fingerprint:data.draft.fingerprint,requestId:randomUUID(),mode:"ai",pagePath:"index.html",sectionId:"__intro__",instruction:"Shorten the introduction."});
      expect((await runFactoryBuildWorkerStep(data.runtime)).status).toBe("failed");expect(calls).toHaveBeenCalledTimes(1);
      const before=(await pool.query("SELECT working_data FROM factory_build_versions WHERE id=$1",[revision.versionId])).rows[0].working_data;
      expect(before.generationResponse).toBeTruthy();expect(before.blueprint).toEqual(data.version.working_data.blueprint);
      await retryFactoryBuild(member,{versionId:revision.versionId,requestId:randomUUID()});expect((await runFactoryBuildWorkerStep(data.runtime)).status).toBe("failed");
      expect(calls).toHaveBeenCalledTimes(1);expect(hero).not.toHaveBeenCalled();
      expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE version_id=$1",[revision.versionId])).rows[0].n).toBe(1);
      expect((await getFactoryProjectBuilds(member,data.projectId))!.versions[0].previewUrl).toBeNull();
    });
    it("charges parent and revision requests against the same five-dollar approval including uncertain usage",async()=>{
      const project=await prepared();await enable();const {runtime}=await fixtureRuntime();
      for(let step=0;step<2;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
      const parent=(await claimFactoryBuild())!;
      const settled=await reserveFactoryBuildCost({versionId:parent.id,leaseToken:parent.leaseToken,stage:parent.stage,requestKey:"draft-parent-settled",reservedMicros:3_000_000});
      await attemptFactoryBuildCost(settled,parent.leaseToken);await settleFactoryBuildCost(settled,{actualMicros:3_000_000});
      const uncertain=await reserveFactoryBuildCost({versionId:parent.id,leaseToken:parent.leaseToken,stage:parent.stage,requestKey:"draft-parent-uncertain",reservedMicros:1_500_000});
      await attemptFactoryBuildCost(uncertain,parent.leaseToken);await uncertainFactoryBuildCost(uncertain);await failFactoryBuild({versionId:parent.id,leaseToken:parent.leaseToken,error:"Synthetic provider interruption."});
      const draft=await getFactoryDraft(member,parent.id);expect(draft.spentMicros).toBe(4_730_000);expect(draft.remainingMicros).toBe(270_000);
      const revision=await reviseFactoryDraft(member,manual(draft));expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
      const child=(await claimFactoryBuild())!;expect(child.id).toBe(revision.versionId);expect(child.stage).toBe("qa");
      const shared=await reserveFactoryBuildCost({versionId:child.id,leaseToken:child.leaseToken,stage:child.stage,requestKey:"draft-child-uncertain",reservedMicros:100_000});
      await attemptFactoryBuildCost(shared,child.leaseToken);await uncertainFactoryBuildCost(shared);
      await expect(reserveFactoryBuildCost({versionId:child.id,leaseToken:child.leaseToken,stage:child.stage,requestKey:"over-shared-approval",reservedMicros:200_000})).rejects.toThrow("allowance");
      const final=await reserveFactoryBuildCost({versionId:child.id,leaseToken:child.leaseToken,stage:child.stage,requestKey:"remaining-shared-approval",reservedMicros:170_000});
      await attemptFactoryBuildCost(final,child.leaseToken);await uncertainFactoryBuildCost(final);await failFactoryBuild({versionId:child.id,leaseToken:child.leaseToken,error:"Synthetic quality interruption."});
      const spent=await getFactoryDraft(member,child.id);expect(spent.spentMicros).toBe(5_000_000);expect(spent.remainingMicros).toBe(0);
      await expect(reviseFactoryDraft(member,{...manual(spent),headline:"Another focused direction"})).rejects.toThrow("used its build allowance");
      expect((await pool.query("SELECT count(*)::int n FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0].n).toBe(2);
    });
  });
});
