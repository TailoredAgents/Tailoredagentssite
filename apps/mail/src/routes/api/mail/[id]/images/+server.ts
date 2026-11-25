import { json, type RequestHandler } from '@sveltejs/kit';
import { setSenderImageMode } from '$lib/server/message-security';

export const PUT: RequestHandler = async ({ platform, locals, params, request }) => {
  if (!platform?.env.DB || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  if (locals.authMethod !== 'session') return json({ error: 'Change image preferences in Mail.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !['automatic', 'allow', 'block'].includes(body.mode)) {
    return json({ error: 'Choose an image loading preference.' }, { status: 400 });
  }
  const changed = await setSenderImageMode(platform.env.DB, locals.user.id, params.id!, body.mode);
  return changed ? json({ ok: true }) : json({ error: 'Message not found' }, { status: 404 });
};
