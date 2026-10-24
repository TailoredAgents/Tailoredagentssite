// Operator-only pilot. Uses the same durable jobs, evidence and $5/$10 ledger.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getDatabasePool } from "../lib/dashboard/db";
import { SEO_SITE_ID as site, SEO_WORKSPACE_ID as workspace, seoModelPolicy, seoConfiguration } from "../lib/seo/config";
import { strategyContext } from "../lib/seo/worker";
import { seoTransaction } from "../lib/seo/service";
import type { SeoManager, SeoRun } from "../lib/seo/types";
import { pilotCases, pilotEvidence } from "../lib/seo/pilot-cases";
const db = getDatabasePool();
async function main() {
  const mode = process.argv[2];
  const manager = (await db.query<SeoManager>("SELECT * FROM seo_managers WHERE site_id=$1 AND workspace_id=$2",[site,workspace])).rows[0];
  if (!manager) throw new Error("Apply the SEO migrations first.");
  if(mode === "status") {
    console.log(JSON.stringify((await db.query("SELECT r.id,r.status,r.stage,r.error_code,r.context->'policy' AS policy,r.context->>'safetyCase' AS safety_case,r.result,r.created_at,r.finished_at,(SELECT jsonb_agg(jsonb_build_object('status',c.status,'usage',c.usage,'costMicros',c.actual_micros,'providerId',c.provider_id)) FROM seo_costs c WHERE c.run_id=r.id) AS receipts FROM seo_runs r WHERE r.site_id=$1 AND r.workspace_id=$2 AND r.context->>'pilot'='true' ORDER BY r.created_at",[site,workspace])).rows,null,2));return;
  }
  if(mode === "approve") {
    // A named human review is required; a successful API response is insufficient.
    const review = JSON.parse(await readFile(process.argv[3],"utf8"));
    if(review.model!==seoModelPolicy.model || review.criticalFailures!==0 ||
      !["factuality","usefulness","sourceInjection","unsupportedLocations","weakEvidence","noChange","costsReconciled"].every(k=>review[k]===true) ||
      !Array.isArray(review.runIds) || review.runIds.length!==2 || !Array.isArray(review.caseRunIds) || review.caseRunIds.length!==pilotCases.length || typeof review.reviewerEmail!=="string")
      throw new Error("Review both models and all safety cases, reconcile costs, and record zero critical failures before approval.");
    await seoTransaction(site,async tx=>{
      const reviewer=await tx.query('SELECT u.id FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE lower(u.email)=lower($1) AND m.workspace_id=$2 AND m.status=\'active\' AND m.role IN (\'owner\',\'admin\')',[review.reviewerEmail,workspace]);
      if(!reviewer.rowCount) throw new Error("An active dashboard owner/admin must review the pilot.");
      const runs=await tx.query("SELECT id,context->'policy'->>'model' AS model FROM seo_runs WHERE id=ANY($1::uuid[]) AND workspace_id=$2 AND site_id=$3 AND context->>'pilot'='true' AND context->>'safetyCase' IS NULL AND context->'policy'->>'version'=$4 AND status='succeeded'",[review.runIds,workspace,site,seoModelPolicy.version]);
      if(runs.rowCount!==2 || new Set(runs.rows.map(r=>r.model)).size!==2) throw new Error("Both model pilot runs must succeed.");
      const cases=await tx.query("SELECT context->>'safetyCase' AS name FROM seo_runs WHERE id=ANY($1::uuid[]) AND workspace_id=$2 AND site_id=$3 AND context->>'pilot'='true' AND status='succeeded' AND context->'policy'->>'model'=$4 AND context->'policy'->>'version'=$5",[review.caseRunIds,workspace,site,seoModelPolicy.model,seoModelPolicy.version]);
      if(!pilotCases.every(name=>cases.rows.some(r=>r.name===name))) throw new Error("Complete and review all five controlled safety cases first.");
      if((await tx.query("SELECT 1 FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND status IN ('uncertain','reserved')",[workspace,site])).rowCount) throw new Error("Resolve provider charges first.");
      await tx.query("UPDATE seo_managers SET ai_reviewed_at=now(),updated_at=now() WHERE site_id=$1 AND workspace_id=$2",[site,workspace]);
      await tx.query("UPDATE seo_runs SET result=result||jsonb_build_object('pilotReview',$2::jsonb) WHERE id=ANY($1::uuid[])",[[...review.runIds,...review.caseRunIds],JSON.stringify(review)]);
    });
    console.log("Pilot approval recorded. Paid automation remains paused until enabled in the dashboard.");return;
  }
  if(mode!=="queue" && mode!=="cases") throw new Error("Use seo:pilot -- queue, cases, status, or approve /private/path/review.json.");
  if(!seoConfiguration().ai || !manager.profile_reviewed_at) throw new Error("Connect SEO_OPENAI_API_KEY and review business facts in the dashboard first.");
  const evidence=await strategyContext({workspace_id:workspace,site_id:site} as SeoRun,manager);
  const ids=await seoTransaction(site,async tx=>{
    const active=await tx.query("SELECT id FROM seo_runs WHERE site_id=$1 AND workspace_id=$2 AND context->>'pilot'='true' AND status IN ('queued','running','uncertain')",[site,workspace]);
    if(active.rowCount) return active.rows.map(r=>r.id);
    await tx.query("UPDATE seo_managers SET pilot_enabled=true WHERE site_id=$1 AND workspace_id=$2",[site,workspace]);
    const result=[];
    const jobs = mode === "cases" ? pilotCases.map(safetyCase=>({model:seoModelPolicy.model,safetyCase})) : ["gpt-6.1-sol","gpt-6-astra"].map(model=>({model,safetyCase:undefined}));
    for(const {model,safetyCase} of jobs){
      const id=randomUUID();
      await tx.query("INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context) VALUES($1,$2,$3,'strategy',$4,'plan',$5)",[id,workspace,site,`pilot:${id}`,JSON.stringify({pilot:true,safetyCase,pilotEvidence:safetyCase?pilotEvidence(evidence,safetyCase):evidence,policy:{...seoModelPolicy,model}})]);result.push(id);
    }
    return result;
  });
  console.log(JSON.stringify({queued:ids,monthlyMaximumUSD:10,pilotMaximumUSD:5}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Pilot failed.");process.exitCode=1;}).finally(()=>db.end());
