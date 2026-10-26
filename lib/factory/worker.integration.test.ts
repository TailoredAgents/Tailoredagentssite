import { randomUUID } from "node:crypto";
import { readFile,readdir } from "node:fs/promises";
import type { Pool } from "pg";
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { getDatabasePool } from "@/lib/dashboard/db";
import type { DashboardContext } from "@/lib/dashboard/data";
import { runFactoryWorkerStep } from "./worker";
import { startFactory,sendFactoryMessage,approveFactoryPlan,retryFactoryJob } from "./service";
import { reserveFactoryCost,attemptFactoryCost,settleFactoryCost,uncertainFactoryCost } from "./budget";
const url=process.env.TEST_FACTORY_WORKER_DATABASE_URL;
const ws="00000000-0000-4000-8000-000000000001";
const owner:DashboardContext={user:{id:"factory-worker-owner",name:"Owner",email:"worker@example.test"},workspace:{id:ws,name:"Fixture",slug:"fixture"},role:"owner"};
const request=vi.fn();let pool:Pool,leadId:string;
const genericPlan=()=>({summary:"General website concept for an unverified business",goal:"Explain services",audience:"Potential customers",knownDetails:[{label:"Company",value:"None (submitted, not established)",basis:"submitted",sourceIds:[]}],uncertainties:["Company identity and location are unknown","No website was supplied; that does not prove one does not exist"],assumptions:["A general service-business layout is a starting concept"],pages:[{title:"Home",purpose:"Introduce the offering",sections:["Introduction","Services","Contact"]}],callsToAction:["Contact us"],design:{direction:"Clean editorial with a warm accent",palette:["Navy","Warm cream"],typography:"Readable sans serif",imagery:"Illustrations; no invented team photos"},previewFeatures:["Demo inquiry form"],productionIntegrations:["Connect form delivery"]});
function modelReply(plan=false,changed=true){return new Response(JSON.stringify({id:`resp_${randomUUID()}`,status:"completed",usage:{input_tokens:1400,output_tokens:300},output:[{type:"message",content:[{type:"output_text",text:plan?JSON.stringify({changed,reply:changed?"Here is the revised plan for review.":"Yes, the form is only a demonstration.",changeSummary:changed?"Prepared the requested concept":"Answered the question; plan unchanged",plan:genericPlan()}):"No reliable public identity found. Prepare a general concept and label assumptions.",annotations:[]}]}]}));}
async function queue(){return (await startFactory(owner,{leadId})).projectId;}
async function job(projectId:string){return (await pool.query("SELECT * FROM factory_jobs WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",[projectId])).rows[0];}
async function markRunning(projectId:string){const lease=randomUUID();const r=(await pool.query("UPDATE factory_jobs SET status='running',lease_token=$2,lease_until=now()+interval '2 minutes',attempts=1 WHERE project_id=$1 AND status='queued' RETURNING id",[projectId,lease])).rows[0];return {workspaceId:ws,projectId,jobId:r.id,leaseToken:lease,stage:"research" as const,attempt:1};}

describe.skipIf(!url)("Factory worker and budget with synthetic provider responses",()=>{
  beforeAll(async()=>{
    const u=new URL(url!);if(u.hostname!=="127.0.0.1"||u.port!=="55433"||u.pathname!=="/ta_factory_worker_test"||u.search||u.hash)throw Error("Use exact isolated local ta_factory_worker_test database on port55433.");
    vi.stubEnv("DATABASE_URL",url!);vi.stubEnv("BETTER_AUTH_SECRET","synthetic-factory-secret-".repeat(4));vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-only");
    pool=getDatabasePool();await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
    for(const name of(await readdir("db/migrations")).filter(n=>n.endsWith(".sql")).sort()){
      if((await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[name])).rowCount)continue;
      const db=await pool.connect();try{await db.query("BEGIN");await db.query(await readFile(`db/migrations/${name}`,"utf8"));await db.query("INSERT INTO schema_migrations(filename) VALUES($1)",[name]);await db.query("COMMIT");}catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
    }
  },60000);
  beforeEach(async()=>{
    request.mockReset();vi.stubGlobal("fetch",request);request.mockImplementation(async(_u:string,options:RequestInit)=>modelReply(Boolean(JSON.parse(String(options.body)).text)));
    await pool.query("DELETE FROM factory_projects");await pool.query("DELETE FROM factory_costs");await pool.query("DELETE FROM factory_settings");await pool.query("DELETE FROM leads");
    await pool.query("UPDATE workspaces SET status='active' WHERE id=$1",[ws]);
    await pool.query(`INSERT INTO "user"(id,name,email) VALUES($1,'Owner',$2) ON CONFLICT(id) DO NOTHING`,[owner.user.id,owner.user.email]);
    await pool.query(`INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active') ON CONFLICT(workspace_id,user_id) DO UPDATE SET role='owner',status='active'`,[randomUUID(),ws,owner.user.id]);
    await pool.query("INSERT INTO factory_settings(workspace_id,research_enabled,budget_approved_at,monthly_budget_micros) VALUES($1,true,now(),25000000)",[ws]);
    leadId=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source) VALUES($1,$2,'New person','None','manual')",[leadId,ws]);
  });
  afterAll(async()=>{await pool?.end();delete(globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it("creates a plan from a sparse/fake company in two durable stages, never a build",async()=>{
    const projectId=await queue();await pool.query("INSERT INTO lead_notes(id,workspace_id,lead_id,body) VALUES($1,$2,$3,'They want their first website')",[randomUUID(),ws,leadId]);
    expect(await runFactoryWorkerStep()).toEqual({checked:1,failed:0,more:true});
    const saved=await job(projectId);expect(saved).toMatchObject({stage:"plan",status:"queued"});expect(saved.input_snapshot.lead.organization).toBe("None");expect(saved.input_snapshot.notes).toContain("They want their first website");expect(Object.keys(saved.input_snapshot).sort()).toEqual(["contextNotice","lead","messages","notes","previousPlan"]);
    expect((await pool.query("SELECT count(*)::int n FROM factory_plans")).rows[0].n).toBe(0);
    expect(await runFactoryWorkerStep()).toEqual({checked:1,failed:0,more:false});
    expect((await job(projectId)).status).toBe("succeeded");expect((await pool.query("SELECT content FROM factory_plans")).rows[0].content.uncertainties).toHaveLength(2);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_requests")).rows[0].n).toBe(0);expect(request).toHaveBeenCalledTimes(2);
  });
  it("keeps paid work off without explicit enablement and budget approval",async()=>{
    await queue();await pool.query("UPDATE factory_settings SET budget_approved_at=NULL");expect((await runFactoryWorkerStep()).checked).toBe(0);
    await pool.query("UPDATE factory_settings SET research_enabled=false,budget_approved_at=now()");expect((await runFactoryWorkerStep()).checked).toBe(0);expect(request).not.toHaveBeenCalled();
  });
  it("prevents concurrent workers from double sending the same stage",async()=>{
    await queue();let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
    request.mockImplementationOnce(async()=>{await wait;return modelReply();});const first=runFactoryWorkerStep();
    await vi.waitFor(()=>expect(request).toHaveBeenCalledOnce());const second=await runFactoryWorkerStep();expect(second.checked).toBe(0);release();await first;
    expect(request).toHaveBeenCalledOnce();expect((await pool.query("SELECT count(*)::int n FROM factory_costs")).rows[0].n).toBe(1);
  });
  it("keeps exact approved plan immutable through chat and no-op replies",async()=>{
    const projectId=await queue();await runFactoryWorkerStep();await runFactoryWorkerStep();
    const first=(await pool.query("SELECT id FROM factory_plans WHERE project_id=$1",[projectId])).rows[0].id;
    await approveFactoryPlan(owner,{projectId,planId:first});
    await sendFactoryMessage(owner,{projectId,body:"Is the contact form a demonstration?",referenceUrls:[],requestId:randomUUID()});
    await runFactoryWorkerStep();request.mockResolvedValueOnce(modelReply(true,false));await runFactoryWorkerStep();
    expect((await pool.query("SELECT count(*)::int n FROM factory_plans WHERE project_id=$1",[projectId])).rows[0].n).toBe(1);
    expect((await pool.query("SELECT status,current_plan_id FROM factory_projects WHERE id=$1",[projectId])).rows[0]).toEqual({status:"approved",current_plan_id:first});
    expect((await pool.query("SELECT plan_id FROM factory_build_requests")).rows[0].plan_id).toBe(first);
  });
  it("retains unknown charges and requires an explicit retry without resending automatically",async()=>{
    const projectId=await queue();request.mockRejectedValueOnce(new Error("Transport failed with secret raw detail"));
    expect((await runFactoryWorkerStep()).failed).toBe(1);expect((await job(projectId)).error).not.toContain("secret");expect((await pool.query("SELECT status FROM factory_costs")).rows[0].status).toBe("uncertain");
    await runFactoryWorkerStep();expect(request).toHaveBeenCalledOnce();
    await retryFactoryJob(owner,{projectId,jobId:(await job(projectId)).id,requestId:randomUUID()});await runFactoryWorkerStep();expect(request).toHaveBeenCalledTimes(2);
    expect((await pool.query("SELECT count(*)::int n FROM factory_costs")).rows[0].n).toBe(2);
  });
  it("retains uncertain reserved spend but allows another job within remaining allowance",async()=>{
    await pool.query("UPDATE factory_settings SET monthly_budget_micros=1000000");const p1=await queue();const c1=await markRunning(p1);
    const first=await reserveFactoryCost({...c1,micros:900000});await attemptFactoryCost(first,c1.leaseToken);await uncertainFactoryCost(first);
    leadId=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source) VALUES($1,$2,'Other','','manual')",[leadId,ws]);const p2=await queue();const c2=await markRunning(p2);
    const next=await reserveFactoryCost({...c2,micros:90000});await attemptFactoryCost(next,c2.leaseToken);
    await expect(reserveFactoryCost({...c2,attempt:2,micros:20000})).rejects.toThrow("monthly Factory allowance");
    expect((await pool.query("SELECT reserved_micros FROM factory_costs WHERE id=$1",[first])).rows[0].reserved_micros).toBe("900000");
  });
  it("serializes budget reservations across different projects",async()=>{
    await pool.query("UPDATE factory_settings SET monthly_budget_micros=1000000");const first=await markRunning(await queue());
    leadId=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source) VALUES($1,$2,'Second','','manual')",[leadId,ws]);const second=await markRunning(await queue());
    const results=await Promise.allSettled([reserveFactoryCost({...first,micros:700000}),reserveFactoryCost({...second,micros:700000})]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
  });
  it("records unexpected overage and pauses paid planning",async()=>{
    const ctx=await markRunning(await queue());const id=await reserveFactoryCost({...ctx,micros:100});await attemptFactoryCost(id,ctx.leaseToken);
    await expect(settleFactoryCost(id,101,"resp-fixture",{input_tokens:1,output_tokens:1})).rejects.toThrow("exceeded its reservation");
    expect((await pool.query("SELECT research_enabled FROM factory_settings")).rows[0].research_enabled).toBe(false);expect((await pool.query("SELECT actual_micros FROM factory_costs WHERE id=$1",[id])).rows[0].actual_micros).toBe("101");
  });
  it("does not resurrect a lead deleted while the provider is responding, but keeps its receipt",async()=>{
    await queue();request.mockImplementationOnce(async()=>{await pool.query("DELETE FROM leads WHERE id=$1",[leadId]);return modelReply();});
    await runFactoryWorkerStep();expect((await pool.query("SELECT count(*)::int n FROM factory_projects")).rows[0].n).toBe(0);expect((await pool.query("SELECT count(*)::int n FROM factory_plans")).rows[0].n).toBe(0);
    expect((await pool.query("SELECT job_id,status FROM factory_costs")).rows[0]).toEqual({job_id:null,status:"settled"});
  });
  it("discards a result if the owner pauses research during the request",async()=>{
    const projectId=await queue();request.mockImplementationOnce(async()=>{await pool.query("UPDATE factory_settings SET research_enabled=false");return modelReply();});
    await runFactoryWorkerStep();expect((await job(projectId)).status).toBe("failed");expect((await pool.query("SELECT count(*)::int n FROM factory_plans")).rows[0].n).toBe(0);
  });
  it("marks stale leases failed and preserves potentially charged reservations",async()=>{
    const projectId=await queue();const ctx=await markRunning(projectId);const cost=await reserveFactoryCost({...ctx,micros:100000});await attemptFactoryCost(cost,ctx.leaseToken);
    await pool.query("UPDATE factory_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1",[ctx.jobId]);
    const result=await runFactoryWorkerStep();expect(result.failed).toBe(1);expect((await job(projectId)).status).toBe("failed");expect((await pool.query("SELECT status FROM factory_costs WHERE id=$1",[cost])).rows[0].status).toBe("uncertain");expect(request).not.toHaveBeenCalled();
  });
});
