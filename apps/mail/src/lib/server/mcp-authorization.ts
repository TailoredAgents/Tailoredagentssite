import type { D1Database } from '@cloudflare/workers-types';
export type McpAuthorization = { familyId: string; resource: string };

/** Recovery may finish an already requested send after access-token rotation,
 * but not after disconnect, loss of send scope, account disablement or expiry. */
export async function requireMcpAuthorization(db: D1Database, userId: string, auth: McpAuthorization, scope: 'mail:send'|'mail:manage') {
  const row = await db.prepare(`SELECT g.scope FROM oauth_grants g
    JOIN oauth_families f ON f.id=g.family_id JOIN users u ON u.id=g.user_id
    WHERE g.family_id=? AND g.user_id=? AND g.resource=? AND g.revoked_at IS NULL
      AND f.revoked_at IS NULL AND u.disabled_at IS NULL AND u.must_change_password=0
      AND datetime(g.refresh_expires_at)>datetime('now')`)
    .bind(auth.familyId,userId,auth.resource).first<{scope:string}>();
  if (!row?.scope.split(' ').includes(scope)) throw new Error('Mailbox authorization expired or revoked');
}
