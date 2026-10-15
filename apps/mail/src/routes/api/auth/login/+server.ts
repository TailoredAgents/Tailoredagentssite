import { json, type RequestHandler } from '@sveltejs/kit';
import { checkRateLimit, login, logout, readSessionToken, sessionCookieOptions, SESSION_COOKIE } from '$lib/server/auth';
import { hashToken } from '$lib/server/crypto';
import { SESSION_DAYS } from '$lib/server/constants';
export const POST: RequestHandler = async ({ request, cookies, platform, url }) => {
  const db = platform?.env.DB;
  if (!db) return json({error:'Mail is not configured yet.'},{status:503});
  const body = await request.json();
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.email.length>254 || body.password.length>128) return json({error:'Enter your email and password.'},{status:400});
  const email = body.email.toLowerCase().trim();
  const [byIp,byAccount] = await Promise.all([
    checkRateLimit(db,'login-ip:'+await hashToken(request.headers.get('cf-connecting-ip') ?? 'local'),30,900),
    checkRateLimit(db,'login-account:'+await hashToken(email),10,900)
  ]);
  if (!byIp || !byAccount) return json({error:'Too many attempts. Try again in 15 minutes.'},{status:429});
  const result = await login(db,email,body.password);
  if (!result) return json({error:'Incorrect email or password.'},{status:401});
  const previous = readSessionToken(cookies); if (previous) await logout(db,previous);
  cookies.set(SESSION_COOKIE,result.token,sessionCookieOptions(SESSION_DAYS*86400,url));
  return json({user:result.user});
};
export const DELETE: RequestHandler = async ({cookies,platform}) => {
  const token = readSessionToken(cookies);
  if (token && platform?.env.DB) await logout(platform.env.DB,token);
  cookies.delete(SESSION_COOKIE,{path:'/'}); cookies.delete('mail_accounts',{path:'/'});
  return json({ok:true,next:'/login'});
};
