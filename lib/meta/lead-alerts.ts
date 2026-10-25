import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeSales, SalesAccessError } from "@/lib/sales/data";
import { phoneSchema } from "@/lib/sms/validation";
import { getTwilioConfiguration, TWILIO_MESSAGE_SID } from "@/lib/twilio/config";
import { createSms, fetchSms, TwilioProviderError } from "@/lib/twilio/provider";
import { TwilioWebhookError } from "@/lib/twilio/webhook";

const schema = z.object({
  enabled: z.boolean(),
  recipients: z.array(z.object({ name: z.string().trim().min(1).max(60), phone: phoneSchema })).max(10),
}).superRefine((value, ctx) => {
  if (value.enabled && !value.recipients.length) ctx.addIssue({ code: "custom", message: "Add at least one teammate's mobile number." });
  if (new Set(value.recipients.map(r => r.phone)).size !== value.recipients.length) ctx.addIssue({ code: "custom", message: "Each receiving number should appear only once." });
});
type Settings = z.infer<typeof schema>;

export async function saveLeadAlertSettings(context: DashboardContext, input: unknown) {
  const value = schema.parse(input);
  if (value.recipients.some(r => r.phone === getTwilioConfiguration().phoneNumber)) throw new Error("Use teammates' mobile numbers, not the business sending number.");
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const access = await db.query(`SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id
      WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin') AND w.status='active' FOR SHARE OF m,w`, [context.workspace.id, context.user.id]);
    if (!access.rowCount) throw new SalesAccessError("Only an owner or administrator can manage lead alerts.");
    await db.query(`INSERT INTO lead_alert_settings(workspace_id,enabled,recipients) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(workspace_id) DO UPDATE SET enabled=EXCLUDED.enabled,recipients=EXCLUDED.recipients,updated_at=now()`, [context.workspace.id, value.enabled, JSON.stringify(value.recipients)]);
    // Removed recipients and paused alerts must not leave stale sends in the queue.
    await db.query(`UPDATE lead_sms_alerts SET status='cancelled',updated_at=now() WHERE workspace_id=$1 AND status='queued'
      AND (NOT $2 OR NOT recipient_phone=ANY($3::text[]))`, [context.workspace.id, value.enabled, value.recipients.map(r => r.phone)]);
    await insertAuditLog(db, { workspaceId: context.workspace.id, actorUserId: context.user.id, action: "lead_alerts.settings_saved", targetType: "integration", metadata: { enabled: value.enabled, recipients: value.recipients.length } });
    await db.query("COMMIT");
  } catch (e) { await db.query("ROLLBACK"); throw e; } finally { db.release(); }
}

export async function getLeadAlertSettings(context: DashboardContext) {
  const role = await authorizeSales(context);
  if (!["owner", "admin"].includes(role)) return null;
  const pool = getDatabasePool();
  const settings = (await pool.query<Settings>("SELECT enabled,recipients FROM lead_alert_settings WHERE workspace_id=$1", [context.workspace.id])).rows[0] ?? { enabled: false, recipients: [] };
  const recent = (await pool.query<{ id: string; recipient_name: string; status: string; error_code: string | null; created_at: Date }>(
    "SELECT id,recipient_name,status,error_code,created_at FROM lead_sms_alerts WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 12", [context.workspace.id])).rows;
  return { ...settings, sendingEnabled: getTwilioConfiguration().enabled, recent: recent.map(r => ({ ...r, created_at: r.created_at.toISOString() })) };
}

/** Enqueue in the lead import transaction. Webhook retries cannot duplicate alerts. */
export async function enqueueLeadAlerts(db: PoolClient, workspaceId: string, eventId: string, leadId: string) {
  const settings = (await db.query<Settings>("SELECT enabled,recipients FROM lead_alert_settings WHERE workspace_id=$1", [workspaceId])).rows[0];
  if (!settings?.enabled) return;
  for (const recipient of schema.parse(settings).recipients) {
    await db.query(`INSERT INTO lead_sms_alerts(id,workspace_id,event_id,lead_id,recipient_name,recipient_phone)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_id,recipient_phone) DO NOTHING`, [randomUUID(), workspaceId, eventId, leadId, recipient.name, recipient.phone]);
  }
}

export async function runLeadAlertWorker() {
  const config = getTwilioConfiguration();
  if (!config.enabled) return { checked: 0, failed: 0, more: false };
  const pool = getDatabasePool();
  // A process may die after Twilio accepted a send. Never retry an uncertain POST.
  await pool.query("UPDATE lead_sms_alerts SET status='unknown',updated_at=now() WHERE status='sending' AND updated_at<now()-interval '2 minutes'");
  await pool.query(`UPDATE lead_sms_alerts a SET status='cancelled',updated_at=now() WHERE status='queued' AND
    (lead_id IS NULL OR created_at<now()-interval '1 day' OR NOT EXISTS(SELECT 1 FROM lead_alert_settings s WHERE s.workspace_id=a.workspace_id AND s.enabled AND s.recipients @> jsonb_build_array(jsonb_build_object('phone',a.recipient_phone))))`);
  let checked = 0, failed = 0;
  for (let i = 0; i < 3; i++) {
    const db = await pool.connect();
    let job: { id: string; lead_id: string; recipient_phone: string; name: string } | undefined;
    try {
      await db.query("BEGIN");
      job = (await db.query<{ id: string; lead_id: string; recipient_phone: string; name: string }>(`SELECT a.id,a.lead_id,a.recipient_phone,l.name FROM lead_sms_alerts a
        JOIN leads l ON l.id=a.lead_id AND l.workspace_id=a.workspace_id
        JOIN workspaces w ON w.id=a.workspace_id AND w.status='active'
        JOIN lead_alert_settings settings ON settings.workspace_id=a.workspace_id AND settings.enabled
        JOIN sms_numbers n ON n.workspace_id=a.workspace_id AND n.account_sid=$1 AND n.phone=$2 AND n.status='active'
        WHERE a.status='queued' AND a.recipient_phone<>$2
        AND settings.recipients @> jsonb_build_array(jsonb_build_object('phone',a.recipient_phone))
        AND NOT EXISTS(SELECT 1 FROM crm_channel_preferences p WHERE p.workspace_id=a.workspace_id AND p.channel='sms' AND p.normalized_address=a.recipient_phone AND p.status='blocked')
        ORDER BY a.created_at,a.id LIMIT 1 FOR UPDATE OF a,settings SKIP LOCKED`, [config.accountSid, config.phoneNumber])).rows[0];
      if (job) await db.query("UPDATE lead_sms_alerts SET status='sending',account_sid=$2,sender_phone=$3,updated_at=now() WHERE id=$1", [job.id, config.accountSid, config.phoneNumber]);
      await db.query("COMMIT");
    } catch(e) { await db.query("ROLLBACK"); throw e; } finally { db.release(); }
    if (!job) break;
    checked++;
    try {
      const text = `New Facebook/Instagram lead: ${job.name.replace(/[\r\n\t]+/g, " ").slice(0, 80)}.\nOpen in CRM: ${config.baseUrl}/dashboard/leads/${job.lead_id}`;
      const result = await createSms({ from: config.phoneNumber, to: job.recipient_phone, text, attemptId: job.id });
      if (result.accountSid !== config.accountSid || result.from !== config.phoneNumber || result.to !== job.recipient_phone) throw new Error("provider_identity_mismatch");
      await pool.query(`UPDATE lead_sms_alerts SET provider_sid=$2,status=CASE WHEN $3 IN ('failed','undelivered') THEN 'failed' WHEN $3='delivered' THEN 'delivered' ELSE 'accepted' END,status_rank=CASE WHEN $3 IN ('delivered','failed','undelivered') THEN 50 ELSE 10 END,updated_at=now()
        WHERE id=$1 AND status IN ('sending','unknown') AND (provider_sid IS NULL OR provider_sid=$2)`, [job.id, result.sid, result.status]);
    } catch (error) {
      failed++;
      await pool.query("UPDATE lead_sms_alerts SET status=$2,error_code=$3,updated_at=now() WHERE id=$1 AND status='sending'", [job.id, error instanceof TwilioProviderError && error.outcome === "rejected" ? "failed" : "unknown", error instanceof TwilioProviderError ? error.providerCode?.toString() ?? "send_failed" : "send_unknown"]);
    }
  }
  // Cron already runs regularly. Do not spin on paused/blocked recipients.
  return { checked, failed, more: checked === 3 };
}

/** Called only after the shared endpoint validates Twilio's signature. */
export async function receiveLeadAlertStatus(attemptId: string, params: Record<string, string>) {
  const pool = getDatabasePool();
  const job = (await pool.query<{ id: string; account_sid: string; sender_phone: string; recipient_phone: string; provider_sid: string | null; status: string }>("SELECT * FROM lead_sms_alerts WHERE id=$1", [attemptId])).rows[0];
  if (!job) return false;
  const sid = params.MessageSid || params.SmsSid;
  const status = params.MessageStatus || params.SmsStatus;
  if (!TWILIO_MESSAGE_SID.test(sid ?? "") || !['accepted','queued','sending','sent','delivered','undelivered','failed'].includes(status) || (params.ErrorCode && !/^\d{1,20}$/.test(params.ErrorCode))) throw new TwilioWebhookError(400, "invalid_alert_status");
  if (job.account_sid !== params.AccountSid || (job.provider_sid && job.provider_sid !== sid) || !["sending","unknown","accepted","delivered","failed"].includes(job.status)) throw new TwilioWebhookError(403, "alert_identity_mismatch");
  const identity = params.From && params.To ? { from: params.From, to: params.To, accountSid: params.AccountSid } : await fetchSms(sid);
  if (identity.from !== job.sender_phone || identity.to !== job.recipient_phone || identity.accountSid !== job.account_sid) throw new TwilioWebhookError(403, "alert_identity_mismatch");
  const rank = ['delivered','undelivered','failed'].includes(status) ? 50 : 10;
  await pool.query(`UPDATE lead_sms_alerts SET provider_sid=$2,status=$3,status_rank=$4,error_code=$5,updated_at=now()
    WHERE id=$1 AND status_rank<$4 AND (provider_sid IS NULL OR provider_sid=$2)`, [job.id, sid, status === 'delivered' ? 'delivered' : ['failed','undelivered'].includes(status) ? 'failed' : 'accepted', rank, params.ErrorCode || null]);
  return true;
}
