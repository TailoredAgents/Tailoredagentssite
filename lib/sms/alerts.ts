import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeSms, SmsAccessError } from "./data";
import { phoneSchema } from "./validation";
import { getTwilioConfiguration, TWILIO_MESSAGE_SID } from "@/lib/twilio/config";
import { createSms, fetchSms, TwilioProviderError } from "@/lib/twilio/provider";
import { TwilioWebhookError } from "@/lib/twilio/webhook";

const schema = z.object({enabled:z.boolean(),userId:z.string().min(1).max(200),phone:phoneSchema.refine(v=>/^\+1[0-9]{10}$/.test(v),"Enter a 10-digit US mobile number.")});
export async function saveSmsAlertSettings(context: DashboardContext, input: unknown) {
  const value = schema.parse(input), config = getTwilioConfiguration();
  if (value.phone === config.phoneNumber) throw new Error("Use a personal mobile number.");
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`agency-sms:${context.workspace.id}`]);
    const access = await db.query(`SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin') AND w.status='active' FOR SHARE OF m,w`,[context.workspace.id,context.user.id]);
    if (!access.rowCount) throw new SmsAccessError("Only administrators can change text alerts.");
    const recipient = await db.query(`SELECT 1 FROM sms_number_grants g JOIN sms_numbers n ON n.id=g.number_id AND n.workspace_id=g.workspace_id JOIN workspace_memberships m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id
      WHERE g.workspace_id=$1 AND g.user_id=$2 AND m.status='active' AND n.phone=$3 AND n.account_sid=$4`,[context.workspace.id,value.userId,config.phoneNumber,config.accountSid]);
    if (!recipient.rowCount) throw new SmsAccessError("Choose an active teammate with access to the business SMS inbox.");
    await db.query(`INSERT INTO sms_alert_settings(workspace_id,enabled,user_id,phone) VALUES($1,$2,$3,$4)
      ON CONFLICT(workspace_id) DO UPDATE SET enabled=EXCLUDED.enabled,user_id=EXCLUDED.user_id,phone=EXCLUDED.phone,updated_at=now()`,[context.workspace.id,value.enabled,value.userId,value.phone]);
    await db.query("UPDATE incoming_sms_alerts SET status='cancelled',updated_at=now() WHERE workspace_id=$1 AND status='queued' AND (NOT $2 OR recipient_user_id<>$3 OR recipient_phone<>$4)",[context.workspace.id,value.enabled,value.userId,value.phone]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"sms.alerts.settings_saved",targetType:"integration",metadata:{enabled:value.enabled}});
    await db.query("COMMIT");
  } catch(e) {await db.query("ROLLBACK");throw e;} finally {db.release();}
}
export async function getSmsAlertSettings(context: DashboardContext) {
  if (!["owner","admin"].includes(await authorizeSms(context))) return null;
  const pool=getDatabasePool(), config=getTwilioConfiguration();
  const settings=(await pool.query<{enabled:boolean;user_id:string;phone:string}>("SELECT enabled,user_id,phone FROM sms_alert_settings WHERE workspace_id=$1",[context.workspace.id])).rows[0];
  const members=(await pool.query<{id:string;name:string}>(`SELECT DISTINCT u.id,u.name FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id JOIN sms_number_grants g ON g.workspace_id=m.workspace_id AND g.user_id=u.id JOIN sms_numbers n ON n.id=g.number_id AND n.workspace_id=g.workspace_id WHERE m.workspace_id=$1 AND m.status='active' AND n.phone=$2 AND n.account_sid=$3 ORDER BY u.name,u.id`,[context.workspace.id,config.phoneNumber,config.accountSid])).rows;
  const recent=(await pool.query<{id:string;status:string;error_code:string|null}>("SELECT id,status,error_code FROM incoming_sms_alerts WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 5",[context.workspace.id])).rows;
  return {enabled:settings?.enabled ?? false,userId:settings?.user_id ?? context.user.id,phone:settings?.phone ?? "",members,recent,sendingEnabled:config.enabled};
}
/** Runs inside the inbound transaction, already serialized by workspace. */
export async function enqueueIncomingSmsAlert(db: PoolClient, workspace: string, messageId: string, conversationId: string) {
  await db.query(`INSERT INTO incoming_sms_alerts(id,workspace_id,message_id,conversation_id,recipient_user_id,recipient_phone)
    SELECT $1,s.workspace_id,m.id,c.id,s.user_id,s.phone FROM sms_alert_settings s
    JOIN sms_conversations c ON c.workspace_id=s.workspace_id AND c.id=$4 AND c.deleted_at IS NULL
    JOIN sms_messages m ON m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND m.id=$3 AND m.direction='inbound'
    JOIN sms_number_grants g ON g.workspace_id=c.workspace_id AND g.number_id=c.number_id AND g.user_id=s.user_id
    JOIN workspace_memberships member ON member.workspace_id=s.workspace_id AND member.user_id=s.user_id AND member.status='active'
    WHERE s.workspace_id=$2 AND s.enabled AND c.remote_phone<>s.phone
    AND NOT EXISTS(SELECT 1 FROM lead_alert_settings ls WHERE ls.workspace_id=s.workspace_id AND ls.recipients @> jsonb_build_array(jsonb_build_object('phone',c.remote_phone)))
    AND NOT EXISTS(SELECT 1 FROM incoming_sms_alerts a WHERE a.workspace_id=s.workspace_id AND a.conversation_id=c.id AND a.recipient_phone=s.phone AND a.created_at>now()-interval '2 minutes' AND a.status<>'cancelled')
    ON CONFLICT(message_id) DO NOTHING`,[randomUUID(),workspace,messageId,conversationId]);
}
export async function runIncomingSmsAlertWorker() {
  const config=getTwilioConfiguration();
  if (!config.enabled) return {checked:0,failed:0,more:false};
  const pool=getDatabasePool();
  await pool.query("UPDATE incoming_sms_alerts SET status='unknown',updated_at=now() WHERE status='sending' AND updated_at<now()-interval '2 minutes'");
  // Queued alerts expire instead of delivering obsolete notifications after an outage.
  await pool.query(`UPDATE incoming_sms_alerts a SET status='cancelled',updated_at=now() WHERE status='queued' AND
    (created_at<now()-interval '1 hour' OR NOT EXISTS(SELECT 1 FROM sms_alert_settings s JOIN sms_conversations c ON c.workspace_id=s.workspace_id AND c.id=a.conversation_id AND c.deleted_at IS NULL
      WHERE s.workspace_id=a.workspace_id AND s.enabled AND s.user_id=a.recipient_user_id AND s.phone=a.recipient_phone))`);
  let checked=0,failed=0;
  for(let i=0;i<3;i++) {
    const db=await pool.connect();
    let job:{id:string;conversation_id:string;recipient_phone:string;remote_phone:string}|undefined;
    try {
      await db.query("BEGIN");
      job=(await db.query<{id:string;conversation_id:string;recipient_phone:string;remote_phone:string}>(`SELECT a.id,a.conversation_id,a.recipient_phone,c.remote_phone FROM incoming_sms_alerts a
        JOIN sms_alert_settings s ON s.workspace_id=a.workspace_id AND s.enabled AND s.user_id=a.recipient_user_id AND s.phone=a.recipient_phone
        JOIN sms_conversations c ON c.workspace_id=a.workspace_id AND c.id=a.conversation_id AND c.deleted_at IS NULL
        JOIN sms_numbers n ON n.workspace_id=c.workspace_id AND n.id=c.number_id AND n.status='active' AND n.account_sid=$1 AND n.phone=$2
        JOIN sms_number_grants g ON g.workspace_id=c.workspace_id AND g.number_id=c.number_id AND g.user_id=a.recipient_user_id
        JOIN workspace_memberships m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id AND m.status='active'
        JOIN workspaces w ON w.id=a.workspace_id AND w.status='active'
        WHERE a.status='queued' AND a.recipient_phone<>$2 AND c.remote_phone<>a.recipient_phone
        AND NOT EXISTS(SELECT 1 FROM crm_channel_preferences p WHERE p.workspace_id=a.workspace_id AND p.channel='sms' AND p.normalized_address=a.recipient_phone AND p.status='blocked')
        ORDER BY a.created_at,a.id LIMIT 1 FOR UPDATE OF a,s,m,g SKIP LOCKED`,[config.accountSid,config.phoneNumber])).rows[0];
      if(job) await db.query("UPDATE incoming_sms_alerts SET status='sending',account_sid=$2,sender_phone=$3,updated_at=now() WHERE id=$1",[job.id,config.accountSid,config.phoneNumber]);
      await db.query("COMMIT");
    } catch(e) {await db.query("ROLLBACK");throw e;} finally {db.release();}
    if(!job) break;
    checked++;
    try {
      // ASCII and a short link keep the production alert within one SMS segment.
      const text=`New text from ${job.remote_phone}. Reply in CRM: ${config.baseUrl}/dashboard/inbox?text=${job.conversation_id}`;
      const result=await createSms({from:config.phoneNumber,to:job.recipient_phone,text,attemptId:job.id});
      if(result.accountSid!==config.accountSid || result.from!==config.phoneNumber || result.to!==job.recipient_phone) throw new Error("provider_identity_mismatch");
      await pool.query(`UPDATE incoming_sms_alerts SET provider_sid=$2,status=CASE WHEN $3 IN ('failed','undelivered') THEN 'failed' WHEN $3='delivered' THEN 'delivered' ELSE 'accepted' END,status_rank=CASE WHEN $3 IN ('delivered','failed','undelivered') THEN 50 ELSE 10 END,updated_at=now()
        WHERE id=$1 AND status IN ('sending','unknown') AND (provider_sid IS NULL OR provider_sid=$2)`,[job.id,result.sid,result.status]);
    } catch(e) {
      failed++;
      await pool.query("UPDATE incoming_sms_alerts SET status=$2,error_code=$3,updated_at=now() WHERE id=$1 AND status='sending'",[job.id,e instanceof TwilioProviderError && e.outcome==='rejected'?'failed':'unknown',e instanceof TwilioProviderError?e.providerCode?.toString()??'send_failed':'send_unknown']);
    }
  }
  return {checked,failed,more:checked===3};
}

/** Called after the shared endpoint authenticates the full Twilio request. */
export async function receiveIncomingSmsAlertStatus(attemptId:string,params:Record<string,string>) {
  const pool=getDatabasePool();
  const job=(await pool.query<{account_sid:string;sender_phone:string;recipient_phone:string;provider_sid:string|null;status:string}>("SELECT * FROM incoming_sms_alerts WHERE id=$1",[attemptId])).rows[0];
  if(!job) return false;
  const sid=params.MessageSid||params.SmsSid,status=params.MessageStatus||params.SmsStatus;
  if(!TWILIO_MESSAGE_SID.test(sid??'') || !['accepted','queued','sending','sent','delivered','undelivered','failed'].includes(status) || (params.ErrorCode && !/^\d{1,20}$/.test(params.ErrorCode))) throw new TwilioWebhookError(400,"invalid_alert_status");
  if(job.account_sid!==params.AccountSid || (job.provider_sid && job.provider_sid!==sid) || !['sending','unknown','accepted','delivered','failed'].includes(job.status)) throw new TwilioWebhookError(403,"alert_identity_mismatch");
  const identity=params.From && params.To?{from:params.From,to:params.To,accountSid:params.AccountSid}:await fetchSms(sid);
  if(identity.from!==job.sender_phone || identity.to!==job.recipient_phone || identity.accountSid!==job.account_sid) throw new TwilioWebhookError(403,"alert_identity_mismatch");
  const rank=['delivered','undelivered','failed'].includes(status)?50:10;
  await pool.query("UPDATE incoming_sms_alerts SET provider_sid=$2,status=$3,status_rank=$4,error_code=$5,updated_at=now() WHERE id=$1 AND status_rank<$4 AND (provider_sid IS NULL OR provider_sid=$2)",[attemptId,sid,status==='delivered'?'delivered':['failed','undelivered'].includes(status)?'failed':'accepted',rank,params.ErrorCode||null]);
  return true;
}
