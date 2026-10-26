import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { factoryConfiguration } from "./config";
import { FactoryBudgetError } from "./budget";
import { researchFactoryLead, planFactoryWebsite, type FactorySnapshot, type FactoryResearch, type FactoryPlanResult } from "./provider";
import type { FactoryPlanContent } from "./types";

type ClaimedJob = {
  id:string;workspace_id:string;project_id:string;kind:"research"|"revision";stage:"research"|"plan";
  attempts:number;lease_token:string;input_snapshot:FactorySnapshot;research_result:FactoryResearch|null;base_plan_id:string|null;
};
const eligible = `j.status='queued' AND s.research_enabled AND s.budget_approved_at IS NOT NULL AND w.status='active' AND l.anonymized_at IS NULL`;
function boundedText(value:string,bytes:number) {
  let result="",used=0;
  for(const character of value){const size=Buffer.byteLength(character);if(used+size>bytes)break;result+=character;used+=size;}
  return result;
}

async function snapshot(db:PoolClient,workspaceId:string,leadId:string,projectId:string,planId:string|null):Promise<FactorySnapshot> {
  // Explicit allowlist: no Mail, SMS, call transcripts or channel-scoped client
  // memory is copied into this shared planning workspace.
  const lead=(await db.query(`SELECT name,organization,email,phone,website_url,interest,description,source
    FROM leads WHERE id=$1 AND workspace_id=$2 AND anonymized_at IS NULL`,[leadId,workspaceId])).rows[0];
  if(!lead)throw new Error("The lead is no longer available.");
  const notes=(await db.query<{body:string}>("SELECT left(body,2000) body FROM lead_notes WHERE lead_id=$1 AND workspace_id=$2 ORDER BY created_at DESC,id DESC LIMIT 8",[leadId,workspaceId])).rows.reverse().map(n=>n.body);
  const messages=(await db.query<{role:"user"|"assistant";body:string;reference_urls:string[]}>(`SELECT role,body,reference_urls FROM factory_messages
    WHERE project_id=$1 AND workspace_id=$2 ORDER BY created_at DESC,id DESC LIMIT 24`,[projectId,workspaceId])).rows.reverse().map(m=>({role:m.role,body:m.body,referenceUrls:m.reference_urls}));
  const previousPlan=planId?(await db.query<{content:FactoryPlanContent}>("SELECT content FROM factory_plans WHERE id=$1 AND workspace_id=$2 AND project_id=$3",[planId,workspaceId,projectId])).rows[0]?.content||null:null;
  const result:FactorySnapshot={lead:Object.fromEntries(Object.entries(lead).map(([k,v])=>[k,typeof v==="string"?boundedText(v,k==="description"?6000:1000):null])),notes,messages,previousPlan,
    contextNotice:"Only the lead profile, shared lead notes, planning chat and previous plan are included. Older history and long lead fields may be shortened; never treat missing context as proof of absence."};
  // Keep the latest full user direction. Trim old history first and disclose the
  // bounded snapshot. Fail explicitly rather than silently discard that direction.
  while(Buffer.byteLength(JSON.stringify(result))>55000 && result.messages.length>1)result.messages.shift();
  while(Buffer.byteLength(JSON.stringify(result))>55000 && result.notes.length)result.notes.shift();
  if(Buffer.byteLength(JSON.stringify(result))>55000)throw new FactoryBudgetError("This planning direction is too long for the current plan. Shorten it and send a new message.");
  return result;
}

async function claimJob():Promise<ClaimedJob|null> {
  const db=await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    // Project lock serializes this claim with chat/approval. SKIP LOCKED lets
    // another worker advance a different project without double claiming.
    const selected=(await db.query<{id:string;workspace_id:string;lead_id:string;current_plan_id:string|null}>(`SELECT p.id,p.workspace_id,p.lead_id,p.current_plan_id
      FROM factory_projects p JOIN factory_jobs j ON j.project_id=p.id AND j.workspace_id=p.workspace_id
      JOIN factory_settings s ON s.workspace_id=p.workspace_id JOIN workspaces w ON w.id=p.workspace_id
      JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE ${eligible}
      ORDER BY j.created_at,j.id FOR UPDATE OF p SKIP LOCKED LIMIT 1`)).rows[0];
    if(!selected){await db.query("COMMIT");return null;}
    const job=(await db.query<ClaimedJob>("SELECT * FROM factory_jobs WHERE project_id=$1 AND workspace_id=$2 AND status='queued' FOR UPDATE",[selected.id,selected.workspace_id])).rows[0];
    if(!job){await db.query("COMMIT");return null;}
    const lease=randomUUID();
    try {
      const input=job.input_snapshot||await snapshot(db,selected.workspace_id,selected.lead_id,selected.id,selected.current_plan_id);
      const claimed=(await db.query<ClaimedJob>(`UPDATE factory_jobs SET status='running',lease_token=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1,
        input_snapshot=$3::jsonb,base_plan_id=COALESCE(base_plan_id,$4),started_at=COALESCE(started_at,now()),error=NULL,updated_at=now()
        WHERE id=$1 RETURNING *`,[job.id,lease,JSON.stringify(input),selected.current_plan_id])).rows[0];
      await db.query("UPDATE factory_projects SET status='researching',updated_at=now() WHERE id=$1",[selected.id]);
      await db.query("COMMIT");return claimed;
    } catch(error) {
      // Snapshot failure is visible and does not create a tight cron retry loop.
      if(!(error instanceof FactoryBudgetError))throw error;
      await db.query("UPDATE factory_jobs SET status='failed',error=$2,finished_at=now(),updated_at=now() WHERE id=$1",[job.id,error.message]);
      await db.query("UPDATE factory_projects SET status='failed',updated_at=now() WHERE id=$1",[selected.id]);
      await db.query("COMMIT");return null;
    }
  } catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}

/** Do not automatically replay abandoned requests: they may already be charged. */
async function recoverInterrupted() {
  const db=await getDatabasePool().connect();let recovered=0;
  try {
    await db.query("BEGIN");
    const projects=await db.query<{id:string;workspace_id:string}>(`SELECT p.id,p.workspace_id FROM factory_projects p JOIN factory_jobs j ON j.project_id=p.id
      WHERE j.status='running' AND j.lease_until<=now() ORDER BY j.created_at FOR UPDATE OF p SKIP LOCKED LIMIT 30`);
    for(const p of projects.rows) {
      const failed=await db.query<{id:string}>(`UPDATE factory_jobs SET status='failed',error='Processing was interrupted. Review any uncertain provider charge, then retry.',
        lease_token=NULL,lease_until=NULL,finished_at=now(),updated_at=now() WHERE project_id=$1 AND workspace_id=$2 AND status='running' AND lease_until<=now() RETURNING id`,[p.id,p.workspace_id]);
      if(failed.rowCount){recovered+=failed.rowCount;await db.query("UPDATE factory_projects SET status='failed',updated_at=now() WHERE id=$1",[p.id]);}
    }
    // No content is stored in these receipts. They remain accountable even when a
    // deleted/anonymized lead removes the job while HTTP is still in flight.
    await db.query(`UPDATE factory_costs c SET status=CASE WHEN attempted_at IS NULL THEN 'released' ELSE 'uncertain' END
      WHERE c.status='reserved' AND (c.job_id IS NULL OR NOT EXISTS(SELECT 1 FROM factory_jobs j WHERE j.id=c.job_id AND j.status='running' AND j.lease_until>now()))`);
    await db.query("COMMIT");return recovered;
  } catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}

async function finalizeJob(job:ClaimedJob,update:{research:FactoryResearch}|{plan:FactoryPlanResult}) {
  const db=await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const project=(await db.query<{id:string;current_plan_id:string|null}>(`SELECT p.id,p.current_plan_id FROM factory_projects p JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id
      JOIN workspaces w ON w.id=p.workspace_id WHERE p.id=$1 AND p.workspace_id=$2 AND l.anonymized_at IS NULL AND w.status='active' FOR UPDATE OF p`,[job.project_id,job.workspace_id])).rows[0];
    if(!project){await db.query("COMMIT");return false;}
    const current=await db.query(`SELECT 1 FROM factory_jobs j JOIN factory_settings s ON s.workspace_id=j.workspace_id
      WHERE j.id=$1 AND j.workspace_id=$2 AND j.project_id=$3 AND j.lease_token=$4 AND j.status='running' AND j.lease_until>now()
      AND s.research_enabled AND s.budget_approved_at IS NOT NULL FOR UPDATE OF j`,[job.id,job.workspace_id,job.project_id,job.lease_token]);
    if(!current.rowCount || project.current_plan_id!==job.base_plan_id) {await db.query("COMMIT");return false;}
    if("research"in update) {
      await db.query(`UPDATE factory_jobs SET research_result=$2::jsonb,stage='plan',status='queued',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1`,[job.id,JSON.stringify(update.research)]);
      await db.query("UPDATE factory_projects SET status='research_queued',updated_at=now() WHERE id=$1",[project.id]);
    } else {
      let planId=project.current_plan_id;
      if(update.plan.changed || !planId) {
        planId=randomUUID();
        await db.query(`INSERT INTO factory_plans(id,workspace_id,project_id,version,content,change_summary,job_id)
          SELECT $1,$2,$3,COALESCE(max(version),0)+1,$4::jsonb,$5,$6 FROM factory_plans WHERE project_id=$3 AND workspace_id=$2`,
          [planId,job.workspace_id,job.project_id,JSON.stringify(update.plan.plan),update.plan.changeSummary,job.id]);
      }
      await db.query(`INSERT INTO factory_messages(id,workspace_id,project_id,role,body,request_id) VALUES($1,$2,$3,'assistant',$4,$5)`,
        [randomUUID(),job.workspace_id,job.project_id,update.plan.reply,`agent:${job.id}`]);
      await db.query("UPDATE factory_jobs SET status='succeeded',lease_token=NULL,lease_until=NULL,finished_at=now(),updated_at=now() WHERE id=$1",[job.id]);
      await db.query(`UPDATE factory_projects SET current_plan_id=$2,status=CASE WHEN EXISTS(SELECT 1 FROM factory_build_requests WHERE project_id=$1 AND plan_id=$2) THEN 'approved' ELSE 'plan_ready' END,updated_at=now() WHERE id=$1`,[project.id,planId]);
      await insertAuditLog(db,{workspaceId:job.workspace_id,action:"factory.plan_completed",targetType:"factory_project",targetId:job.project_id,metadata:{jobId:job.id,planId,changed:update.plan.changed}});
    }
    await db.query("COMMIT");return true;
  } catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}

async function failJob(job:ClaimedJob,error:unknown) {
  const message=error instanceof FactoryBudgetError?error.message:"The AI planning request could not finish. Review the connection and any uncertain provider charge before retrying.";
  const db=await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT id FROM factory_projects WHERE id=$1 AND workspace_id=$2 FOR UPDATE",[job.project_id,job.workspace_id]);
    const failed=await db.query(`UPDATE factory_jobs SET status='failed',error=$3,lease_token=NULL,lease_until=NULL,finished_at=now(),updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING id`,[job.id,job.lease_token,message]);
    if(failed.rowCount)await db.query("UPDATE factory_projects SET status='failed',updated_at=now() WHERE id=$1 AND workspace_id=$2",[job.project_id,job.workspace_id]);
    await db.query("COMMIT");
  } catch(err){await db.query("ROLLBACK");throw err;}finally{db.release();}
}

/** One bounded provider stage per invocation. This worker has no website-build tools. */
export async function runFactoryWorkerStep() {
  const recovered=await recoverInterrupted();
  if(!factoryConfiguration().configured)return {checked:0,failed:recovered,more:false};
  const job=await claimJob();let failed=recovered;
  if(job) {
    const context={workspaceId:job.workspace_id,projectId:job.project_id,jobId:job.id,leaseToken:job.lease_token,attempt:job.attempts};
    try {
      if(job.stage==="research") {
        const research=await researchFactoryLead(context,job.input_snapshot);
        if(!await finalizeJob(job,{research})){failed++;await failJob(job,new FactoryBudgetError("The planning result was discarded because this job was paused, changed, removed or expired."));}
      } else {
        if(!job.research_result)throw new Error("Missing saved research.");
        const plan=await planFactoryWebsite(context,job.input_snapshot,job.research_result);
        if(!await finalizeJob(job,{plan})){failed++;await failJob(job,new FactoryBudgetError("The planning result was discarded because this job was paused, changed, removed or expired."));}
      }
    } catch(error){failed++;await failJob(job,error);}
  }
  const due=await getDatabasePool().query(`SELECT 1 FROM factory_jobs j JOIN factory_projects p ON p.id=j.project_id AND p.workspace_id=j.workspace_id
    JOIN factory_settings s ON s.workspace_id=j.workspace_id JOIN workspaces w ON w.id=j.workspace_id
    JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE ${eligible} LIMIT 1`);
  return {checked:job?1:0,failed,more:Boolean(due.rowCount)};
}
export const runFactoryWorker = runFactoryWorkerStep;
