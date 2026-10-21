import {normalizeMessageId} from './send-mail';
import { storeResponse } from './stream-storage';
import { indexFullText } from './search';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { parseEmailAddresses, parseEmailIdentity } from './email-address';
import { createResendClient, type ReceivedEmail } from './resend';
import { insertEmail } from './mail-store';
import { normalizeContentId } from './attachments';
import { saveContent } from './content';
import { sha256Hex } from './send-attempts';

export type MailEnv = { DB: D1Database; ATTACHMENTS: R2Bucket; RESEND_API_KEY: string; MAIL_DOMAIN: string };
export function recipientAddresses(email: Pick<ReceivedEmail, 'to' | 'cc' | 'bcc'>, domain: string): string[] {
  // Resend's `to` is the SMTP envelope, including CC/BCC deliveries. The visible
  // CC and MIME headers are not authority to deliver another person's copy.
  return [...new Set(parseEmailAddresses(email.to ?? []).map(a => a.toLowerCase()))].filter(a => a.endsWith('@' + domain.toLowerCase()));
}
async function deliveryIdentity(email: ReceivedEmail, providerId: string): Promise<string> {
  const messageId = normalizeMessageId(email.message_id);
  if (!messageId) return providerId;
  // Resend can create one API ID per envelope recipient. A teammate with two
  // aliases still gets one copy. Include content so reused Message-IDs do not
  // discard a different message; exclude envelope addresses and provider file IDs.
  return 'message:' + await sha256Hex(JSON.stringify({messageId,from:email.from,
    to:email.headers?.to ?? '',cc:email.headers?.cc ?? '',subject:email.subject,
    text:email.text,html:email.html,replyTo:email.reply_to,
    files:email.attachments?.map(({filename,content_type,content_id,size})=>({filename,content_type,content_id,size}))}));
}
export function shouldFileAsJunk(email: ReceivedEmail, blocked: boolean): boolean {
  return blocked || email.authentication?.dmarc === 'fail';
}
export function boundedStream(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let size = 0;
  return body.pipeThrough(new TransformStream({ transform(chunk, controller) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error('Incoming content exceeds the storage safety limit');
    controller.enqueue(chunk);
  } }));
}

export async function receiveEmail(env: MailEnv, providerId: string, assignedUserId?: string): Promise<void> {
  const client = createResendClient(env.RESEND_API_KEY);
  const storedKey = `received/${providerId}/source.json`;
  const stored = await env.ATTACHMENTS.get(storedKey);
  const email = stored ? await stored.json<ReceivedEmail>() : await client.getReceivedEmail(providerId, 'cid');
  if (email.headers) email.headers=Object.fromEntries(Object.entries(email.headers).map(([key,value])=>[key.toLowerCase(),value]));
  const recipients = recipientAddresses(email, env.MAIL_DOMAIN);
  if (recipients.length === 0) return; // Webhooks can also belong to other applications in the Resend account.
  if (!stored) await env.ATTACHMENTS.put(storedKey, JSON.stringify(email));
  const found = await env.DB.prepare(`SELECT a.id, a.user_id, a.domain_id, a.address FROM addresses a
    JOIN users u ON u.id=a.user_id WHERE a.address IN (${recipients.map(() => '?').join(',')}) AND u.disabled_at IS NULL`).bind(...recipients).all<{ id: string; user_id: string; domain_id: string; address: string }>();
  let routes = found.results;
  if (assignedUserId) {
    const assigned = await env.DB.prepare('SELECT a.id, a.user_id, a.domain_id, a.address FROM addresses a JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND u.disabled_at IS NULL ORDER BY a.is_default DESC LIMIT 1').bind(assignedUserId).first<typeof routes[number]>();
    if (!assigned) throw new Error('This person does not have an active inbox');
    routes = [assigned];
  }
  const unmatched = recipients.filter(a => !found.results.some(r => r.address === a));
  if (!assignedUserId && unmatched.length) {
    await env.DB.prepare(`INSERT INTO unassigned_mail(provider_id,content_key,recipient,sender,subject) VALUES (?,?,?,?,?) ON CONFLICT(provider_id) DO NOTHING`)
      .bind(providerId,storedKey,unmatched.join(', '),email.from,email.subject ?? '(no subject)').run();
  }
  const uniqueUsers = [...new Map(routes.map(r => [r.user_id,r])).values()];
  const sender = parseEmailIdentity(email.headers?.from ?? email.from);
  const identity = await deliveryIdentity(email,providerId);
  let incomplete = false;
  for (const route of uniqueUsers) {
    const receipt=await env.DB.prepare('SELECT email_id,discarded_at FROM mail_deliveries WHERE provider_id IN (?,?) AND user_id=? ORDER BY discarded_at DESC LIMIT 1').bind(identity,providerId,route.user_id).first<{email_id:string;discarded_at:string|null}>();
    if(receipt?.discarded_at)continue;
    const id = receipt?.email_id ?? 'received-' + await sha256Hex(identity + ':' + route.user_id);
    await env.DB.batch([...new Set([identity,providerId])].map(key=>env.DB.prepare('INSERT OR IGNORE INTO mail_deliveries(provider_id,user_id,email_id) VALUES (?,?,?)').bind(key,route.user_id,id)));
    const current = await env.DB.prepare('SELECT id,import_state,provider_id FROM emails WHERE id=?').bind(id).first<{id:string;import_state:string;provider_id:string}>();
    const recordAddressDeliveries=async()=>{
      // Manual assignment picks a fallback identity; it is not proof of an
      // envelope delivery to that address and must not expand CRM sharing.
      if (!assignedUserId) {
        const deliveries=routes.filter(r=>r.user_id===route.user_id).map(r=>env.DB.prepare(
          'INSERT OR IGNORE INTO email_address_deliveries(email_id,address_id) VALUES (?,?)').bind(id,r.id));
        if (deliveries.length) await env.DB.batch(deliveries);
      }
    };
    if (current?.import_state === 'complete') { await recordAddressDeliveries();continue; }
    const contentKey = `messages/${route.user_id}/${id}.json`;
    await saveContent(env.ATTACHMENTS,contentKey,{text:email.text,html:email.html});
    if (!current) {
      const ownSent=await env.DB.prepare("SELECT id FROM emails WHERE user_id=? AND direction='outbound' AND message_id=? LIMIT 1").bind(route.user_id,normalizeMessageId(email.message_id)).first<{id:string}>();
      await insertEmail(env.DB, { id, userId:route.user_id,direction:'inbound',from:sender.address,fromName:sender.name,
        to:email.headers?.to ?? '',cc:email.headers?.cc ?? email.cc?.join(', ') ?? null,subject:email.subject ?? '(no subject)',bodyText:email.text,bodyHtml:email.html,
        messageId:normalizeMessageId(email.message_id),inReplyTo:email.headers?.['in-reply-to'],references:email.headers?.references,
        domainId:route.domain_id,addressId:route.id,providerId,replyToEmailId:ownSent?.id,subjectMatch:false });
    }
    await recordAddressDeliveries();
    // 'pending' is written before attachments. A retry resumes the same recipient copy.
    await env.DB.prepare("UPDATE emails SET content_key=?,reply_to_addr=?,created_at=datetime(?),import_state='pending',status_detail='Some files are still downloading. Please check again shortly.' WHERE id=?")
      .bind(contentKey,email.reply_to?.join(', ') || email.headers?.['reply-to'] || null,email.created_at,id).run();
    const blocked = await env.DB.prepare('SELECT 1 FROM blocked_senders WHERE user_id=? AND address=?').bind(route.user_id,sender.address.toLowerCase()).first();
    if (shouldFileAsJunk(email,Boolean(blocked))) await env.DB.prepare("UPDATE emails SET spam_at=datetime('now'),spam_source='auto' WHERE id=? AND spam_source IS NULL").bind(id).run();
    await indexFullText(env.DB,route.user_id,id,email.text ?? email.html ?? '');
    try {
      await storeReceivedFiles(env, current?.provider_id ?? providerId, id);
      await env.DB.prepare("UPDATE emails SET import_state='complete',status_detail=NULL WHERE id=?").bind(id).run();
    } catch { incomplete = true; }
  }
  if (incomplete) throw new Error('Incoming files are temporarily unavailable');
  if (!uniqueUsers.length) await storeReceivedFiles(env,providerId);
  if (assignedUserId) await env.DB.prepare('UPDATE unassigned_mail SET assigned_user_id=? WHERE provider_id=?').bind(assignedUserId,providerId).run();
  // Preserve the original email separately, without exposing its private routing headers to recipients.
  if (email.raw?.download_url && !await env.ATTACHMENTS.head(`received/${providerId}/original.eml`)) {
    const fresh = await client.getReceivedEmail(providerId,'cid');
    if (fresh.raw?.download_url) {
      const response = await client.downloadResponse(fresh.raw.download_url);
      await storeResponse(env.ATTACHMENTS,`received/${providerId}/original.eml`,response,'message/rfc822');
    }
  }
}

export async function storeReceivedFiles(env: MailEnv, providerId: string, emailId?: string): Promise<void> {
  const client = createResendClient(env.RESEND_API_KEY);
  const manifestKey = `received/${providerId}/files.json`;
  const manifest = await env.ATTACHMENTS.get(manifestKey);
  let files = manifest ? await manifest.json<import('./resend').ReceivedAttachment[]>() : await client.listReceivedAttachments(providerId);
  if (!manifest) await env.ATTACHMENTS.put(manifestKey,JSON.stringify(files.map(({download_url,expires_at,...file}) => file)));
  let refreshed:import('./resend').ReceivedAttachment[]|undefined;
  let incomplete=false;
  for (const file of files) {
    const storageKey = `received/${providerId}/files/${file.id}`;
    const id = emailId ? 'file-' + await sha256Hex(emailId + ':' + file.id) : null;
    if (emailId) await env.DB.prepare(`INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64,storage_key,content_id,content_disposition,provider_attachment_id,download_state)
      VALUES (?,?,?,?,?,'',?,?,?,?, 'pending') ON CONFLICT(id) DO NOTHING`)
      .bind(id,emailId,file.filename || 'attachment',file.content_type || 'application/octet-stream',file.size ?? 0,storageKey,normalizeContentId(file.content_id),file.content_disposition === 'inline' ? 'inline' : 'attachment',file.id).run();
    try {
      let head = await env.ATTACHMENTS.head(storageKey);
      if (!head) {
      // Refresh signed URLs on every failed attempt, without discarding files already saved.
      if(!file.download_url && !refreshed)refreshed=await client.listReceivedAttachments(providerId);
      const url = file.download_url ?? refreshed?.find(f => f.id === file.id)?.download_url;
      if (!url) throw new Error('Attachment download is not yet available');
      const response = await client.downloadResponse(url);
      await storeResponse(env.ATTACHMENTS,storageKey,response,file.content_type);
        head = await env.ATTACHMENTS.head(storageKey);
      }
      if (id) await env.DB.prepare("UPDATE email_attachments SET download_state='ready',size_bytes=? WHERE id=?").bind(head?.size ?? file.size ?? 0,id).run();
    } catch {
      incomplete=true;
      if(id)await env.DB.prepare("UPDATE email_attachments SET download_state='pending' WHERE id=?").bind(id).run();
    }
  }
  if(incomplete)throw new Error('Some incoming files need another download attempt');
}
