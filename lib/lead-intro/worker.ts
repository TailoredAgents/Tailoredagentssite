import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/dashboard/db";
import { sendSmsMessage, SmsInputError } from "@/lib/sms/service";
import { checkIntroduction, introTransaction, IntroError, type IntroJob } from "./service";
import { fallbackIntroduction, introFactsHash, introRuntimeEnabled, nextIntroTime } from "./policy";
import { generateIntroduction } from "./provider";

export async function reconcileIntroductions() {
  const db=getDatabasePool();
  await db.query(`UPDATE lead_intro_jobs j SET status=CASE WHEN i.state='accepted' AND m.status IN ('failed','undelivered') THEN 'failed' WHEN i.state='accepted' THEN 'accepted' WHEN i.state='rejected' THEN 'failed' ELSE 'unknown' END,reason=CASE WHEN i.state='accepted' THEN NULL ELSE 'check_sms_delivery' END,updated_at=now()
    FROM sms_outbound_intents i,sms_messages m WHERE i.workspace_id=j.workspace_id AND i.request_id=j.id AND m.id=i.message_id AND m.workspace_id=j.workspace_id
    AND j.status IN ('sending','unknown','accepted') AND j.lead_id IS NOT NULL AND (i.state<>'sending' OR i.updated_at<now()-interval '2 minutes')
    AND (j.status,j.reason) IS DISTINCT FROM (CASE WHEN i.state='accepted' AND m.status IN ('failed','undelivered') THEN 'failed' WHEN i.state='accepted' THEN 'accepted' WHEN i.state='rejected' THEN 'failed' ELSE 'unknown' END,CASE WHEN i.state='accepted' THEN NULL ELSE 'check_sms_delivery' END)`);
  await db.query("UPDATE lead_intro_jobs SET status='failed',reason='generation_interrupted',lease_token=NULL,updated_at=now() WHERE status='generating' AND lease_until<now()");
  await db.query("UPDATE lead_intro_jobs SET status='cancelled',reason='expired',updated_at=now() WHERE status IN ('queued','ready') AND expires_at<=now()");
}

export async function runLeadIntroductionStep() {
  await reconcileIntroductions();
  if(!introRuntimeEnabled())return {checked:0,failed:0,more:false};
  const db=getDatabasePool();
  await db.query("UPDATE lead_intro_settings SET last_worker_at=now() WHERE enabled");
  const candidate=(await db.query<IntroJob>("SELECT * FROM lead_intro_jobs WHERE (status='queued' AND due_at<=now()+interval '30 seconds') OR (status='ready' AND due_at<=now()) ORDER BY due_at,id LIMIT 1")).rows[0];
  if(!candidate)return {checked:0,failed:0,more:false};
  const lease=randomUUID();
  const job=await introTransaction(candidate.workspace_id,async tx=>{
    const current=(await tx.query<IntroJob>("SELECT * FROM lead_intro_jobs WHERE id=$1 AND status IN ('queued','ready') FOR UPDATE",[candidate.id])).rows[0];
    if(!current)return null;
    try {
      const checked=await checkIntroduction(tx,current);
      const due=nextIntroTime(current.due_at>new Date()?current.due_at:new Date(),checked.settings);
      if(due.getTime()>Date.now()+30000){await tx.query("UPDATE lead_intro_jobs SET due_at=$2 WHERE id=$1",[current.id,due]);return null;}
      if(current.status==='queued') {
        const used=(await tx.query<{n:number}>("SELECT count(*)::int n FROM lead_intro_jobs WHERE workspace_id=$1 AND generation_started_at>=date_trunc('day',now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'",[current.workspace_id])).rows[0].n;
        if(used>=checked.settings.daily_limit)throw new IntroError("daily_intro_limit");
        await tx.query("UPDATE lead_intro_jobs SET status='generating',generation_started_at=now(),lease_token=$2,lease_until=now()+interval '2 minutes',facts_hash=$3,generated_by='pending',updated_at=now() WHERE id=$1",[current.id,lease,introFactsHash(checked.facts)]);
        return {...current,status:'generating',lease_token:lease,facts_hash:introFactsHash(checked.facts),...checked};
      }
      // Claim ready work too, so two worker requests cannot enter the send path.
      if(current.due_at>new Date())return null;
      await tx.query("UPDATE lead_intro_jobs SET lease_token=$2,lease_until=now()+interval '2 minutes' WHERE id=$1 AND (lease_until IS NULL OR lease_until<now())",[current.id,lease]);
      const claimed=(await tx.query("SELECT 1 FROM lead_intro_jobs WHERE id=$1 AND lease_token=$2",[current.id,lease])).rowCount;
      return claimed?{...current,lease_token:lease,...checked}:null;
    } catch(error) {
      if(!(error instanceof IntroError))throw error;
      await tx.query("UPDATE lead_intro_jobs SET status='cancelled',reason=$2,updated_at=now() WHERE id=$1",[current.id,error.message]);return null;
    }
  });
  if(!job)return {checked:1,failed:0,more:true};
  if(job.status==='generating') {
    let body:string,generatedBy='ai';
    try {body=await generateIntroduction(job.facts,job.settings.instructions);}catch{body=fallbackIntroduction(job.facts.name);generatedBy='fallback';}
    await db.query("UPDATE lead_intro_jobs SET status='ready',body=$3,generated_by=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND status='generating' AND lease_token=$2 AND lease_until>now()",[job.id,lease,body,generatedBy]);
    return {checked:1,failed:0,more:true};
  }
  try {
    const answer=await sendSmsMessage(job.context,{numberId:job.number_id,conversationId:job.sms_conversation_id,to:job.phone,text:job.body,requestId:job.id},{
      beforeReserve:async(tx,phone)=>{
        const current=(await tx.query<IntroJob>("SELECT * FROM lead_intro_jobs WHERE id=$1 AND status='ready' AND lease_token=$2 AND lease_until>now() FOR UPDATE",[job.id,lease])).rows[0];
        if(!current || phone!==current.phone || current.due_at>new Date())throw new SmsInputError("Introduction no longer ready.");
        const checked=await checkIntroduction(tx,current,true);
        const used=(await tx.query<{n:number}>("SELECT count(*)::int n FROM lead_intro_jobs WHERE workspace_id=$1 AND send_started_at>=date_trunc('day',now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'",[job.workspace_id])).rows[0].n;
        if(used>=checked.settings.daily_limit)throw new IntroError("daily_intro_limit");
      },
      onReserved:async tx=>{
        await tx.query("UPDATE lead_intro_jobs SET status='sending',send_started_at=now(),updated_at=now() WHERE id=$1",[job.id]);
        await tx.query("INSERT INTO lead_intro_call_tasks(job_id,workspace_id,owner_user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[job.id,job.workspace_id,job.owner_user_id]);
      },
      beforeDelivery:async()=>{
        try {await introTransaction(job.workspace_id,async tx=>{
          const current=(await tx.query<IntroJob>("SELECT * FROM lead_intro_jobs WHERE id=$1 AND status='sending' AND lease_token=$2",[job.id,lease])).rows[0];
          if(!current)throw new IntroError("Introduction no longer available.");
          await checkIntroduction(tx,current,true);
        });}catch{throw new SmsInputError("Introduction paused or changed before delivery.");}
      },
    });
    await reconcileIntroductions();
    return {checked:1,failed:answer.sendState==='accepted'?0:1,more:true};
  }catch(error){
    // No new send key is ever created. A reserved/uncertain POST is reconciled, not retried.
    await db.query("UPDATE lead_intro_jobs SET status='cancelled',reason=$3,updated_at=now() WHERE id=$1 AND status='ready' AND lease_token=$2",[job.id,lease,error instanceof IntroError?error.message:'send_not_started']);
    await reconcileIntroductions();return {checked:1,failed:1,more:true};
  }
}

/** Best-effort low latency after a webhook; durable jobs are recovered by the authenticated cron. */
export async function runLeadIntroductionWindow() {
  if(!introRuntimeEnabled())return;
  const until=Date.now()+35000;
  while(Date.now()<until) {
    await runLeadIntroductionStep();
    const due=await getDatabasePool().query("SELECT 1 FROM lead_intro_jobs WHERE status IN ('queued','ready') AND due_at<=now()+interval '20 seconds' LIMIT 1");
    if(!due.rowCount)return;
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
}
