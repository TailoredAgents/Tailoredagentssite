import { json, type RequestHandler } from '@sveltejs/kit';
import { setSenderPref } from '$lib/server/labels';

export const GET: RequestHandler = async ({ platform, locals }) => {
  if (!platform?.env.DB || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  const { results } = await platform.env.DB.prepare(`SELECT address FROM blocked_senders WHERE user_id=?
    UNION SELECT from_addr AS address FROM sender_prefs WHERE user_id=? AND disposition='spam' ORDER BY address`)
    .bind(locals.user.id, locals.user.id).all<{ address: string }>();
  return json({ addresses: results });
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env.DB || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const address = typeof body?.address === 'string' ? body.address.trim().toLowerCase() : '';
  if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return json({ error: 'Enter a valid email address.' }, { status: 400 });
  await setSenderPref(platform.env.DB, locals.user.id, address, 'spam');
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env.DB || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.address !== 'string' || body.address.length > 254) return json({ error: 'Choose a sender.' }, { status: 400 });
  const address = body.address.trim().toLowerCase();
  await platform.env.DB.batch([
    platform.env.DB.prepare('DELETE FROM blocked_senders WHERE user_id=? AND address=?').bind(locals.user.id, address),
    platform.env.DB.prepare("DELETE FROM sender_prefs WHERE user_id=? AND from_addr=? AND disposition='spam'").bind(locals.user.id, address)
  ]);
  return json({ ok: true });
};
