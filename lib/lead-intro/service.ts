import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeSales, SalesAccessError } from "@/lib/sales/data";
import { normalizePhone } from "@/lib/sales/import";
import { getTwilioConfiguration } from "@/lib/twilio/config";
import { introRuntimeEnabled, introSettingsSchema, introFactsHash, nextIntroTime, introWindowOpen, type IntroWindow } from "./policy";
import { type IntroFacts } from "./provider";

type Settings=IntroWindow & {last_error_code:string|null;last_worker_at:Date|null;workspace_id:string;enabled:boolean;enabled_at:Date|null;revision:number;actor_user_id:string|null;owner_user_id:string|null;number_id:string|null;form_ids:string[];instructions:string;daily_limit:number};
export type IntroJob={id:string;workspace_id:string;lead_id:string|null;phone:string|null;revision:number;number_id:string;actor_user_id:string|null;owner_user_id:string|null;conversation_id:string;sms_conversation_id:string;status:string;due_at:Date;expires_at:Date;body:string|null;facts_hash:string|null;lease_token:string|null};
export class IntroError extends Error {}
export async function introTransaction<T>(workspace:string,fn:(db:PoolClient)=>Promise<T>) {
  const db=await getDatabasePool().connect();try{await db.query("BEGIN");await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`agency-sms:${workspace}`]);const result=await fn(db);await db.query("COMMIT");return result;}catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
async function admin(db:PoolClient,context:DashboardContext) {
  const permission=await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin') AND w.status='active'",[context.workspace.id,context.user.id]);
  if(!permission.rowCount)throw new SalesAccessError("Only an active owner or administrator can configure lead introductions.");
}
export async function saveIntroSettings(context:DashboardContext,raw:unknown) {
  const input=introSettingsSchema.parse(raw);
  return introTransaction(context.workspace.id,async db=>{
    await admin(db,context);
    if(input.enabled){
      if(!introRuntimeEnabled())throw new IntroError("Live introductions are locked off until the reviewed pilot is activated on the server.");
      const config=getTwilioConfiguration();
      const allowed=await db.query(`SELECT 1 FROM sms_numbers n JOIN sms_number_grants g ON g.workspace_id=n.workspace_id AND g.number_id=n.id
        JOIN workspace_memberships owner ON owner.workspace_id=n.workspace_id AND owner.user_id=$4 AND owner.status='active' AND owner.role<>'viewer'
        JOIN sms_number_grants og ON og.workspace_id=n.workspace_id AND og.number_id=n.id AND og.user_id=owner.user_id
        WHERE n.workspace_id=$1 AND n.id=$2 AND n.status='active' AND n.account_sid=$5 AND n.phone=$6 AND g.user_id=$3 AND g.can_send AND og.can_send`,[context.workspace.id,input.numberId,context.user.id,input.ownerId,config.accountSid,config.phoneNumber]);
      if(!config.enabled || !allowed.rowCount)throw new IntroError("Choose a connected sending number and a call owner with active SMS send access. Your own send grant is also required.");
    }
    await db.query(`INSERT INTO lead_intro_settings(workspace_id,enabled,enabled_at,actor_user_id,owner_user_id,number_id,form_ids,start_minute,end_minute,weekdays,instructions,daily_limit)
      VALUES($1,$2,CASE WHEN $2 THEN now() ELSE NULL END,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(workspace_id) DO UPDATE SET enabled=EXCLUDED.enabled,enabled_at=EXCLUDED.enabled_at,actor_user_id=EXCLUDED.actor_user_id,owner_user_id=EXCLUDED.owner_user_id,number_id=EXCLUDED.number_id,form_ids=EXCLUDED.form_ids,start_minute=EXCLUDED.start_minute,end_minute=EXCLUDED.end_minute,weekdays=EXCLUDED.weekdays,instructions=EXCLUDED.instructions,daily_limit=EXCLUDED.daily_limit,revision=lead_intro_settings.revision+1,last_error_code=NULL,updated_at=now()`,[context.workspace.id,input.enabled,context.user.id,input.ownerId,input.numberId,input.formIds,input.startMinute,input.endMinute,input.weekdays,input.instructions,input.dailyLimit]);
    await db.query("UPDATE lead_intro_jobs SET status='cancelled',reason='settings_changed',updated_at=now() WHERE workspace_id=$1 AND status IN ('queued','generating','ready')",[context.workspace.id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"lead_intro.settings_saved",targetType:"integration",metadata:{enabled:input.enabled}});
  });
}

/** Called only in the fresh Meta import transaction. No backfill/enroll-existing action exists. */
export async function enqueueLeadIntroduction(db:PoolClient,workspace:string,eventId:string,leadId:string) {
  if(!introRuntimeEnabled())return;
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`agency-sms:${workspace}`]);
  const settings=(await db.query<Settings>("SELECT * FROM lead_intro_settings WHERE workspace_id=$1 AND enabled",[workspace])).rows[0];
  if(!settings?.number_id || !settings.actor_user_id || !settings.owner_user_id || !settings.enabled_at)return;
  const lead=(await db.query<{phone:string|null;submitted:string;form:string;created_at:Date;event_created:Date}>(`SELECT l.phone,l.meta_context->>'submittedAt' submitted,l.meta_context->>'formId' form,l.created_at,e.created_at event_created FROM leads l JOIN meta_lead_events e ON e.lead_id=l.id AND e.workspace_id=l.workspace_id WHERE l.workspace_id=$1 AND l.id=$2 AND e.id=$3 AND l.source='facebook' AND l.anonymized_at IS NULL`,[workspace,leadId,eventId])).rows[0];
  const phone=normalizePhone(lead?.phone||"");const submitted=Date.parse(lead?.submitted||"");
  if(!lead || !phone || !/^\+1\d{10}$/.test(phone) || !settings.form_ids.includes(lead.form) || !Number.isFinite(submitted) || submitted<settings.enabled_at.getTime() || submitted<Date.now()-3600000 || submitted>Date.now()+300000 || lead.event_created<settings.enabled_at)return;
  const config=getTwilioConfiguration();if(phone===config.phoneNumber)return;
  if((await db.query("SELECT 1 FROM sms_conversations WHERE workspace_id=$1 AND remote_phone=$2 UNION ALL SELECT 1 FROM lead_intro_jobs WHERE workspace_id=$1 AND recipient_key=$3 LIMIT 1",[workspace,phone,introFactsHash(phone)])).rowCount)return;
  const smsId=randomUUID(),conversationId=randomUUID(),id=randomUUID();
  await db.query("INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone,lead_id,owner_user_id,status) VALUES($1,$2,$3,$4,$5,$6,'waiting')",[smsId,workspace,settings.number_id,phone,leadId,settings.owner_user_id]);
  await db.query("INSERT INTO crm_conversations(id,workspace_id,lead_id,owner_user_id,status) VALUES($1,$2,$3,$4,'waiting')",[conversationId,workspace,leadId,settings.owner_user_id]);
  await db.query("INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,sms_conversation_id,external_addresses) VALUES($1,$2,$3,'sms',$4,$5)",[randomUUID(),workspace,conversationId,smsId,[phone]]);
  const due=nextIntroTime(new Date(Date.now()+20000),settings);
  await db.query(`INSERT INTO lead_intro_jobs(id,workspace_id,lead_id,event_id,recipient_key,phone,revision,number_id,actor_user_id,owner_user_id,conversation_id,sms_conversation_id,due_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()+interval '4 days')`,[id,workspace,leadId,eventId,introFactsHash(phone),phone,settings.revision,settings.number_id,settings.actor_user_id,settings.owner_user_id,conversationId,smsId,due]);
}

/** Rechecked before generation, reservation and delivery. Send grants never come from job payloads. */
export async function checkIntroduction(db:Pick<PoolClient,"query">,job:IntroJob,forSend=false):Promise<{settings:Settings;facts:IntroFacts;context:DashboardContext}> {
  if(!introRuntimeEnabled())throw new IntroError("automation_paused");
  const settings=(await db.query<Settings>("SELECT * FROM lead_intro_settings WHERE workspace_id=$1",[job.workspace_id])).rows[0];
  if(!settings?.enabled || settings.revision!==job.revision || settings.number_id!==job.number_id || settings.actor_user_id!==job.actor_user_id || !job.phone || !job.lead_id || job.expires_at.getTime()<=Date.now())throw new IntroError("settings_changed_or_expired");
  const config=getTwilioConfiguration();
  const actor=(await db.query<{id:string;name:string;email:string;role:DashboardContext["role"];workspace_name:string;slug:string}>(`SELECT u.id,u.name,u.email,m.role,w.name workspace_name,w.slug FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id JOIN workspaces w ON w.id=m.workspace_id
    JOIN sms_number_grants g ON g.workspace_id=w.id AND g.user_id=u.id AND g.number_id=$3 JOIN sms_numbers n ON n.id=g.number_id AND n.workspace_id=w.id
    WHERE w.id=$1 AND u.id=$2 AND w.status='active' AND m.status='active' AND m.role IN ('owner','admin') AND g.can_send AND n.status='active' AND n.account_sid=$4 AND n.phone=$5`,[job.workspace_id,job.actor_user_id,job.number_id,config.accountSid,config.phoneNumber])).rows[0];
  if(!config.enabled || !actor)throw new IntroError("sending_access_unavailable");
  if(!(await db.query("SELECT 1 FROM workspace_memberships m JOIN sms_number_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role<>'viewer' AND g.number_id=$3 AND g.can_send",[job.workspace_id,job.owner_user_id,job.number_id])).rowCount)throw new IntroError("call_owner_unavailable");
  const lead=(await db.query<IntroFacts & {phone:string|null;status:string;form:string}>("SELECT name,organization,interest,description,phone,status,meta_context->>'formId' form FROM leads WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",[job.workspace_id,job.lead_id])).rows[0];
  if(!lead || lead.status!=="new" || normalizePhone(lead.phone||"")!==job.phone || !settings.form_ids.includes(lead.form))throw new IntroError("lead_changed");
  const facts={name:lead.name,organization:lead.organization,interest:lead.interest,description:lead.description};
  if(forSend && introFactsHash(facts)!==job.facts_hash)throw new IntroError("lead_changed_after_draft");
  const conflict=await db.query(`SELECT 1 WHERE
    EXISTS(SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 AND status='blocked') OR
    EXISTS(SELECT 1 FROM sms_messages m JOIN sms_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE c.workspace_id=$1 AND c.remote_phone=$2 AND NOT EXISTS(SELECT 1 FROM sms_outbound_intents i WHERE i.message_id=m.id AND i.request_id=$3)) OR
    EXISTS(SELECT 1 FROM voice_conversations c JOIN voice_calls v ON v.voice_conversation_id=c.id AND v.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.remote_phone=$2) OR
    EXISTS(SELECT 1 FROM crm_conversation_sources s JOIN crm_conversations c ON c.id=s.conversation_id AND c.workspace_id=s.workspace_id WHERE c.workspace_id=$1 AND (c.lead_id=$4 OR $2=ANY(s.external_addresses)) AND s.channel='email' AND s.last_outbound_at IS NOT NULL) OR
    EXISTS(SELECT 1 FROM crm_activities a JOIN crm_opportunities o ON o.id=a.opportunity_id AND o.workspace_id=a.workspace_id WHERE o.workspace_id=$1 AND o.lead_id=$4 AND a.kind IN ('call','sms','email')) OR
    EXISTS(SELECT 1 FROM lead_alert_settings WHERE workspace_id=$1 AND recipients @> jsonb_build_array(jsonb_build_object('phone',$2::text))) OR
    NOT EXISTS(SELECT 1 FROM crm_conversations WHERE workspace_id=$1 AND id=$5 AND deleted_at IS NULL AND merged_into_id IS NULL AND status<>'archived') OR
    NOT EXISTS(SELECT 1 FROM sms_conversations WHERE workspace_id=$1 AND id=$6 AND deleted_at IS NULL AND lead_id=$4)`,[job.workspace_id,job.phone,job.id,job.lead_id,job.conversation_id,job.sms_conversation_id]);
  if(conflict.rowCount)throw new IntroError("contacted_opted_out_or_unavailable");
  if(forSend && !introWindowOpen(new Date(),settings))throw new IntroError("outside_sending_window");
  return {settings,facts,context:{user:{id:actor.id,name:actor.name,email:actor.email},workspace:{id:job.workspace_id,name:actor.workspace_name,slug:actor.slug},role:actor.role}};
}

export async function getIntroSettings(context:DashboardContext) {
  const role=await authorizeSales(context);if(!["owner","admin"].includes(role))return null;
  const pool=getDatabasePool();const settings=(await pool.query<Settings>("SELECT * FROM lead_intro_settings WHERE workspace_id=$1",[context.workspace.id])).rows[0];
  const recent=(await pool.query<{id:string;name:string;status:string;reason:string|null;body:string|null;generated_by:string|null;due_at:Date;conversation_id:string;delivery:string|null}>(`SELECT j.id,l.name,j.status,j.reason,j.body,j.generated_by,j.due_at,j.conversation_id,m.status delivery FROM lead_intro_jobs j LEFT JOIN leads l ON l.id=j.lead_id AND l.workspace_id=j.workspace_id LEFT JOIN sms_outbound_intents i ON i.request_id=j.id AND i.workspace_id=j.workspace_id LEFT JOIN sms_messages m ON m.id=i.message_id AND m.workspace_id=j.workspace_id WHERE j.workspace_id=$1 AND j.lead_id IS NOT NULL AND EXISTS(SELECT 1 FROM sms_number_grants g JOIN sms_numbers n ON n.id=g.number_id AND n.workspace_id=g.workspace_id WHERE g.workspace_id=j.workspace_id AND g.number_id=j.number_id AND g.user_id=$2 AND n.status='active') ORDER BY j.created_at DESC LIMIT 20`,[context.workspace.id,context.user.id])).rows;
  const members=(await pool.query<{id:string;name:string}>(`SELECT u.id,u.name FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer' ORDER BY u.name`,[context.workspace.id])).rows;
  const forms=(await pool.query<{id:string}>("SELECT DISTINCT form_id id FROM meta_lead_events WHERE workspace_id=$1 ORDER BY form_id LIMIT 100",[context.workspace.id])).rows;
  return {settings,liveAllowed:introRuntimeEnabled(),members,forms,recent:recent.map(j=>({...j,due_at:j.due_at.toISOString()}))};
}

export async function cancelLeadIntroduction(context:DashboardContext,conversationId:string) {
  return introTransaction(context.workspace.id,async db=>{
    const allowed=await db.query(`SELECT 1 FROM lead_intro_jobs j JOIN sms_number_grants g ON g.workspace_id=j.workspace_id AND g.number_id=j.number_id AND g.user_id=$3 JOIN workspace_memberships m ON m.workspace_id=j.workspace_id AND m.user_id=g.user_id WHERE j.workspace_id=$1 AND j.conversation_id=$2 AND m.status='active' AND m.role<>'viewer' AND g.can_send`,[context.workspace.id,conversationId,context.user.id]);
    if(!allowed.rowCount)throw new IntroError("Your number access does not allow pausing this introduction.");
    const changed=await db.query("UPDATE lead_intro_jobs SET status='cancelled',reason='human_takeover',lease_token=NULL,updated_at=now() WHERE workspace_id=$1 AND conversation_id=$2 AND status IN ('queued','generating','ready')",[context.workspace.id,conversationId]);
    if(!changed.rowCount)throw new IntroError("The introduction is already stopped or its send has started. Check delivery in the Inbox.");
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"lead_intro.paused",targetType:"conversation",targetId:conversationId});
  });
}
