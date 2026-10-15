import type { D1Database } from '@cloudflare/workers-types';
const like = (s: string) => '%' + s.replaceAll('\\','\\\\').replaceAll('%','\\%').replaceAll('_','\\_') + '%';
/** All clauses are used inside the mailbox's mandatory owner filter. */
export function searchClauses(query: string): {filters: string[]; bindings: string[]} {
  const filters: string[] = [], bindings: string[] = [];
  for (const token of query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []) {
    const [key,...rest] = token.split(':'); const value = rest.join(':').replace(/^"|"$/g,'');
    if (['from','to','subject'].includes(key) && value) {
      const columns = key==='from' ? ['e.from_addr','e.from_name'] : key==='to' ? ['e.to_addr','e.cc_addr','e.bcc_addr'] : ['e.subject'];
      filters.push('(' + columns.map(c => `${c} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');bindings.push(...columns.map(() => like(value)));
    } else if (['before','after'].includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      filters.push(`date(e.created_at) ${key==='before'?'<':'>='} date(?)`);bindings.push(value);
    } else if (key==='has' && value==='attachment') {
      filters.push('(EXISTS(SELECT 1 FROM email_attachments a WHERE a.email_id=e.id) OR EXISTS(SELECT 1 FROM draft_files f WHERE f.draft_id=e.id AND f.user_id=e.user_id))');
    } else {
      const term=like(token.replace(/^"|"$/g,''));
      filters.push(`(e.subject LIKE ? ESCAPE '\\' OR e.from_addr LIKE ? ESCAPE '\\' OR e.to_addr LIKE ? ESCAPE '\\' OR e.body_text LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM message_search s WHERE s.email_id=e.id AND s.user_id=e.user_id AND s.body LIKE ? ESCAPE '\\'))`);
      bindings.push(term,term,term,term,term);
    }
  }
  return {filters,bindings};
}
export async function indexFullText(db: D1Database,userId: string,emailId: string,text: string): Promise<void> {
  const statements = [db.prepare('DELETE FROM message_search WHERE email_id=? AND user_id=?').bind(emailId,userId)];
  // Overlap permits searches crossing a chunk boundary; each binding stays below D1's value limit.
  for(let i=0;i<text.length;i+=16000) statements.push(db.prepare('INSERT INTO message_search(user_id,email_id,body) VALUES (?,?,?)').bind(userId,emailId,text.slice(Math.max(0,i-256),i+16000)));
  for(let i=0;i<statements.length;i+=25) await db.batch(statements.slice(i,i+25));
}
