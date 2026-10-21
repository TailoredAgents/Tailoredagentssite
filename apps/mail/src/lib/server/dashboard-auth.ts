import type { D1Database } from '@cloudflare/workers-types';
import { timingSafeEqual } from 'node:crypto';
import { checkRateLimit, getUserByEmail } from './auth';
import { createSessionToken, hashToken, verifyPassword } from './crypto';
import { BodyLimitError, readLimitedText } from './request-body';

const LIFETIME_SECONDS = 60 * 60 * 24 * 14;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
type Identity = { id: string; email: string; name: string; is_admin: number; expires_at: string };

export async function inspectDashboardGrant(db: D1Database, token: string) {
  return db.prepare(`SELECT u.id, u.email, u.name, u.is_admin, s.expires_at
    FROM dashboard_login_grants g JOIN sessions s ON s.id=g.session_id
    JOIN users u ON u.id=s.user_id
    WHERE g.token_hash=? AND u.disabled_at IS NULL AND u.must_change_password=0
      AND u.dashboard_access=1 AND datetime(s.expires_at)>datetime('now')`)
    .bind(await hashToken(token)).first<Identity>();
}

function identityResponse(row: Identity) {
  return { user: { id: row.id, email: row.email, name: row.name, isAdmin: row.is_admin === 1 }, expiresAt: row.expires_at };
}

/** Private server-to-server interface. It grants identity access, never mail access. */
export async function handleDashboardAuth(request: Request, db: D1Database, secret: string | undefined) {
  if (!secret || secret.length < 32) return reply({ error: 'unavailable' }, 503);
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  const supplied = new TextEncoder().encode(request.headers.get('authorization') ?? '');
  if (supplied.byteLength !== expected.byteLength || !timingSafeEqual(supplied, expected)) return reply({ error: 'unauthorized' }, 401);
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await readLimitedText(request.body, 4096));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ error: 'invalid_request' }, 400);
    body = parsed as Record<string, unknown>;
  } catch (error) { return reply({ error: 'invalid_request' }, error instanceof BodyLimitError ? 413 : 400); }
  if (body.action === 'login') {
    if (typeof body.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 128 || !body.password.length) return reply({ error: 'invalid_credentials' }, 401);
    const email = body.email.trim().toLowerCase();
    const clientIp = typeof body.clientIp === 'string' ? body.clientIp.slice(0, 128) : 'unknown';
    const limits = await Promise.all([
      checkRateLimit(db, 'login-account:' + await hashToken(email), 10, 900),
      checkRateLimit(db, 'dashboard-login-ip:' + await hashToken(clientIp), 30, 900)
    ]);
    if (limits.some(allowed => !allowed)) return reply({ error: 'rate_limited' }, 429);
    const user = await getUserByEmail(db, email);
    if (!user || user.disabled_at || !await verifyPassword(body.password, user.password_hash)) return reply({ error: 'invalid_credentials' }, 401);
    if (user.must_change_password) return reply({ error: 'password_change_required' }, 403);
    if (!user.dashboard_access) return reply({ error: 'dashboard_not_approved' }, 403);
    const token = createSessionToken().replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''), sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + LIFETIME_SECONDS * 1000).toISOString();
    const tokenHash = await hashToken(token);
    // The unrelated mail-session token is discarded. A dashboard grant can
    // never authenticate to the inbox, even if the website database is leaked.
    const mailTokenHash = await hashToken(createSessionToken());
    const results = await db.batch([
      db.prepare(`INSERT INTO sessions(id,user_id,token_hash,expires_at,device_name)
        SELECT ?,id,?,?, 'Website dashboard' FROM users
        WHERE id=? AND password_hash=? AND disabled_at IS NULL AND must_change_password=0 AND dashboard_access=1`)
        .bind(sessionId, mailTokenHash, expiresAt, user.id, user.password_hash),
      db.prepare(`INSERT INTO dashboard_login_grants(token_hash,session_id)
        SELECT ?,id FROM sessions WHERE id=?`).bind(tokenHash, sessionId)
    ]);
    if (results[1].meta.changes !== 1) return reply({ error: 'invalid_credentials' }, 401);
    const current = await inspectDashboardGrant(db, token);
    if (!current) return reply({ error: 'invalid_credentials' }, 401);
    return reply({ ...identityResponse(current), token });
  }
  if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(body.token)) return reply({ error: 'invalid_request' }, 400);
  if (body.action === 'inspect') {
    const current = await inspectDashboardGrant(db, body.token);
    return current ? reply(identityResponse(current)) : reply({ error: 'session_expired' }, 401);
  }
  if (body.action === 'revoke') {
    await db.prepare('DELETE FROM sessions WHERE id IN (SELECT session_id FROM dashboard_login_grants WHERE token_hash=?)').bind(await hashToken(body.token)).run();
    return reply({ ok: true });
  }
  return reply({ error: 'invalid_request' }, 400);
}

export async function setDashboardAccess(db: D1Database, userId: string, approved: boolean) {
  const user = await db.prepare('SELECT is_admin FROM users WHERE id=?').bind(userId).first<{ is_admin: number }>();
  if (!user) throw new Error('Account not found.');
  if (user.is_admin && !approved) throw new Error('The owner keeps dashboard access.');
  await db.batch([
    db.prepare('UPDATE users SET dashboard_access=? WHERE id=?').bind(approved ? 1 : 0, userId),
    db.prepare(`DELETE FROM sessions WHERE user_id=? AND id IN (SELECT session_id FROM dashboard_login_grants)`).bind(userId)
  ]);
}
