import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { messageSecurity, type MessageSecurity, type SenderImageMode } from '$lib/mail/security';

type SecurityRow = {
  id: string; provider_id: string | null; authentication_json: string | null;
  junk_reason: string | null; spam_at: string | null; spam_source: string | null;
  sender_disposition: 'safe' | 'spam' | null; blocked: string | null; image_mode: SenderImageMode | null;
};

/** One scoped query for a thread; no raw provider payload reaches the browser. */
export async function readMessageSecurity(db: D1Database, bucket: R2Bucket | undefined, userId: string, threadId: string): Promise<Map<string, MessageSecurity>> {
  const { results } = await db.prepare(`SELECT e.id,e.provider_id,e.authentication_json,e.junk_reason,e.spam_at,e.spam_source,
    p.disposition AS sender_disposition,b.address AS blocked,i.mode AS image_mode
    FROM emails e
    LEFT JOIN sender_prefs p ON p.user_id=e.user_id AND p.from_addr=lower(trim(e.from_addr))
    LEFT JOIN blocked_senders b ON b.user_id=e.user_id AND b.address=lower(trim(e.from_addr))
    LEFT JOIN sender_image_preferences i ON i.user_id=e.user_id AND i.from_addr=lower(trim(e.from_addr))
    WHERE e.user_id=? AND COALESCE(e.thread_id,e.id)=? AND e.direction='inbound'`)
    .bind(userId, threadId).all<SecurityRow>();
  const entries = await Promise.all(results.map(async row => {
    let authentication: unknown = null;
    try {
      if (row.authentication_json) authentication = JSON.parse(row.authentication_json);
      else if (bucket && row.provider_id && /^[a-zA-Z0-9_-]{1,150}$/.test(row.provider_id)) {
        // Old mail already has the provider response in private storage. Missing
        // historical evidence stays unknown; never infer it from message headers.
        const source = await bucket.get(`received/${row.provider_id}/source.json`);
        if (source) authentication = (await source.json<{ authentication?: unknown }>()).authentication;
      }
    } catch { /* An unavailable historical result must not prevent reading mail. */ }
    return [row.id, messageSecurity({ authentication, senderDisposition: row.sender_disposition,
      blocked: Boolean(row.blocked), spam: Boolean(row.spam_at), spamSource: row.spam_source,
      junkReason: row.junk_reason, imageMode: row.image_mode ?? 'automatic' })] as const;
  }));
  return new Map(entries);
}

export async function setSenderImageMode(db: D1Database, userId: string, messageId: string, mode: SenderImageMode): Promise<boolean> {
  const sender = await db.prepare("SELECT from_addr FROM emails WHERE id=? AND user_id=? AND direction='inbound'")
    .bind(messageId, userId).first<{ from_addr: string }>();
  if (!sender) return false;
  const address = sender.from_addr.trim().toLowerCase();
  await db.batch([
    mode === 'automatic'
      ? db.prepare('DELETE FROM sender_image_preferences WHERE user_id=? AND from_addr=?').bind(userId, address)
      : db.prepare(`INSERT INTO sender_image_preferences(user_id,from_addr,mode) VALUES (?,?,?)
        ON CONFLICT(user_id,from_addr) DO UPDATE SET mode=excluded.mode`).bind(userId, address, mode),
    db.prepare('UPDATE users SET mailbox_epoch=COALESCE(mailbox_epoch,0)+1 WHERE id=?').bind(userId)
  ]);
  return true;
}
