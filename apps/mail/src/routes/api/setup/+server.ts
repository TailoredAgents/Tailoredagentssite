import { json, type RequestHandler } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { countUsers, login, sessionCookieOptions, SESSION_COOKIE, checkRateLimit } from '$lib/server/auth';
import { hashPassword, validatePassword } from '$lib/server/password';
import { getEmailProvider } from '$lib/server/context';
import { upsertDomain } from '$lib/server/domains';
import { SESSION_DAYS } from '$lib/server/constants';

export const GET: RequestHandler = async ({ platform }) => json({ needsSetup: platform?.env.DB ? await countUsers(platform.env.DB) === 0 : false });
export const POST: RequestHandler = async ({ request, platform, cookies, url }) => {
  const env = platform?.env;
  if (!env?.DB || !env.SETUP_SECRET || env.SETUP_SECRET.length < 32) return json({ error: 'The owner setup key has not been configured.' }, { status: 503 });
  if (await countUsers(env.DB) > 0) return json({ error: 'Setup is closed.' }, { status: 403 });
  if (!await checkRateLimit(env.DB, 'owner-setup', 10, 900)) return json({ error: 'Please wait 15 minutes before trying again.' }, { status: 429 });
  const body = await request.json();
  const supplied = Buffer.from(typeof body.secret === 'string' ? body.secret : '');
  const expected = Buffer.from(env.SETUP_SECRET);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json({ error: 'The setup key is incorrect.' }, { status: 403 });
  try {
    validatePassword(body.password);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 128) throw new Error('Enter your name.');
    if (typeof body.localPart !== 'string' || !/^[a-z0-9][a-z0-9._+-]{0,63}$/i.test(body.localPart)) throw new Error('Enter the part of your email address before @.');
    const provider = getEmailProvider(platform);
    const domains = await provider.listDomains();
    const selected = domains.find(d => d.name.toLowerCase() === env.MAIL_DOMAIN);
    if (!selected) throw new Error('Add the mail domain to Resend before completing setup.');
    const domain = await upsertDomain(env.DB, await provider.getDomain(selected.id));
    const address = `${body.localPart.toLowerCase()}@${env.MAIL_DOMAIN}`;
    const id = crypto.randomUUID();
    const hash = await hashPassword(body.password);
    // The unique setup marker and all owner records commit together, even with concurrent requests.
    await env.DB.batch([
      env.DB.prepare("INSERT INTO app_state(key, value) VALUES ('setup_completed', ?)").bind(id),
      env.DB.prepare('INSERT INTO users(id,email,name,password_hash,is_admin) VALUES (?,?,?,?,1)').bind(id,address,body.name.trim(),hash),
      env.DB.prepare('INSERT INTO addresses(id,user_id,domain_id,address,is_default) VALUES (?,?,?,?,1)').bind(crypto.randomUUID(),id,domain.id,address),
      env.DB.prepare('UPDATE domains SET catchall_user_id = NULL WHERE id = ?').bind(domain.id)
    ]);
    const session = await login(env.DB, address, body.password);
    if (session) cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(SESSION_DAYS * 86400, url));
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error && !error.message.includes('SQL') ? error.message : 'Setup could not finish. Reload to check its status.' }, { status: 400 });
  }
};
