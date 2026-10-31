import {requireMcpAuthorization} from './mcp-authorization';
import {apiSendPolicy} from './send-policy';
import type { MailEnv } from './receive';
import { createResendProvider } from './providers/resend-provider';
import { readOutboundAttachments } from './attachments';
import { sendOutboundEmail, type OutboundMailInput } from './send-mail';
import { normalizeMessageId } from './send-mail';
import { createResendClient } from './resend';
import { requireCrmMailboxGrant } from './crm-mail-grants';

export function mayRetrySend(firstCall: string | null, now = Date.now()): boolean {
  return !firstCall || now-Date.parse(firstCall.replace(' ','T') + (firstCall.endsWith('Z') ? '' : 'Z')) < 23*3600_000;
}
export async function recoverOutgoing(env: MailEnv): Promise<void> {
  const rows = await env.DB.prepare(`SELECT a.* FROM send_attempts a JOIN users u ON u.id=a.user_id
    WHERE a.status='sending' AND a.payload_key IS NOT NULL AND a.updated_at<datetime('now','-5 minutes') AND u.disabled_at IS NULL LIMIT 10`)
    .all<{id:string;user_id:string;email_id:string;payload_key:string;provider_id:string|null;first_provider_call_at:string|null;created_at:string}>();
  for (const row of rows.results) {
    const claimed = await env.DB.prepare("UPDATE send_attempts SET updated_at=datetime('now') WHERE id=? AND status='sending' AND updated_at<datetime('now','-5 minutes') RETURNING id").bind(row.id).first();
    if (!claimed) continue;
    if (!row.provider_id && !mayRetrySend(row.first_provider_call_at ?? row.created_at)) {
      await env.DB.prepare("UPDATE emails SET status_detail='Delivery could not be confirmed. Ask the owner to check Resend before sending again.' WHERE id=?").bind(row.email_id).run();
      continue;
    }
    try {
      let providerId = row.provider_id;
      let messageId: string | null = null;
      if (!providerId) {
        const oauth = await env.DB.prepare('SELECT family_id,resource FROM oauth_send_authorizations WHERE attempt_id=?').bind(row.id).first<{family_id:string;resource:string}>();
        if(oauth) {
          if(!apiSendPolicy(env).enabled || !env.APP_URL || oauth.resource !== new URL('/mcp',env.APP_URL).href) throw new Error('External sending disabled or wrong resource');
          await requireMcpAuthorization(env.DB,row.user_id,{familyId:oauth.family_id,resource:oauth.resource},'mail:send');
        }
        const crm=await env.DB.prepare('SELECT actor_id,mailbox_address_id FROM crm_mail_send_authorizations WHERE attempt_id=?')
          .bind(row.id).first<{actor_id:string;mailbox_address_id:string}>();
        if (crm) await requireCrmMailboxGrant(env.DB,crm.actor_id,crm.mailbox_address_id,true);
        const object = await env.ATTACHMENTS.get(row.payload_key);
        if (!object) throw new Error('Saved send request unavailable');
        const payload = await object.json<OutboundMailInput>();
        if(oauth && !await env.DB.prepare('SELECT id FROM addresses WHERE id=? AND user_id=? AND address=?').bind(payload.from.id,row.user_id,payload.from.address).first()) throw new Error('Sender ownership changed');
        const files = await readOutboundAttachments(env.DB,env.ATTACHMENTS,row.user_id,row.email_id);
        if (!row.first_provider_call_at) await env.DB.prepare("UPDATE send_attempts SET first_provider_call_at=datetime('now') WHERE id=?").bind(row.id).run();
        const sent = await sendOutboundEmail(createResendProvider(env.RESEND_API_KEY),{...payload,attachments:files});
        providerId = sent.providerId; messageId = sent.messageId ?? null;
      }
      await env.DB.batch([
        env.DB.prepare("UPDATE emails SET provider_id=?,message_id=COALESCE(?,message_id),status='sent',status_detail=NULL,status_at=datetime('now') WHERE id=? AND provider_id IS NULL").bind(providerId,messageId,row.email_id),
        env.DB.prepare("UPDATE send_attempts SET status='sent',provider_id=?,error=NULL,updated_at=datetime('now') WHERE id=?").bind(providerId,row.id)
      ]);
    } catch { console.warn(JSON.stringify({event:'outgoing_recovery_pending',attempt:row.id})); }
  }
  // Recover the wire identifier if its first lookup and delivery notification
  // were both missed. This reads provider metadata and never sends a new email.
  const missingIds=await env.DB.prepare("SELECT id,provider_id FROM emails WHERE direction='outbound' AND provider_id IS NOT NULL AND message_id=id||'@'||? LIMIT 10").bind(env.MAIL_DOMAIN).all<{id:string;provider_id:string}>();
  for(const row of missingIds.results){
    try{
      const messageId=normalizeMessageId((await createResendClient(env.RESEND_API_KEY).getSentEmail(row.provider_id)).message_id);
      if(messageId)await env.DB.prepare('UPDATE emails SET message_id=? WHERE id=?').bind(messageId,row.id).run();
    }catch{console.warn(JSON.stringify({event:'outgoing_message_id_pending',id:row.id}));}
  }
}
