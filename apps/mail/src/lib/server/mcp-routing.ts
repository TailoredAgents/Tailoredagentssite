import { readLimitedText } from './request-body';

export const protocolPaths = new Set([
  '/mcp', '/oauth/register', '/oauth/token', '/oauth/revoke',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'
]);

/** Configuration, never an arbitrary Host/forwarded header, defines the issuer. */
export function publicMailOrigin(env: { APP_URL?: string } | undefined, url: URL): string {
  const configured = env?.APP_URL;
  if (!configured && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('APP_URL must be configured for OAuth');
  }
  const canonical = new URL(configured || url.origin);
  if (canonical.username || canonical.password || canonical.pathname !== '/' || canonical.search || canonical.hash ||
      (canonical.protocol !== 'https:' && !(canonical.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(canonical.hostname)))) {
    throw new Error('Invalid public Mail URL');
  }
  return canonical.origin;
}

/** Before SvelteKit's form-CSRF filter: only credential-free OAuth protocol
 * POSTs are converted to JSON. Browser consent and all cookie routes retain CSRF. */
export async function normalizeOAuthForm(request: Request): Promise<Request> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || !['/oauth/token','/oauth/revoke'].includes(url.pathname) ||
      !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return request;
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return request; // reject cross-site browser forms
  const body = await readLimitedText(request.body, 64 * 1024);
  const params = new URLSearchParams(body);
  const values: Record<string,string> = {};
  for (const [key,value] of params) {
    if (key in values) throw new Error('Duplicate OAuth parameter');
    values[key] = value;
  }
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return new Request(request, { method: 'POST', headers, body: JSON.stringify(values) });
}
