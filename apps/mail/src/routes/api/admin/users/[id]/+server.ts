import { json, type RequestHandler } from '@sveltejs/kit';
import { setUserPassword } from '$lib/server/auth';
import { setDashboardAccess } from '$lib/server/dashboard-auth';
export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.user?.is_admin || !platform?.env.DB) return json({ error: 'Owner access required.' }, { status: 403 });
  const db = platform.env.DB;
  const body = await request.json();
  try {
    if (body.isAdmin !== undefined) throw new Error('This mail service has one owner.');
    if (typeof body.disabled === 'boolean') {
      if (params.id === locals.user.id) throw new Error('You cannot disable your own account.');
      await db.batch([
        db.prepare('UPDATE users SET disabled_at = ? WHERE id = ?').bind(body.disabled ? new Date().toISOString() : null, params.id!),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(params.id!)
      ]);
    } else if (typeof body.dashboardAccess === 'boolean') await setDashboardAccess(db, params.id!, body.dashboardAccess);
    else if (typeof body.password === 'string') await setUserPassword(db, params.id!, body.password);
    else throw new Error('Choose an account action.');
    return json({ ok: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Could not update account.' }, { status: 400 }); }
};
