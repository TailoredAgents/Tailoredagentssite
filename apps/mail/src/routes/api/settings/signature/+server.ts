import { json, type RequestHandler } from '@sveltejs/kit';
import { getEmailSignature, getSignatureBanner, publicSignatureBanner, saveEmailSignature, SignatureInputError } from '$lib/server/email-signature';

export const GET: RequestHandler = async ({ locals, platform }) => {
 const db = platform?.env.DB;
 if (!db || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
 const [signature, banner] = await Promise.all([getEmailSignature(db,locals.user.id),getSignatureBanner(db,locals.user.id)]);
 return json({ signature, banner: publicSignatureBanner(banner) }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
 const db = platform?.env.DB, bucket = platform?.env.ATTACHMENTS;
 if (!db || !bucket || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
 let body: unknown;
 try { body = await request.json(); }
 catch { return json({ error: 'Invalid request' }, { status: 400 }); }
 try {
  return json({ ok: true, ...await saveEmailSignature(db,bucket,locals.user.id,body) }, { headers: { 'Cache-Control': 'no-store' } });
 } catch (error) {
  if (error instanceof SignatureInputError) return json({ error: error.message }, { status: 400 });
  console.error(JSON.stringify({ event: 'signature_save_failed' }));
  return json({ error: 'Your signature could not be saved. Please try again.' }, { status: 503 });
 }
};
