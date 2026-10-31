import { publicMailOrigin } from '$lib/server/mcp-routing';
import { json, type RequestHandler } from '@sveltejs/kit';
import { protectedResourceMetadata } from '$lib/server/oauth';

/** RFC 9728 — root document; `/mcp` is the only protected resource. */
export const GET: RequestHandler = ({ url, platform }) =>
	json(protectedResourceMetadata(publicMailOrigin(platform?.env,url)), {
		headers: { 'Cache-Control': 'public, max-age=3600' }
	});
