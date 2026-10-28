import {randomUUID} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import type {Pool} from "pg";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import type {DashboardContext} from "@/lib/dashboard/data";
import {getDatabasePool} from "@/lib/dashboard/db";
import {getFactoryWorkNotices,markFactoryWorkNoticeSeen,syncFactoryWorkNotices} from "./work-notices";
vi.mock("server-only",()=>({}));
const url=process.env.TEST_FACTORY_DATABASE_URL;
const ws="00000000-0000-4000-8000-000000000001",otherWs="00000000-0000-4000-8000-000000000992";
const actor=(id:string,workspace=ws):DashboardContext=>({user:{id,name:id,email:`${id}@example.test`},workspace:{id:workspace,name:"Notice fixture",slug:"notices"},role:"owner"});
const owner=actor("notice-owner"),member=actor("notice-member"),viewer=actor("notice-viewer"),other=actor("notice-other",otherWs);
let pool:Pool,leadId:string,projectId:string,planId:string,jobId:string;
async function newPlan(version=1){
  jobId=randomUUID();planId=randomUUID();
  await pool.query("UPDATE factory_jobs SET status='succeeded' WHERE project_id=$1 AND status IN ('queued','running')",[projectId]);
  await pool.query("INSERT INTO factory_jobs(id,workspace_id,project_id,kind,request_key,status,requested_by,created_at) VALUES($1,$2,$3,'research',$4,'succeeded',$5,now()+$6*interval '1 second')",[jobId,ws,projectId,randomUUID(),member.user.id,version]);
  await pool.query("INSERT INTO factory_plans(id,workspace_id,project_id,version,content,change_summary,job_id) VALUES($1,$2,$3,$4,'{}','Fixture plan',$5)",[planId,ws,projectId,version,jobId]);
  await pool.query("UPDATE factory_projects SET status='plan_ready',current_plan_id=$2 WHERE id=$1",[projectId,planId]);
}
async function build(status:"queued"|"ready"|"failed"){
  const request=randomUUID(),id=randomUUID();
  await pool.query("UPDATE factory_projects SET status='approved' WHERE id=$1",[projectId]);
  await pool.query("INSERT INTO factory_build_requests(id,workspace_id,project_id,plan_id,approved_by,status) VALUES($1,$2,$3,$4,$5,$6)",[request,ws,projectId,planId,owner.user.id,status]);
  await pool.query("INSERT INTO factory_build_versions(id,workspace_id,project_id,build_request_id,version,status,storage_prefix,preview_token) VALUES($1,$2,$3,$4,1,$5,$6,$7)",[id,ws,projectId,request,status,`notices/${id}`,id.replaceAll("-","")]);
  return id;
}
describe.skipIf(!url)("durable internal website updates",()=>{
  beforeAll(async()=>{
    const parsed=new URL(url!);
    if(!["127.0.0.1","localhost"].includes(parsed.hostname)||parsed.port!=="55433"||parsed.pathname!=="/ta_factory_test"||parsed.search||parsed.hash)throw Error("Use exact local ta_factory_test on port55433.");
    vi.stubEnv("DATABASE_URL",url!);vi.stubEnv("BETTER_AUTH_SECRET","notice-test-secret-".repeat(4));vi.stubEnv("OPENAI_API_KEY","");vi.stubEnv("FACTORY_OPENAI_API_KEY","");
    pool=getDatabasePool();
    await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
    for(const filename of(await readdir("db/migrations")).filter(name=>name.endsWith(".sql")).sort()){
      if((await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[filename])).rowCount)continue;
      await pool.query("BEGIN");
      try{await pool.query(await readFile(`db/migrations/${filename}`,"utf8"));await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)",[filename]);await pool.query("COMMIT");}catch(error){await pool.query("ROLLBACK");throw error;}
    }
  },60000);
  beforeEach(async()=>{
    await pool.query("DELETE FROM factory_projects");await pool.query("DELETE FROM leads");
    await pool.query("INSERT INTO workspaces(id,slug,name,kind) VALUES($1,'factory-other','Other fixture','internal') ON CONFLICT(id) DO UPDATE SET status='active'",[otherWs]);
    await pool.query("UPDATE workspaces SET status='active' WHERE id=$1",[ws]);
    for(const [context,role]of[[owner,"owner"],[member,"member"],[viewer,"viewer"],[other,"owner"]]as const){
      await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2) ON CONFLICT(id) DO NOTHING',[context.user.id,context.user.email]);
      await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(workspace_id,user_id) DO UPDATE SET status='active',role=EXCLUDED.role",[randomUUID(),context.workspace.id,context.user.id,role]);
    }
    leadId=randomUUID();projectId=randomUUID();
    await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source,owner_user_id) VALUES($1,$2,'Jamie New','None','manual',$3)",[leadId,ws,member.user.id]);
    await pool.query("INSERT INTO factory_projects(id,workspace_id,lead_id,created_by) VALUES($1,$2,$3,$4)",[projectId,ws,leadId,owner.user.id]);
    await newPlan();
  });
  afterAll(async()=>{await pool?.end();delete(globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
  it("routes to the lead owner, deduplicates concurrent reads, and keeps seen updates seen",async()=>{
    const [first,again]=await Promise.all([getFactoryWorkNotices(member),getFactoryWorkNotices(member)]);
    expect(first).toMatchObject({canEdit:true,items:[{projectId,kind:"plan_ready",leadName:"Jamie New",ownerName:member.user.name}]});
    expect(again.items[0].id).toBe(first.items[0].id);expect((await getFactoryWorkNotices(owner)).items).toHaveLength(0);
    expect((await getFactoryWorkNotices(owner,"team")).items).toHaveLength(1);
    await markFactoryWorkNoticeSeen(member,first.items[0].id);await syncFactoryWorkNotices();
    expect((await getFactoryWorkNotices(member)).items).toHaveLength(0);
    expect((await pool.query("SELECT status FROM factory_work_notices WHERE project_id=$1",[projectId])).rows).toEqual([{status:"seen"}]);
  });
  it("makes unassigned work visible to the team and falls back from an inactive lead owner",async()=>{
    await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);
    expect((await getFactoryWorkNotices(owner)).items[0].ownerName).toBe(owner.user.name);
    await pool.query("UPDATE factory_projects SET created_by=NULL WHERE id=$1",[projectId]);
    const list=await getFactoryWorkNotices(viewer);
    expect(list).toMatchObject({canEdit:false,items:[{projectId,ownerName:null}]});
    expect((await getFactoryWorkNotices(owner)).items).toHaveLength(1);
  });
  it("rechecks viewer, membership and workspace permission for reads and mark seen",async()=>{
    const notice=(await getFactoryWorkNotices(member)).items[0];
    expect((await getFactoryWorkNotices(viewer,"team")).canEdit).toBe(false);
    await expect(markFactoryWorkNoticeSeen(viewer,notice.id)).rejects.toThrow("workspace access");
    expect((await getFactoryWorkNotices(other,"team")).items).toHaveLength(0);
    await expect(markFactoryWorkNoticeSeen(other,notice.id)).rejects.toThrow("no longer waiting");
    await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);
    await expect(getFactoryWorkNotices(member)).rejects.toThrow("workspace access");
    await pool.query("UPDATE workspaces SET status='archived' WHERE id=$1",[ws]);
    await expect(getFactoryWorkNotices(owner,"team")).rejects.toThrow("workspace access");
  });
  it("restores an unseen same-plan update after a no-change planning reply",async()=>{
    const notice=(await getFactoryWorkNotices(member)).items[0];
    await pool.query("UPDATE factory_projects SET status='research_queued' WHERE id=$1",[projectId]);
    expect((await getFactoryWorkNotices(member)).items).toHaveLength(0);
    await pool.query("UPDATE factory_projects SET status='plan_ready' WHERE id=$1",[projectId]);
    expect((await getFactoryWorkNotices(member)).items[0].id).toBe(notice.id);
    await markFactoryWorkNoticeSeen(member,notice.id);
    await pool.query("UPDATE factory_projects SET status='research_queued' WHERE id=$1",[projectId]);await syncFactoryWorkNotices();
    await pool.query("UPDATE factory_projects SET status='plan_ready' WHERE id=$1",[projectId]);
    expect((await getFactoryWorkNotices(member)).items).toHaveLength(0);
  });
  it("replaces plan review with current build attention and then ready without stale issues",async()=>{
    const planNotice=(await getFactoryWorkNotices(member)).items[0];const version=await build("queued");
    expect((await getFactoryWorkNotices(member)).items).toHaveLength(0);
    expect((await pool.query("SELECT status FROM factory_work_notices WHERE id=$1",[planNotice.id])).rows[0].status).toBe("resolved");
    await pool.query("UPDATE factory_build_versions SET status='failed',updated_at=now() WHERE id=$1",[version]);
    const failed=(await getFactoryWorkNotices(member)).items;
    expect(failed).toHaveLength(1);expect(failed[0].kind).toBe("needs_attention");
    await pool.query("UPDATE factory_build_versions SET status='ready',ready_at=now(),updated_at=now() WHERE id=$1",[version]);
    const ready=(await getFactoryWorkNotices(member)).items;
    expect(ready).toHaveLength(1);expect(ready[0].kind).toBe("website_ready");
    expect((await pool.query("SELECT status FROM factory_work_notices WHERE id=$1",[failed[0].id])).rows[0].status).toBe("resolved");
    await pool.query("UPDATE factory_build_versions SET revoked_at=now() WHERE id=$1",[version]);
    expect((await getFactoryWorkNotices(member)).items).toHaveLength(0);
  });
  it("re-notifies a later failed retry and lets a newer plan supersede old build failures",async()=>{
    const version=await build("failed"),initial=(await getFactoryWorkNotices(member)).items[0];
    await markFactoryWorkNoticeSeen(member,initial.id);
    await pool.query("UPDATE factory_build_versions SET status='queued',updated_at=now() WHERE id=$1",[version]);await syncFactoryWorkNotices();
    await pool.query("UPDATE factory_build_versions SET status='failed',updated_at=now()+interval '1 second' WHERE id=$1",[version]);
    const retry=(await getFactoryWorkNotices(member)).items[0];expect(retry.kind).toBe("needs_attention");expect(retry.id).not.toBe(initial.id);
    await newPlan(2);
    const current=(await getFactoryWorkNotices(member)).items;expect(current).toHaveLength(1);expect(current[0].kind).toBe("plan_ready");
  });
  it("shows research failures and removes all derived notices when a lead is deleted or anonymized",async()=>{
    await pool.query("UPDATE factory_jobs SET status='failed' WHERE id=$1",[jobId]);
    await pool.query("UPDATE factory_projects SET status='failed' WHERE id=$1",[projectId]);
    expect((await getFactoryWorkNotices(member)).items[0].kind).toBe("needs_attention");
    await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1",[leadId]);
    expect((await getFactoryWorkNotices(member,"team")).items).toHaveLength(0);
    expect((await pool.query("SELECT count(*)::int n FROM factory_work_notices WHERE project_id=$1",[projectId])).rows[0].n).toBe(0);
    leadId=randomUUID();projectId=randomUUID();
    await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source) VALUES($1,$2,'Deleted lead','','manual')",[leadId,ws]);
    await pool.query("INSERT INTO factory_projects(id,workspace_id,lead_id) VALUES($1,$2,$3)",[projectId,ws,leadId]);await newPlan();await syncFactoryWorkNotices();
    await pool.query("DELETE FROM leads WHERE id=$1",[leadId]);
    expect((await pool.query("SELECT count(*)::int n FROM factory_work_notices WHERE project_id=$1",[projectId])).rows[0].n).toBe(0);
  });
});
