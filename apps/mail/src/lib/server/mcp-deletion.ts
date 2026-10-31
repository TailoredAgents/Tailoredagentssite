import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
import {requireMcpAuthorization} from './mcp-authorization';
import {deleteEmailsPermanently} from './mail-store';

export async function loadDeletionRequest(db:D1Database,userId:string,id:string) {
 return db.prepare(`SELECT r.id,r.email_id,r.family_id,r.resource,e.from_addr,e.subject
 FROM mcp_delete_requests r JOIN emails e ON e.id=r.email_id AND e.user_id=r.user_id
 WHERE r.id=? AND r.user_id=? AND r.consumed_at IS NULL
 AND datetime(r.expires_at)>datetime('now') AND e.deleted_at IS NOT NULL`)
 .bind(id,userId).first<{id:string;email_id:string;family_id:string;resource:string;from_addr:string;subject:string}>();
}
/** Invoked ONLY by the session + same-origin protected human confirmation form. */
export async function confirmDeletion(db:D1Database,bucket:R2Bucket|undefined,userId:string,id:string) {
 const request=await loadDeletionRequest(db,userId,id);
 if(!request) throw new Error('Confirmation unavailable');
 await requireMcpAuthorization(db,userId,{familyId:request.family_id,resource:request.resource},'mail:manage');
 const claimed=await db.prepare(`UPDATE mcp_delete_requests SET consumed_at=datetime('now') WHERE id=? AND user_id=? AND consumed_at IS NULL AND datetime(expires_at)>datetime('now') RETURNING id`).bind(id,userId).first();
 if(!claimed) throw new Error('Confirmation already used');
 const trashed=await db.prepare('SELECT id FROM emails WHERE id=? AND user_id=? AND deleted_at IS NOT NULL').bind(request.email_id,userId).first();
 if(!trashed) throw new Error('Message is no longer in Trash');
 return deleteEmailsPermanently(db,bucket,userId,[request.email_id]);
}
