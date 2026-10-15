import { json, type RequestHandler } from '@sveltejs/kit';
import { getSignatureBanner } from '$lib/server/email-signature';
import { MAX_SIGNATURE_BANNER_BYTES } from '$lib/email-signature';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const db = platform?.env.DB, bucket = platform?.env.ATTACHMENTS;
	if (!db || !bucket || !locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const banner = await getSignatureBanner(db,locals.user.id);
	if (!banner || banner.id !== params.id) return json({ error: 'Banner not found.' }, { status: 404 });
	const file = await bucket.get(banner.storage_key);
	if (!file || file.size > MAX_SIGNATURE_BANNER_BYTES || file.size !== banner.size_bytes) return json({ error: 'Your banner is temporarily unavailable.' }, { status: 503 });
	return new Response(await file.arrayBuffer(), { headers: {
		'Content-Type': banner.content_type,
		'Content-Length': String(file.size),
		'Content-Disposition': `inline; filename="${banner.filename}"`,
		'Cache-Control': 'private, no-store',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'; sandbox"
	} });
};
