import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../src/lib/server/test-db';
import { createUser, getAuthenticatedSession, login, setUserPassword } from '../src/lib/server/auth';
import { handleDashboardAuth, inspectDashboardGrant, setDashboardAccess } from '../src/lib/server/dashboard-auth';

const secret = 'local-test-bridge-secret-not-for-production-1234';
const password = 'Test-only-mail-password-2026';
async function fixture() {
  const { db, sqlite } = createTestDb();
  const user = await createUser(db, { email: 'jeffrey@example.test', name: 'Jeffrey', password, isAdmin: true });
  const call = (body: unknown, authorization = `Bearer ${secret}`) => handleDashboardAuth(new Request('https://mail.example.test/api/dashboard-auth', {
    method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body)
  }), db, secret);
  const signIn = () => call({ action: 'login', email: user.email, password, clientIp: '127.0.0.1' });
  return { db, sqlite, user, call, signIn };
}

test('dashboard login uses the existing mail password and issues no inbox credential', async () => {
  const f = await fixture();
  const result = await f.signIn();
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.user.id, f.user.id);
  assert.equal(data.user.isAdmin, true);
  assert.equal(JSON.stringify(data).includes('password'), false);
  assert.equal(await getAuthenticatedSession(f.db, data.token), null);
  assert.equal((await f.call({ action: 'inspect', token: data.token })).status, 200);
  assert.equal((await f.call({ action: 'inspect', token: data.token }, '')).status, 401);
  assert.match(result.headers.get('cache-control')!, /no-store/);
});

test('unapproved, temporary-password, disabled and incorrect-password logins are denied', async () => {
  const f = await fixture();
  assert.equal((await f.call({ action: 'login', email: f.user.email, password: 'incorrect' })).status, 401);
  const teammate = await createUser(f.db, { email: 'teammate@example.test', name: 'Teammate', password });
  assert.equal((await f.call({ action: 'login', email: teammate.email, password })).status, 403);
  await setDashboardAccess(f.db, teammate.id, true);
  assert.equal((await f.call({ action: 'login', email: teammate.email, password })).status, 200);
  await f.db.prepare('UPDATE users SET must_change_password=1 WHERE id=?').bind(teammate.id).run();
  assert.equal((await (await f.call({ action: 'login', email: teammate.email, password })).json()).error, 'password_change_required');
  await f.db.prepare("UPDATE users SET disabled_at=datetime('now') WHERE id=?").bind(f.user.id).run();
  assert.equal((await f.signIn()).status, 401);
});

test('password reset invalidates dashboard sessions and cannot be reversed by completing setup', async () => {
  const f = await fixture();
  const data = await (await f.signIn()).json();
  await setUserPassword(f.db, f.user.id, 'Temporary-reset-password-2026');
  assert.equal(await inspectDashboardGrant(f.db, data.token), null);
  await f.db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').bind(f.user.id).run();
  assert.equal(await inspectDashboardGrant(f.db, data.token), null);
});

test('removing approval ends dashboard access while preserving an inbox session', async () => {
  const f = await fixture();
  const teammate = await createUser(f.db, { email: 'teammate@example.test', name: 'Teammate', password });
  await setDashboardAccess(f.db, teammate.id, true);
  const inbox = await login(f.db, teammate.email, password);
  const data = await (await f.call({ action: 'login', email: teammate.email, password })).json();
  await setDashboardAccess(f.db, teammate.id, false);
  assert.equal(await inspectDashboardGrant(f.db, data.token), null);
  assert.ok(await getAuthenticatedSession(f.db, inbox!.token));
  await setDashboardAccess(f.db, teammate.id, true);
  assert.equal(await inspectDashboardGrant(f.db, data.token), null);
  await assert.rejects(setDashboardAccess(f.db, f.user.id, false), /owner/);
});

test('disabling an account, expiry, and dashboard sign-out all revoke access', async () => {
  const f = await fixture();
  const data = await (await f.signIn()).json();
  await f.db.batch([
    f.db.prepare("UPDATE users SET disabled_at=datetime('now') WHERE id=?").bind(f.user.id),
    f.db.prepare('DELETE FROM sessions WHERE user_id=?').bind(f.user.id)
  ]);
  await f.db.prepare('UPDATE users SET disabled_at=NULL WHERE id=?').bind(f.user.id).run();
  assert.equal(await inspectDashboardGrant(f.db, data.token), null);
  const second = await (await f.signIn()).json();
  await f.db.prepare("UPDATE sessions SET expires_at=datetime('now','-1 minute') WHERE user_id=?").bind(f.user.id).run();
  assert.equal(await inspectDashboardGrant(f.db, second.token), null);
  const third = await (await f.signIn()).json();
  assert.equal((await f.call({ action: 'revoke', token: third.token })).status, 200);
  assert.equal(await inspectDashboardGrant(f.db, third.token), null);
});

test('a reset racing password verification cannot create a surviving dashboard session', async () => {
  const f = await fixture();
  const original = f.db.batch.bind(f.db);
  f.db.batch = async statements => {
    await f.db.prepare('UPDATE users SET must_change_password=1 WHERE id=?').bind(f.user.id).run();
    return original(statements);
  };
  assert.equal((await f.signIn()).status, 401);
  assert.equal((await f.db.prepare('SELECT count(*) AS n FROM dashboard_login_grants').first<{ n: number }>())!.n, 0);
});

test('the bridge bounds bodies and shares the mail account login limit', async () => {
  const f = await fixture();
  assert.equal((await f.call({ padding: 'x'.repeat(5000) })).status, 413);
  assert.equal((await f.call({ action: 'login', email: f.user.email, password }, 'Bearer incorrect')).status, 401);
  for (let i = 0; i < 10; i++) assert.equal((await f.call({ action: 'login', email: f.user.email, password: 'wrong' })).status, 401);
  assert.equal((await f.signIn()).status, 429);
});
