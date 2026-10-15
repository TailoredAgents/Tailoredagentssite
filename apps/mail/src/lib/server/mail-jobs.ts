import type { Queue } from '@cloudflare/workers-types';
import { receiveEmail, recipientAddresses, type MailEnv } from './receive';
import { createResendClient } from './resend';
import { recoverOutgoing } from './outgoing-recovery';
import { purgeExpiredMail } from './retention';
import { normalizeMessageId } from './send-mail';

export type JobEnv = MailEnv & { MAIL_JOBS: Queue<{ id: string }> };
export async function queueEvent(env: JobEnv, eventId: string, event: { type: string; data?: Record<string,unknown>; created_at?: string }): Promise<void> {
  const providerId = event.data?.email_id;
  if (typeof providerId !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(providerId)) throw new Error('Invalid email identifier');
  // One Resend account may serve unrelated applications. Discard their metadata
  // before persistence; absent recipient fields remain recoverable for older events.
  if (event.type === 'email.received' && Array.isArray(event.data?.to)) {
    const addresses = {to:event.data.to as string[],cc:Array.isArray(event.data.cc)?event.data.cc as string[]:[],bcc:Array.isArray(event.data.bcc)?event.data.bcc as string[]:[]};
    if (!recipientAddresses(addresses,env.MAIL_DOMAIN).length) return;
  }
  if (event.type !== 'email.received' && typeof event.data?.from === 'string' && !recipientAddresses({to:[event.data.from]},env.MAIL_DOMAIN).length) return;
  const id = event.type === 'email.received' ? 'receive:' + providerId : 'event:' + eventId;
  await env.DB.prepare("INSERT INTO mail_jobs(id,kind,payload) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(id,event.type,JSON.stringify(event)).run();
  // A lost queue submission is recoverable by the scheduled database scan.
  await env.MAIL_JOBS.send({id});
}
export async function processJob(env: JobEnv, id: string): Promise<void> {
  const job = await env.DB.prepare(`UPDATE mail_jobs SET state='running',lease_until=datetime('now','+5 minutes'),attempts=attempts+1,updated_at=datetime('now')
    WHERE id=? AND (state IN ('pending','retry') OR (state='running' AND lease_until<datetime('now'))) RETURNING kind,payload`)
    .bind(id).first<{kind:string;payload:string}>();
  if (!job) return;
  try {
    const event = JSON.parse(job.payload);
    if (job.kind === 'email.received') await receiveEmail(env,event.data.email_id,event.assignedUserId);
    else {
      const status = ({'email.sent':'sent','email.delivered':'delivered','email.delivery_delayed':'delayed','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.suppressed':'failed'} as Record<string,string>)[job.kind];
      if (status) {
        // An event can arrive before the send HTTP response; keep it retryable until the row is linked.
        const exists = await env.DB.prepare("SELECT id FROM emails WHERE provider_id=? AND direction='outbound'").bind(event.data.email_id).first();
        if (!exists) {
          const pending=await env.DB.prepare("SELECT id FROM send_attempts WHERE status='sending' AND first_provider_call_at IS NOT NULL LIMIT 1").first();
          if(pending)throw new Error('Waiting for outgoing message to be recorded');
        }
        if (typeof event.data.message_id === 'string') {
          await env.DB.prepare("UPDATE emails SET message_id=? WHERE provider_id=? AND direction='outbound'").bind(normalizeMessageId(event.data.message_id),event.data.email_id).run();
        }
        const eventTime = event.created_at ?? new Date().toISOString();
        await env.DB.prepare(`UPDATE emails SET status=?,status_at=?,provider_event_at=?,status_detail=? WHERE provider_id=? AND direction='outbound'
          AND (provider_event_at IS NULL OR julianday(provider_event_at)<=julianday(?))
          AND (status NOT IN ('bounced','complained','failed') OR ? IN ('bounced','complained','failed'))
          AND (status<>'delivered' OR ? NOT IN ('sent','delayed'))`)
          .bind(status,eventTime,eventTime,['bounced','failed','complained'].includes(status) ? 'Delivery needs attention. Check the recipient address before trying again.' : null,event.data.email_id,eventTime,status,status).run();
      }
    }
    await env.DB.prepare("UPDATE mail_jobs SET state='complete',lease_until=NULL,last_error=NULL,updated_at=datetime('now') WHERE id=?").bind(id).run();
  } catch {
    await env.DB.prepare("UPDATE mail_jobs SET state=CASE WHEN attempts>=8 THEN 'attention' ELSE 'retry' END,lease_until=NULL,last_error='Mail processing needs another attempt.',updated_at=datetime('now') WHERE id=?").bind(id).run();
    console.warn(JSON.stringify({event:'mail_job_retry',id}));
    throw new Error('Mail job needs another attempt');
  }
}
export async function maintainMail(env: JobEnv): Promise<void> {
  const jobs = await env.DB.prepare("SELECT id FROM mail_jobs WHERE state IN ('pending','retry') OR (state='running' AND lease_until<datetime('now')) ORDER BY created_at LIMIT 100").all<{id:string}>();
  for (const job of jobs.results) await env.MAIL_JOBS.send({id:job.id});
  // Storage cleanup and send recovery still run when the receiving API is unavailable.
  const maintenance = await Promise.allSettled([recoverOutgoing(env),purgeExpiredMail(env)]);
  const maintenanceError = maintenance.some(result => result.status === 'rejected');
  if (maintenanceError) console.warn(JSON.stringify({event:'mail_maintenance_needs_attention'}));
  await env.DB.prepare("INSERT INTO app_state(key,value) VALUES ('maintenance_error',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(maintenanceError ? 'Storage cleanup or outgoing recovery needs another attempt.' : '').run();
  const client = createResendClient(env.RESEND_API_KEY);
  const checkpoint = await env.DB.prepare("SELECT value FROM app_state WHERE key='last_receive_check'").first<{value:string}>();
  const cutoff = checkpoint ? Date.parse(checkpoint.value)-3600_000 : Date.now()-29*86400_000;
  let after: string | undefined;
  const started = new Date().toISOString();
  let finished = false;
  // Walk up to 1,000 records per sweep. A continuation is saved for unusually busy mailboxes.
  const continuation = await env.DB.prepare("SELECT value FROM app_state WHERE key='receive_cursor'").first<{value:string}>();
  after = continuation?.value || undefined;
  for (let page=0;page<10;page++) {
    const emails = await client.listReceivedPage(after);
    for (const email of emails.data) {
      if (Date.parse(email.created_at) >= cutoff && recipientAddresses(email,env.MAIL_DOMAIN).length) await queueEvent(env,'reconcile-'+email.id,{type:'email.received',data:{email_id:email.id}});
    }
    const last = emails.data.at(-1);
    if (!emails.has_more || !last || Date.parse(last.created_at)<cutoff) { finished=true; break; }
    after=last.id;
  }
  await env.DB.prepare("INSERT INTO app_state(key,value) VALUES ('receive_cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(finished ? '' : after ?? '').run();
  if (finished) await env.DB.prepare("INSERT INTO app_state(key,value) VALUES ('last_receive_check',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(started).run();
}
