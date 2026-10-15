import type { MailEnv } from './receive';
import { deleteEmailsPermanently } from './mail-store';
export async function purgeExpiredMail(env: MailEnv): Promise<void> {
  const expired = await env.DB.prepare("SELECT id,user_id FROM emails WHERE deleted_at<datetime('now','-30 days') AND NOT EXISTS(SELECT 1 FROM send_attempts a WHERE a.email_id=emails.id AND a.status='sending') LIMIT 100").all<{id:string;user_id:string}>();
  for (const row of expired.results) await deleteEmailsPermanently(env.DB,env.ATTACHMENTS,row.user_id,[row.id]);
  const objects = await env.DB.prepare("SELECT storage_key FROM retained_objects WHERE purge_after<datetime('now') LIMIT 100").all<{storage_key:string}>();
  for (const row of objects.results) {
    const receivedId=row.storage_key.startsWith('received/')?row.storage_key.split('/')[1]:null;
    if(receivedId){
      const live=await env.DB.prepare("SELECT id FROM emails WHERE provider_id=? UNION SELECT provider_id FROM unassigned_mail WHERE provider_id=? AND assigned_user_id IS NULL LIMIT 1").bind(receivedId,receivedId).first();
      if(live)continue;
    }
    const referenced = await env.DB.prepare('SELECT id FROM email_attachments WHERE storage_key=? UNION SELECT id FROM emails WHERE content_key=? UNION SELECT id FROM draft_files WHERE storage_key=? UNION SELECT id FROM signature_banners WHERE storage_key=? LIMIT 1').bind(row.storage_key,row.storage_key,row.storage_key,row.storage_key).first();
    if (!referenced) await env.ATTACHMENTS.delete(row.storage_key);
    await env.DB.prepare('DELETE FROM retained_objects WHERE storage_key=?').bind(row.storage_key).run();
  }
}
