import {createHash,randomUUID} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import sharp from "sharp";
import type {Pool} from "pg";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("./build-config",()=>({factoryBuildConfiguration:()=>({configured:true,reason:null})}));
import {getDatabasePool} from "@/lib/dashboard/db";
import type {DashboardContext} from "@/lib/dashboard/data";
import {createManualLead} from "@/lib/operations/manual-leads";
import {saveFactorySettings,sendFactoryMessage,approveFactoryPlan} from "./service";
import {runFactoryWorkerStep} from "./worker";
import {runFactoryBuildWorkerStep,type FactoryBuildRuntime} from "./build-worker";
import {saveFactoryBuildSettings} from "./build-service";
import {getFactoryProject} from "./data";
import {getFactoryProjectBuilds,getFactoryPreviewResolution,factoryShareUrl} from "./build-data";
import {factoryManifestFingerprint} from "./public-verification";
import {reserveFactoryBuildCost,attemptFactoryBuildCost,settleFactoryBuildCost} from "./build-budget";
import {syncFactoryWorkNotices,getFactoryWorkNotices} from "./work-notices";
import {fixtureBlueprint,fixtureSitePlan} from "./site/fixtures";
import type {DesignFamilyId} from "./site/types";
import type {FactoryPlanContent} from "./types";

// This proves orchestration and member permissions with synthetic provider data,
// not the visual quality or research accuracy of a future paid model response.
const url=process.env.TEST_FACTORY_JOURNEY_DATABASE_URL;
const ws="00000000-0000-4000-8000-000000000001";
const context=(id:string,role:DashboardContext["role"]):DashboardContext=>({user:{id,name:id,email:`${id}@example.test`},workspace:{id:ws,name:"Journey fixture",slug:"journey"},role});
const owner=context("journey-owner","owner"),salesperson=context("journey-salesperson","member"),viewer=context("journey-viewer","viewer");
let pool:Pool;
const response=(content:unknown)=>({id:`synthetic-${randomUUID()}`,status:"completed",usage:{input_tokens:1200,output_tokens:800},output:[{type:"message",content:[{type:"output_text",text:typeof content==="string"?content:JSON.stringify(content),annotations:[]}]}]});

describe.skipIf(!url)("Salesperson-only lead-to-hosted-preview journey (no paid requests)",()=>{
  beforeAll(async()=>{
    const parsed=new URL(url!);
    if(parsed.hostname!=="127.0.0.1"||parsed.port!=="55433"||parsed.pathname!=="/ta_factory_journey_test"||parsed.search||parsed.hash)throw Error("Use exact isolated local ta_factory_journey_test database on port55433.");
    vi.stubEnv("DATABASE_URL",url!);vi.stubEnv("BETTER_AUTH_SECRET","synthetic-journey-secret-".repeat(4));vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-only");vi.stubEnv("FACTORY_PREVIEW_ORIGIN","https://previews.example.test");
    pool=getDatabasePool();await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
    for(const name of(await readdir("db/migrations")).filter(name=>name.endsWith(".sql")).sort()){
      if((await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[name])).rowCount)continue;
      const db=await pool.connect();try{await db.query("BEGIN");await db.query(await readFile(`db/migrations/${name}`,"utf8"));await db.query("INSERT INTO schema_migrations(filename) VALUES($1)",[name]);await db.query("COMMIT");}catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
    }
  },60000);
  beforeEach(async()=>{
    for(const table of ["factory_projects","factory_settings","factory_build_settings","factory_costs","factory_build_costs","factory_storage_cleanup","leads"])await pool.query(`DELETE FROM ${table}`);
    for(const actor of [owner,salesperson,viewer]){
      await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2) ON CONFLICT(id) DO NOTHING',[actor.user.id,actor.user.email]);
      await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active'",[randomUUID(),ws,actor.user.id,actor.role]);
    }
    // Owner setup is complete before a lead arrives. All subsequent human actions
    // are by a Member; the background workers require no logged-in browser.
    await saveFactorySettings(owner,{researchEnabled:true,autoResearch:true,monthlyBudgetDollars:25});
    await saveFactoryBuildSettings(owner,{enabled:true,monthlyBudgetDollars:50,perBuildBudgetDollars:5});
  });
  afterAll(async()=>{await pool?.end();delete(globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});

  it.each([
    {family:"wellness" as DesignFamilyId,company:"None",brief:"Beauty service concept; no website or confirmed business name."},
    {family:"professional" as DesignFamilyId,company:"Example Advisory",brief:"Business advisory services; wants a new website."},
    {family:"general" as DesignFamilyId,company:"",brief:"No industry or website supplied; prepare a useful provisional concept."},
  ])("takes $family from sparse intake through review, correction and sharing",async({family,company,brief})=>{
    const plan:FactoryPlanContent={...structuredClone(fixtureSitePlan),summary:brief,goal:brief,design:{...fixtureSitePlan.design,direction:`A ${family} concept within the submitted brief`}};
    const {sources:_sources,...providerPlan}=plan;
    let revision=false,researchCalls=0;
    const research=vi.fn(async(address:string,options:RequestInit)=>{
      expect(String(address)).toBe("https://api.openai.com/v1/responses");
      const body=JSON.parse(String(options.body));researchCalls++;
      return new Response(JSON.stringify(response(body.text?{changed:true,reply:"The proposal is ready to review.",changeSummary:revision?"Clarified the visitor's next step":"Prepared the initial concept",plan:{...providerPlan,summary:revision?`${brief} Focus the next step on an inquiry.`:brief}}:"No reliable business identity or website was established. Use submitted context and distinguish unknown details.")));
    });
    vi.stubGlobal("fetch",research);
    const intake={submissionId:randomUUID(),name:"Synthetic lead",email:"lead@example.test",organization:company,description:brief};
    const lead=await createManualLead(salesperson,intake);expect(await createManualLead(salesperson,intake)).toEqual(lead);
    const projects=(await pool.query("SELECT id FROM factory_projects WHERE lead_id=$1",[lead.leadId])).rows;expect(projects).toHaveLength(1);
    const projectId=projects[0].id;
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_versions")).rows[0].n).toBe(0);
    for(let step=0;step<2;step++)expect((await runFactoryWorkerStep()).failed).toBe(0);
    await syncFactoryWorkNotices();
    expect((await getFactoryWorkNotices(salesperson)).items).toEqual([expect.objectContaining({projectId,kind:"plan_ready"})]);
    const initial=(await getFactoryProject(salesperson,projectId))!;expect(initial.project.companyName).toBe(company==="None"?"":company);
    const firstPlan=(await pool.query("SELECT current_plan_id FROM factory_projects WHERE id=$1",[projectId])).rows[0].current_plan_id;
    await expect(approveFactoryPlan(viewer,{projectId,planId:firstPlan})).rejects.toThrow("workspace access");
    await sendFactoryMessage(salesperson,{projectId,requestId:randomUUID(),body:"Focus the next step on an inquiry.",referenceUrls:[]});revision=true;
    await expect(approveFactoryPlan(salesperson,{projectId,planId:firstPlan})).rejects.toThrow("pending planning response");
    for(let step=0;step<2;step++)expect((await runFactoryWorkerStep()).failed).toBe(0);
    const approvedId=(await pool.query("SELECT current_plan_id FROM factory_projects WHERE id=$1",[projectId])).rows[0].current_plan_id;
    await expect(approveFactoryPlan(salesperson,{projectId,planId:firstPlan})).rejects.toThrow("latest version");
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_versions")).rows[0].n).toBe(0);
    await Promise.all([approveFactoryPlan(salesperson,{projectId,planId:approvedId}),approveFactoryPlan(salesperson,{projectId,planId:approvedId})]);
    expect((await pool.query("SELECT approved_by FROM factory_build_requests")).rows).toEqual([{approved_by:salesperson.user.id}]);

    const blueprint=fixtureBlueprint(family,undefined,true),objects=new Map<string,Uint8Array>();
    const image=new Uint8Array(await sharp({create:{width:1000,height:700,channels:3,background:"#38586a"}}).png().toBuffer());
    let reviews=0,corrections=0,generations=0;
    const runtime:FactoryBuildRuntime={
      storage:{async put(key,bytes){objects.set(key,Uint8Array.from(bytes));},async get(key){const data=objects.get(key);if(!data)throw Error("Synthetic object missing");return data;},async deletePrefix(prefix){for(const key of objects.keys())if(key.startsWith(prefix))objects.delete(key);}},
      execute:build=>async request=>{
        const receipt=await reserveFactoryBuildCost({versionId:build.id,leaseToken:build.leaseToken,stage:build.stage,requestKey:`fixture-${randomUUID()}`,reservedMicros:request.reservedMicros});
        await attemptFactoryBuildCost(receipt,build.leaseToken);await settleFactoryBuildCost(receipt,{actualMicros:100000,providerId:"synthetic-journey"});
        if(request.stage==="repair"){
          corrections++;const section=blueprint.pages[0].sections[0];
          return response({patches:[{target:{pagePath:"index.html",sectionId:section.id},content:{headline:"A clearer starting point",body:section.body,layout:null,items:null},issueIds:["issue-1"]}],unresolved:[]});
        }
        if(request.stage!=="review"){generations++;return response(blueprint);}
        reviews++;
        return response({summary:"Synthetic review for workflow verification only.",scorecard:Object.fromEntries(["firstImpression","composition","imagery","copy","usefulness","mobile"].map(key=>[key,{score:90,evidence:[{page:"index.html",observation:"Synthetic score used only to exercise the workflow; not a design-quality claim."}],improvement:"Preserve the approved composition and working content."}])),issues:reviews===1?[{page:"index.html",sectionId:blueprint.pages[0].sections[0].id,repairability:"content",category:"content",severity:"error",message:"Give this first section a distinct clear starting-point heading."}]:[]});
      },
      async hero(){return {bytes:image,provenance:{kind:"synthetic-fixture"}};},
      async qa(files){return {passed:true,issues:[],checkedAt:new Date().toISOString(),screenshots:Object.keys(files).filter(name=>name.endsWith(".html")).flatMap(page=>(["desktop","mobile"] as const).map(viewport=>({page,viewport,bytes:image})))};},
      async verify(build,manifest){
        expect(await getFactoryPreviewResolution(build.previewToken)).toBeNull();
        for(const file of manifest.files){const bytes=objects.get(`${build.storagePrefix}preview/${file.path}`)!;expect(bytes.byteLength).toBe(file.size);expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);}
        return {url:`https://previews.example.test/p/${build.previewToken}/`,status:200,checkedAt:new Date().toISOString()};
      },
      async verifyPublic(build,manifest){
        expect((await getFactoryPreviewResolution(build.previewToken))?.ready).toBe(true);
        return {url:factoryShareUrl(build.previewToken,build.previewSlug)!,status:200,checkedAt:new Date().toISOString(),manifestHash:factoryManifestFingerprint(manifest)};
      },
    };
    for(let step=0;step<10;step++){
      const result=await runFactoryBuildWorkerStep(runtime);
      if(result.status==="failed")throw Error(JSON.stringify((await pool.query("SELECT stage,error FROM factory_build_versions")).rows));
      if(result.status==="idle")break;
    }
    const result=await getFactoryProjectBuilds(salesperson,projectId);
    expect(result!.versions).toHaveLength(1);expect(result!.versions[0]).toMatchObject({status:"ready",planId:approvedId,sourceReady:true});
    expect(result!.versions[0].previewUrl).toMatch(/\/preview\/[a-z0-9-]+$/);
    expect(generations).toBe(1);expect(corrections).toBe(1);expect(reviews).toBe(2);expect(researchCalls).toBe(4);
    const saved=(await pool.query("SELECT draft_snapshot FROM factory_build_versions")).rows[0].draft_snapshot;
    expect(saved.blueprint.family).toBe(family);expect(saved.blueprint.pages[0].sections[0].title).toBe("A clearer starting point");
    expect(saved.blueprint.interactions).toEqual(blueprint.interactions);expect(saved.blueprint.contact).toEqual(blueprint.contact);
    await syncFactoryWorkNotices();await syncFactoryWorkNotices();
    expect((await getFactoryWorkNotices(salesperson)).items).toEqual([expect.objectContaining({projectId,kind:"website_ready"})]);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_versions")).rows[0].n).toBe(1);
  },30000);
});
