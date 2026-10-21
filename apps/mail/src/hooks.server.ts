import {readLimitedText,BodyLimitError} from '$lib/server/request-body';
import {MAX_SIGNATURE_REQUEST_BYTES} from '$lib/email-signature';
import { redirect, type Handle } from '@sveltejs/kit';
import { countUsers, getAuthenticatedSession, readSessionToken } from '$lib/server/auth';
import { listAddressesForUser, listDomains } from '$lib/server/domains';
import { safeNextPath } from '$lib/next-url';

const disabled = ['/api/v1', '/mcp', '/oauth', '/.well-known', '/install.sh', '/api/apikeys', '/api/oauth', '/api/auth/pair', '/api/auth/pair-codes', '/api/auth/session', '/api/auth/switch', '/api/settings/ai', '/api/admin/ai', '/api/settings/classify', '/settings/ai', '/settings/connections', '/settings/notifications', '/api/push', '/api/notifications', '/onboarding'];
const error = (message: string, status: number) => Response.json({ error: message }, { status });
export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (disabled.some(p => pathname === p || pathname.startsWith(p + '/')) || pathname.endsWith('/draft-reply')) return error('Not found', 404);
  // These exact private endpoints authenticate the website server themselves.
  // Each validates its distinct service secret and bounds the request body.
  if (pathname === '/api/dashboard-auth' || pathname === '/api/crm-mail') return resolve(event);
  const webhook = pathname === '/api/webhooks/resend';
  if (!webhook && !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    if (event.request.headers.get('origin') !== event.url.origin) return error('Please use this site to make changes.', 403);
  }
  const db = event.platform?.env.DB;
  const session = db ? await getAuthenticatedSession(db, readSessionToken(event.cookies)) : null;
  Object.assign(event.locals, { user: session?.user ?? null, authMethod: session ? 'session' : null,
    apiScopes: [], apiTokenId: null, currentSessionId: session?.sessionId ?? null,
    accounts: [], domains: [], addresses: [], activeDomainId: null, uiTheme: 'zero', locale: 'en' });
  if (webhook) return resolve(event);
  const setup = pathname === '/setup' || pathname === '/api/setup';
  const publicPath = setup || pathname === '/login' || pathname === '/api/auth/login';
  if (!publicPath && !session) {
    if (pathname.startsWith('/api/')) return error('Please sign in.', 401);
    if (db && await countUsers(db) === 0) throw redirect(303, '/setup');
    throw redirect(303, `/login?next=${encodeURIComponent(safeNextPath(pathname) ?? '/inbox')}`);
  }
  if (setup && db && await countUsers(db) > 0) {
    if (pathname.startsWith('/api/')) return error('Setup is closed.', 403);
    throw redirect(303, session ? '/inbox' : '/login');
  }
  if (session?.user.must_change_password && !['/account/setup', '/api/auth/complete-setup', '/api/auth/login'].includes(pathname)) {
    if (pathname.startsWith('/api/')) return error('Change your temporary password first.', 403);
    throw redirect(303, '/account/setup');
  }
  if (session && !session.user.must_change_password) {
    [event.locals.domains, event.locals.addresses] = await Promise.all([listDomains(db!), listAddressesForUser(db!, session.user.id)]);
    if (pathname === '/login') throw redirect(303, '/inbox');
  }
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && !session?.user.is_admin) return error('Owner access required.', 403);
  if ((pathname.startsWith('/api/addresses') || pathname.startsWith('/api/domains')) && event.request.method !== 'GET' && !session?.user.is_admin) return error('Only the owner can manage email addresses.', 403);
  if (!['GET','HEAD','OPTIONS'].includes(event.request.method)) {
    const signatureUpload = pathname === '/api/settings/signature';
    const limit = signatureUpload ? MAX_SIGNATURE_REQUEST_BYTES : pathname.startsWith('/api/mail') || pathname.startsWith('/api/drafts') ? 30*1024*1024 : 64*1024;
    try {
      // Reject known oversized uploads before opening their stream. Still count
      // actual bytes below for missing or inaccurate Content-Length headers.
      if(Number(event.request.headers.get('Content-Length'))>limit)throw new BodyLimitError('Request too large');
      const body=await readLimitedText(event.request.body,limit);
      event.request=new Request(event.request,{body});
    }catch(cause){if(cause instanceof BodyLimitError)return error(signatureUpload ? 'Choose a banner no larger than 1 MB.' : 'This message is too large. Attachments may total up to 20 MB.',413);throw cause;}
  }
  const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('<html lang="en">', '<html lang="en" data-ui-theme="zero">') });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
};

export const handleError: import('@sveltejs/kit').HandleServerError = ({status}) => { console.error(JSON.stringify({event:'request_failed',status})); return {message:'Something could not be loaded. Please try again or contact the owner.'}; };
