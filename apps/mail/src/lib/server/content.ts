import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import sanitize from 'sanitize-html';

export function cleanComposedHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ['p','div','span','br','strong','b','em','i','u','s','ul','ol','li','blockquote','a','img','table','tbody','tr','td','th','h1','h2','h3','hr'],
    allowedAttributes: { a: ['href','title'], img: ['src','alt','width','height'], '*': ['style'] },
    allowedSchemes: ['https','http','mailto','cid'], allowedSchemesByTag: { img: ['https','http','cid','data'] },
    allowedStyles: { '*': { color: [/^#[0-9a-f]{3,8}$/i], 'text-align': [/^(left|right|center)$/], 'font-weight': [/^(bold|[1-9]00)$/] } },
    allowProtocolRelative: false
  });
}
export type StoredContent = { text: string | null; html: string | null };
export async function saveContent(bucket: R2Bucket, key: string, content: StoredContent): Promise<void> {
  await bucket.put(key, JSON.stringify(content), { httpMetadata: { contentType: 'application/json' } });
}
export async function hydrateContent<T extends { body_text: string | null; body_html: string | null; content_key?: string | null }>(bucket: R2Bucket | undefined, row: T): Promise<T> {
  if (!bucket || !row.content_key) return row;
  const file = await bucket.get(row.content_key);
  if (!file) throw new Error('The complete message is temporarily unavailable. Please try again.');
  const body = await file.json<StoredContent>();
  return { ...row, body_text: body.text, body_html: body.html };
}
export async function retainObject(db: D1Database, key: string): Promise<void> {
  await db.prepare("INSERT INTO retained_objects(storage_key,purge_after) VALUES (?,datetime('now','+32 days')) ON CONFLICT(storage_key) DO UPDATE SET purge_after=excluded.purge_after").bind(key).run();
}
