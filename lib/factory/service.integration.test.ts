import { randomUUID } from "node:crypto";
import { readFile,readdir } from "node:fs/promises";
import type { Pool } from "pg";
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from "vitest";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { startFactory,sendFactoryMessage,approveFactoryPlan,saveFactorySettings,retryFactoryJob,enqueueFactoryLead } from "./service";
import { getFactoryProject,getFactoryWorkspace,getFactoryLeadProject,getFactoryLeadChoices } from "./data";
import { createManualLead } from "@/lib/operations/manual-leads";
import { storePublicInquiry } from "@/lib/operations/public-inquiries";
vi.mock("server-only",()=>({}));
const url=process.env.TEST_FACTORY_DATABASE_URL;
const ws="00000000-0000-4000-8000-000000000001",otherWs="00000000-0000-4000-8000-000000000992";
const actor=(id="factory-owner",workspace=ws,role:DashboardContext["role"]="owner"):DashboardContext=>({user:{id,name:id,email:`${id}@example.test`},workspace:{id:workspace,name:"Factory fixture",slug:"factory"},role});
const owner=actor(),member=actor("factory-member",ws,"member"),viewer=actor("factory-viewer",ws,"owner"),other=actor("factory-other",otherWs);
let pool:Pool,leadId:string;
async function chat(projectId:string,body="Focus on booking consultations",requestId=randomUUID(),context=member){return sendFactoryMessage(context,{projectId,body,requestId,referenceUrls:[]});}
async function plan(projectId:string,version=1){
  const jobId=randomUUID(),planId=randomUUID();
  await pool.query("UPDATE factory_jobs SET status='succeeded',finished_at=now() WHERE project_id=$1 AND status IN ('queued','running')",[projectId]);
  await pool.query(`INSERT INTO factory_jobs(id,workspace_id,project_id,kind,request_key,status) VALUES($1::uuid,$2,$3,'research',$1::text,'succeeded')`,[jobId,ws,projectId]);
  await pool.query(`INSERT INTO factory_plans(id,workspace_id,project_id,version,content,change_summary,job_id) VALUES($1,$2,$3,$4,'{"summary":"A general concept with unknown business details"}','Initial concept',$5)`,[planId,ws,projectId,version,jobId]);
  await pool.query("UPDATE factory_projects SET current_plan_id=$1,status='plan_ready' WHERE id=$2",[planId,projectId]);
  return planId;
}
describe.skipIf(!url)("Website Factory planning authorization and durable workflow",()=>{
  beforeAll(async()=>{
    const parsed=new URL(url!);
    if(!["127.0.0.1","localhost"].includes(parsed.hostname)||parsed.port!=="55433"||parsed.pathname!=="/ta_factory_test"||parsed.search||parsed.hash)throw Error("Use exact local ta_factory_test on port55433.");
    vi.stubEnv("DATABASE_URL",url!);vi.stubEnv("BETTER_AUTH_SECRET","factory-test-secret-".repeat(4));vi.stubEnv("OPENAI_API_KEY","");vi.stubEnv("FACTORY_OPENAI_API_KEY","");
    pool=getDatabasePool();
    await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
    for(const name of (await readdir("db/migrations")).filter(v=>v.endsWith(".sql")).sort()){
      if((await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[name])).rowCount)continue;
      await pool.query("BEGIN");
      try{await pool.query(await readFile(`db/migrations/${name}`,"utf8"));await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)",[name]);await pool.query("COMMIT");}catch(e){await pool.query("ROLLBACK");throw e;}
    }
  },60000);
  beforeEach(async()=>{
    await pool.query("DELETE FROM factory_projects");await pool.query("DELETE FROM factory_settings");await pool.query("DELETE FROM factory_costs");await pool.query("DELETE FROM leads");
    await pool.query(`INSERT INTO workspaces(id,slug,name,kind) VALUES($1,'factory-other','Other fixture','internal') ON CONFLICT(id) DO UPDATE SET status='active'`,[otherWs]);
    for(const [ctx,role] of [[owner,"owner"],[member,"member"],[viewer,"viewer"],[other,"owner"]] as const){
      await pool.query(`INSERT INTO "user"(id,name,email) VALUES($1,$1,$2) ON CONFLICT(id) DO NOTHING`,[ctx.user.id,ctx.user.email]);
      await pool.query(`INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(workspace_id,user_id) DO UPDATE SET status='active',role=EXCLUDED.role`,[randomUUID(),ctx.workspace.id,ctx.user.id,role]);
    }
    leadId=randomUUID();
    await pool.query(`INSERT INTO leads(id,workspace_id,name,organization,email,source) VALUES($1,$2,'New person','None',NULL,'manual')`,[leadId,ws]);
  });
  afterAll(async()=>{await pool?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
  it("opens a sparse lead with settings disabled and idempotently queues no build",async()=>{
    const [first,second]=await Promise.all([startFactory(member,{leadId}),startFactory(member,{leadId})]);
    expect(first.projectId).toBe(second.projectId);
    expect((await pool.query("SELECT count(*)::int n FROM factory_jobs")).rows[0].n).toBe(1);
    expect((await pool.query("SELECT count(*)::int n FROM factory_build_requests")).rows[0].n).toBe(0);
    const result=await getFactoryProject(member,first.projectId);
    expect(result?.project.companyName).toBe("");expect(result?.settings.researchEnabled).toBe(false);expect(result?.config.configured).toBe(false);
    expect((await pool.query("SELECT organization FROM leads WHERE id=$1",[leadId])).rows[0].organization).toBe("None");
  });
  it("rechecks viewer, membership, and workspace boundaries instead of trusting context.role",async()=>{
    await expect(startFactory(viewer,{leadId})).rejects.toThrow("workspace access");
    await expect(startFactory(other,{leadId})).rejects.toThrow("no longer available");
    const {projectId}=await startFactory(member,{leadId});
    expect(await getFactoryProject(other,projectId)).toBeNull();expect(await getFactoryLeadProject(other,leadId)).toBeNull();
    await expect(chat(projectId,"x",randomUUID(),other)).rejects.toThrow("no longer available");
    await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);
    await expect(getFactoryWorkspace(member)).rejects.toThrow("workspace access");
  });
  it("finds only available workspace leads and reopens existing projects without side effects",async()=>{
    const foreignId=randomUUID(),removedId=randomUUID();
    await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source) VALUES($1,$2,'New foreign person','','manual'),($3,$4,'New removed person','','manual')",[foreignId,otherWs,removedId,ws]);
    await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1",[removedId]);
    const initial=await getFactoryLeadChoices(member," NEW ");
    expect(initial.canEdit).toBe(true);
    expect(initial.leads).toEqual([{id:leadId,name:"New person",company:"",email:null,phone:null,projectId:null}]);
    expect((await pool.query("SELECT count(*)::int n FROM factory_jobs")).rows[0].n).toBe(0);
    expect((await getFactoryLeadChoices(member,"%" )).leads).toEqual([]);
    const {projectId}=await startFactory(member,{leadId});
    expect((await getFactoryLeadChoices(viewer,"person")).canEdit).toBe(false);
    expect((await getFactoryLeadChoices(viewer,"person")).leads[0].projectId).toBe(projectId);
    expect((await getFactoryLeadChoices(other,"")).leads.map(l=>l.id)).toEqual([foreignId]);
    await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);
    await expect(getFactoryLeadChoices(member,"")).rejects.toThrow("workspace access");
  });
  it("stores preapproval chat and references once even while paid research is disabled",async()=>{
    const {projectId}=await startFactory(owner,{leadId});const requestId=randomUUID();
    const input={projectId,requestId,body:"Actually they need their first site",referenceUrls:["https://example.com/inspiration"]};
    await Promise.all([sendFactoryMessage(member,input),sendFactoryMessage(member,input)]);
    expect((await getFactoryProject(owner,projectId))?.messages).toHaveLength(1);
    expect((await pool.query("SELECT count(*)::int n FROM factory_jobs")).rows[0].n).toBe(1);
    await expect(sendFactoryMessage(member,{...input,body:"Different payload"})).rejects.toThrow("already saved");
    await expect(sendFactoryMessage(member,{...input,requestId:randomUUID(),referenceUrls:["http://127.0.0.1/private"]})).rejects.toThrow();
  });
  it("does not accept instructions into an already frozen worker snapshot",async()=>{
    const {projectId}=await startFactory(owner,{leadId});
    await pool.query("UPDATE factory_jobs SET stage='plan',input_snapshot='{}' WHERE project_id=$1",[projectId]);
    await expect(chat(projectId)).rejects.toThrow("Wait for its response");
    expect((await getFactoryProject(owner,projectId))?.messages).toHaveLength(0);
  });
  it("approves only the current immutable plan, once, and keeps its exact snapshot",async()=>{
    const {projectId}=await startFactory(owner,{leadId});const first=await plan(projectId);const second=await plan(projectId,2);
    await expect(approveFactoryPlan(member,{projectId,planId:first})).rejects.toThrow("latest version");
    await expect(approveFactoryPlan(viewer,{projectId,planId:second})).rejects.toThrow("workspace access");
    await Promise.all([approveFactoryPlan(member,{projectId,planId:second}),approveFactoryPlan(owner,{projectId,planId:second})]);
    const data=await getFactoryProject(owner,projectId);expect(data?.buildRequests).toHaveLength(1);expect(data?.buildRequests[0]).toMatchObject({planId:second,status:"awaiting_builder"});
    await expect(pool.query("UPDATE factory_plans SET change_summary='rewritten' WHERE id=$1",[second])).rejects.toThrow("immutable");
    await chat(projectId,"Add a services page");
    await expect(approveFactoryPlan(owner,{projectId,planId:second})).rejects.toThrow("pending planning response");
    expect((await getFactoryProject(owner,projectId))?.buildRequests[0]?.planId).toBe(second);
  });
  it("blocks stale approval after failed chat and retries a failed request once",async()=>{
    const {projectId}=await startFactory(owner,{leadId});const current=await plan(projectId);
    await chat(projectId);const job=(await pool.query("UPDATE factory_jobs SET status='failed',error='Fixture interruption' WHERE project_id=$1 AND status='queued' RETURNING id",[projectId])).rows[0];
    await expect(approveFactoryPlan(owner,{projectId,planId:current})).rejects.toThrow("latest planning request failed");
    const input={projectId,jobId:job.id,requestId:randomUUID()};await Promise.all([retryFactoryJob(member,input),retryFactoryJob(member,input)]);
    expect((await pool.query("SELECT count(*)::int n FROM factory_jobs WHERE project_id=$1 AND status='queued'",[projectId])).rows[0].n).toBe(1);
  });
  it("requires owner settings approval and only autoenqueues new leads after optin",async()=>{
    const db=await pool.connect();
    try{expect(await enqueueFactoryLead(db,ws,leadId)).toBeNull();}finally{db.release();}
    await expect(saveFactorySettings(member,{researchEnabled:true,autoResearch:true,monthlyBudgetDollars:25})).rejects.toThrow("workspace access");
    await saveFactorySettings(owner,{researchEnabled:true,autoResearch:true,monthlyBudgetDollars:25});
    expect((await getFactoryWorkspace(owner)).settings.budgetApprovedAt).not.toBeNull();
    const intake=await pool.connect();try{await intake.query("BEGIN");const first=await enqueueFactoryLead(intake,ws,leadId);const again=await enqueueFactoryLead(intake,ws,leadId);await intake.query("COMMIT");expect(again?.projectId).toBe(first?.projectId);}finally{intake.release();}
    await saveFactorySettings(owner,{researchEnabled:false,autoResearch:false,monthlyBudgetDollars:10});
    expect((await getFactoryWorkspace(owner)).settings.budgetApprovedAt).toBeNull();
  });
  it("manual and website lead intake remain idempotent with research enabled and no provider key",async()=>{
    await saveFactorySettings(owner,{researchEnabled:true,autoResearch:true,monthlyBudgetDollars:19.99});
    const manual={submissionId:randomUUID(),name:"Jamie Example",email:"jamie@example.test"};
    const first=await createManualLead(member,manual),again=await createManualLead(member,manual);
    expect(again.leadId).toBe(first.leadId);
    const web={submissionId:randomUUID(),fingerprint:"a".repeat(64),inquiryType:"website-review",name:"Taylor Example",organization:"None",email:"taylor@example.test"};
    const incoming=await storePublicInquiry(web),duplicate=await storePublicInquiry(web);
    expect(duplicate).toMatchObject({leadId:incoming.leadId,duplicate:true});
    expect((await pool.query("SELECT count(*)::int n FROM factory_projects")).rows[0].n).toBe(2);
    expect((await pool.query("SELECT count(*)::int n FROM factory_jobs WHERE status='queued'")).rows[0].n).toBe(2);
    expect((await pool.query("SELECT count(*)::int n FROM factory_costs")).rows[0].n).toBe(0);
  });
  it("does not enqueue automatic research for manual or website intake while disabled",async()=>{
    await createManualLead(member,{submissionId:randomUUID(),email:"sparse@example.test"});
    await storePublicInquiry({submissionId:randomUUID(),fingerprint:"b".repeat(64),inquiryType:"project",name:"Another Person",organization:"Unknown",email:"another@example.test"});
    expect((await pool.query("SELECT count(*)::int n FROM factory_projects")).rows[0].n).toBe(0);
  });
  it.each(["delete","anonymize"])("removes derived content on lead %s while keeping a detached cost receipt",async mode=>{
    const {projectId}=await startFactory(owner,{leadId});await chat(projectId);const current=await plan(projectId);await approveFactoryPlan(owner,{projectId,planId:current});
    const jobId=(await pool.query("SELECT job_id FROM factory_plans WHERE id=$1",[current])).rows[0].job_id;
    await pool.query("INSERT INTO factory_costs(id,workspace_id,job_id,request_key,stage,status,reserved_micros,actual_micros) VALUES($1::uuid,$2,$3,$1::text,'plan','settled',150000,100000)",[randomUUID(),ws,jobId]);
    if(mode==="delete")await pool.query("DELETE FROM leads WHERE id=$1",[leadId]);else await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1",[leadId]);
    expect(await getFactoryProject(owner,projectId)).toBeNull();
    for(const table of ["factory_messages","factory_plans","factory_jobs","factory_build_requests"])expect((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n).toBe(0);
    expect((await pool.query("SELECT job_id,actual_micros FROM factory_costs")).rows[0]).toMatchObject({job_id:null,actual_micros:"100000"});
    await expect(startFactory(owner,{leadId})).rejects.toThrow("no longer available");
  });
});
