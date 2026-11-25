import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, insertTestUser } from './test-db';
import { testStorage } from '../../../tests/storage';
import { inboundJunkReason, messageSecurity, normalizeAuthentication } from '../mail/security';
import { readMessageSecurity, setSenderImageMode } from './message-security';
import { setSenderPref, rememberSenders } from './labels';
import { getEmailForUser, listThreadMessages, setEmailFlags } from './mail-store';

test('verification uses the provider DMARC verdict and never infers safety from SPF alone', () => {
  for (const authentication of [null, {}, { spf: 'pass', dkim: 'pass' }, { dmarc: 'gray' }, { dmarc: 'processing_failed' }]) {
    const decision = messageSecurity({ authentication });
    assert.equal(decision.verification, 'unknown');
    assert.equal(decision.automaticImages, false);
    assert.equal(inboundJunkReason(authentication, null), null);
  }
  assert.deepEqual(normalizeAuthentication({ dmarc: ' PASS ', spf: 'garbage' }), { spf: 'unknown', dkim: 'unknown', dmarc: 'pass' });
  assert.equal(messageSecurity({ authentication: { dmarc: 'pass' } }).automaticImages, true);
  assert.equal(messageSecurity({ authentication: { dmarc: 'fail' } }).verification, 'failed');
});

test('saved sender decisions govern junk; image permission never suppresses a failed-authentication warning', () => {
  assert.equal(inboundJunkReason({ dmarc: 'pass' }, 'spam'), 'sender');
  assert.equal(inboundJunkReason({ dmarc: 'fail' }, null), 'authentication');
  assert.equal(inboundJunkReason({ dmarc: 'fail' }, 'safe'), null);
  assert.equal(inboundJunkReason({ dmarc: 'pass' }, 'safe', true), 'sender');
  assert.equal(messageSecurity({ authentication: null, senderDisposition: 'safe' }).automaticImages, false);
  for (const input of [
    { authentication: { dmarc: 'fail' }, senderDisposition: 'safe' as const },
    { authentication: { dmarc: 'pass' }, spam: true },
    { authentication: { dmarc: 'pass' }, blocked: true }
  ]) assert.equal(messageSecurity({ ...input, imageMode: 'allow' }).automaticImages, false);
  assert.equal(messageSecurity({ authentication: null, imageMode: 'allow' }).automaticImages, true);
  assert.equal(messageSecurity({ authentication: { dmarc: 'pass' }, imageMode: 'block' }).automaticImages, false);
});

function fixture() {
  const { db, sqlite } = createTestDb();
  for (const user of ['alice', 'bob']) {
    insertTestUser(sqlite, user);
    sqlite.query(`INSERT INTO emails(id,user_id,direction,from_addr,to_addr,subject,thread_id,provider_id)
      VALUES (?,?,'inbound','sender@example.net',?,'A message',?,'provider-1')`)
      .run(user + '-message', user, user + '@example.com', user + '-message');
  }
  return { db, sqlite, ...testStorage() };
}

test('historical provider evidence is available without exposing source metadata or trusting forged headers', async () => {
  const f = fixture();
  await f.bucket.put('received/provider-1/source.json', JSON.stringify({
    headers: { 'authentication-results': 'dmarc=pass' }, bcc: ['private@example.com']
  }));
  assert.equal((await readMessageSecurity(f.db, f.bucket, 'alice', 'alice-message')).get('alice-message')!.verification, 'unknown');
  await f.bucket.put('received/provider-1/source.json', JSON.stringify({ authentication: { dmarc: 'pass' }, bcc: ['private@example.com'] }));
  const email = (await getEmailForUser(f.db, 'alice', 'alice-message'))!;
  const messages = await listThreadMessages(f.db, 'alice', email, f.bucket);
  assert.equal(messages[0].security!.verification, 'verified');
  assert.equal(messages[0].security!.automaticImages, true);
  assert.equal(JSON.stringify(messages).includes('private@example.com'), false);
  assert.equal((await readMessageSecurity(f.db, f.bucket, 'bob', 'alice-message')).size, 0);
});

test('image preferences persist for a sender only in the owning mailbox and can be reset', async () => {
  const f = fixture();
  assert.equal(await setSenderImageMode(f.db, 'bob', 'alice-message', 'allow'), false);
  assert.equal(await setSenderImageMode(f.db, 'alice', 'alice-message', 'allow'), true);
  const security = () => readMessageSecurity(f.db, f.bucket, 'alice', 'alice-message').then(rows => rows.get('alice-message')!);
  assert.equal((await security()).automaticImages, true);
  assert.equal((await readMessageSecurity(f.db, f.bucket, 'bob', 'bob-message')).get('bob-message')!.automaticImages, false);
  await setSenderImageMode(f.db, 'alice', 'alice-message', 'block');
  assert.equal((await security()).automaticImages, false);
  await setSenderImageMode(f.db, 'alice', 'alice-message', 'automatic');
  assert.equal((await security()).imageMode, 'automatic');
});

test('Not junk unifies the old block list with learned senders and preserves other accounts', async () => {
  const f = fixture();
  await setSenderPref(f.db, 'alice', 'Sender@Example.NET', 'spam');
  await setSenderPref(f.db, 'bob', 'sender@example.net', 'spam');
  await rememberSenders(f.db, 'alice', ['alice-message', 'bob-message'], 'safe');
  assert.equal(await f.db.prepare('SELECT 1 FROM blocked_senders WHERE user_id=?').bind('alice').first(), null);
  assert.ok(await f.db.prepare('SELECT 1 FROM blocked_senders WHERE user_id=?').bind('bob').first());
  const prefs = await f.db.prepare('SELECT user_id,disposition FROM sender_prefs ORDER BY user_id').all();
  assert.deepEqual(prefs.results, [{ user_id: 'alice', disposition: 'safe' }, { user_id: 'bob', disposition: 'spam' }]);
});

test('Not junk locks the individual decision against an in-flight automatic retry', async () => {
  const f = fixture();
  await setEmailFlags(f.db, 'alice', ['alice-message'], { spam: true, spamSource: 'auto' });
  await setEmailFlags(f.db, 'alice', ['alice-message'], { spam: false });
  // This is the conditional update used by the active receiving path.
  await f.db.prepare("UPDATE emails SET spam_at=datetime('now'),spam_source='auto' WHERE id=? AND spam_source IS NULL")
    .bind('alice-message').run();
  const row = await f.db.prepare('SELECT spam_at,spam_source FROM emails WHERE id=?').bind('alice-message').first();
  assert.deepEqual(row, { spam_at: null, spam_source: 'user' });
});
