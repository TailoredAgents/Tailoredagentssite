import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {readFile,readdir} from "node:fs/promises";
import type {Pool} from "pg";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import type {DashboardContext} from "@/lib/dashboard/data";
import {getDatabasePool} from "@/lib/dashboard/db";
import {approveFactoryPlan,startFactory} from "./service";
import {claimFactoryBuild,saveFactoryBuildStage,finishFactoryBuild,saveFactoryBuildSettings,failFactoryBuild,retryFactoryBuild,revokeFactoryPreview,restoreFactoryPreview,recoverFactoryBuilds,registerFactoryUpload,completeFactoryUpload,deleteFactoryUpload,claimFactoryStorageCleanup,finishFactoryStorageCleanup,queueApprovedFactoryBuild} from "./build-service";
import {getFactoryProjectBuilds,getFactoryPreviewResolution,getFactorySourceDownload,getFactoryScreenshotDownload,getFactoryUploadDownload} from "./build-data";
import {reserveFactoryBuildCost,attemptFactoryBuildCost,settleFactoryBuildCost,uncertainFactoryBuildCost} from "./build-budget";
import type {FactoryClaimedBuild,FactoryBuildQa,FactoryBuildManifest} from "./build-types";
import type {FactoryPlanContent} from "./types";
import {fixtureBlueprint} from "./site/fixtures";
import type {SiteBlueprint} from "./site/types";
import {runFactoryBuildWorkerStep,type FactoryBuildRuntime} from "./build-worker";
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
async function prepared(approve=true,company=""){
  const leadId=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email) VALUES($1,$2,'Sparse person',$3,NULL)",[leadId,ws,company]);
  const {projectId}=await startFactory(member,{leadId});
  const job=(await pool.query("UPDATE factory_jobs SET status='succeeded' WHERE project_id=$1 RETURNING id",[projectId])).rows[0];const planId=randomUUID();
  await pool.query(`INSERT INTO factory_plans(id,workspace_id,project_id,version,content,change_summary,job_id) VALUES($1,$2,$3,1,$5::jsonb,'Initial concept',$4)`,[planId,ws,projectId,job.id,JSON.stringify(approvedPlan)]);
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
async function fixtureRuntime(){
  const objects=new Map<string,Uint8Array>(),image=new Uint8Array(await sharp({create:{width:1200,height:800,channels:3,background:"#456078"}}).png().toBuffer());
  const runtime:FactoryBuildRuntime={storage:{async put(key,bytes){objects.set(key,Uint8Array.from(bytes));},async get(key){const value=objects.get(key);if(!value)throw Error("Fixture object missing");return value;},async deletePrefix(prefix){for(const key of objects.keys())if(key.startsWith(prefix))objects.delete(key);}},
    execute:build=>async request=>{const id=await reserveFactoryBuildCost({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,requestKey:`fixture-${randomUUID()}`,reservedMicros:request.reservedMicros});await attemptFactoryBuildCost(id,build.leaseToken);await settleFactoryBuildCost(id,{actualMicros:100000,providerId:"synthetic-model"});return {id:"synthetic-model",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(blueprint)}]}]};},
    async hero(build){const id=await reserveFactoryBuildCost({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,requestKey:"fixture-image",reservedMicros:2000000});await attemptFactoryBuildCost(id,build.leaseToken);await settleFactoryBuildCost(id,{actualMicros:130000,providerId:"synthetic-image"});return {bytes:image,provenance:{kind:"generated",model:"synthetic-fixture"}};},
    async qa(files){expect(files["index.html"]).toBeTruthy();expect(files["services/index.html"]).toBeTruthy();return {passed:true,issues:[],checkedAt:new Date().toISOString(),screenshots:[{page:"index.html",viewport:"desktop",bytes:image},{page:"index.html",viewport:"mobile",bytes:image}]};},
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
  it("serializes concurrent reservations, counts uncertain costs, and refuses replayed provider attempts",async()=>{
    await prepared();await enable(2,1);const job=(await claimFactoryBuild())!;
    const requests=await Promise.allSettled([reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"one",reservedMicros:600000}),reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"two",reservedMicros:600000})]);
    expect(requests.filter(r=>r.status==="fulfilled")).toHaveLength(1);const receipt=(requests.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<string>).value;
    await attemptFactoryBuildCost(receipt,job.leaseToken);await expect(attemptFactoryBuildCost(receipt,job.leaseToken)).rejects.toThrow("already attempted");await uncertainFactoryBuildCost(receipt);
    await expect(reserveFactoryBuildCost({versionId:job.id,leaseToken:job.leaseToken,stage:"generate",requestKey:"more",reservedMicros:500000})).rejects.toThrow("this website version");
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
    const source=await getFactorySourceDownload(member,result.versions[0].id),archive=unzipStored(objects.get(source.storageKey)!);expect(archive.has("build.mjs")).toBe(true);expect(archive.has("render.yaml")).toBe(true);expect(archive.has("package-lock.json")).toBe(true);expect(archive.has("site/services/index.html")).toBe(true);expect(archive.has("site/assets/images/hero.png")).toBe(true);
    const prefix=source.storageKey.slice(0,-"source.zip".length);for(const [name,bytes]of archive)if(name.startsWith("site/"))expect(bytes).toEqual(Buffer.from(objects.get(`${prefix}preview/${name.slice(5)}`)!));
    expect(result.monthSpentMicros).toBe(230000);expect((await pool.query("SELECT count(*)::int n FROM factory_build_costs WHERE status='settled'")).rows[0].n).toBe(2);
  });
  it("keeps failed verification private and preserves artifacts for an explicit retry",async()=>{
    const project=await prepared();await enable();const {runtime,objects}=await fixtureRuntime();for(let step=0;step<4;step++)expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("processed");
    runtime.verify=async()=>{throw Error("Unreachable hosted preview");};expect((await runFactoryBuildWorkerStep(runtime)).status).toBe("failed");const row=(await pool.query("SELECT id,preview_token,source_key FROM factory_build_versions WHERE project_id=$1",[project.projectId])).rows[0];
    expect(objects.has(row.source_key)).toBe(true);expect(await getFactoryPreviewResolution(row.preview_token)).toBeNull();await expect(getFactorySourceDownload(member,row.id)).rejects.toThrow("not available");
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
});
