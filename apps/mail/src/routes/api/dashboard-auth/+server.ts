import type { RequestHandler } from './$types';
import { handleDashboardAuth } from '$lib/server/dashboard-auth';

export const POST: RequestHandler = async ({ request, platform }) => {
  if (!platform?.env.DB) return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    return await handleDashboardAuth(request, platform.env.DB, platform.env.DASHBOARD_AUTH_SECRET);
  } catch {
    console.error(JSON.stringify({ event: 'dashboard_identity_unavailable' }));
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};
