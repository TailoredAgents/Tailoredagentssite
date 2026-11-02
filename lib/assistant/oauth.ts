import 'server-only';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {DashboardContext} from '@/lib/dashboard/data';
import {isAllowedDashboardEmail,resolveDashboardConfiguration} from '@/lib/dashboard/config';
import {verifyMailDashboardSession} from '@/lib/dashboard/mail-identity';
import {AssistantError,assistantOrigin,parseScopes,resourceUri,validRedirect,type AssistantScope} from './config';

export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const invalid=()=>new AssistantError('invalid_grant','This connection expired or changed. Connect again.',401);
export type Principal={context:DashboardContext;grantId:string;clientId:string;sessionId:string;scopes:AssistantScope[];writesPaused:boolean;expiresAt:Date};
type Grant={id:string;client_id:string;user_id:string;workspace_id:string;session_id:string|null;scopes:AssistantScope[];resource:string;expires_at:Date;revoked_at:Date|null;writes_paused:boolean};
export async function principal(grant:Grant,db:Pick<PoolClient,'query'>=getDatabasePool()):Promise<Principal>{
 if(grant.revoked_at||!grant.session_id||grant.expires_at.getTime()<=Date.now()||grant.resource!==resourceUri())throw invalid();
 const r=(await db.query<{name:string;email:string;workspace_name:string;slug:string;role:DashboardContext['role']}>(
  `SELECT u.name,u.email,w.name workspace_name,w.slug,m.role FROM "user" u
   JOIN workspace_memberships m ON m.user_id=u.id JOIN workspaces w ON w.id=m.workspace_id
   JOIN "session" s ON s."userId"=u.id AND s.id=$3
   WHERE u.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active' AND s."expiresAt">now()`,[grant.user_id,grant.workspace_id,grant.session_id])).rows[0];
 if(!r)throw invalid();
 if(resolveDashboardConfiguration().authMode==='mail'){
  if(!await verifyMailDashboardSession(grant.session_id,grant.user_id,r.email,db))throw invalid();
 }else if(!isAllowedDashboardEmail(r.email))throw invalid();
 return {context:{user:{id:grant.user_id,name:r.name,email:r.email},workspace:{id:grant.workspace_id,name:r.workspace_name,slug:r.slug},role:r.role},grantId:grant.id,clientId:grant.client_id,sessionId:grant.session_id,scopes:grant.scopes,writesPaused:grant.writes_paused,expiresAt:grant.expires_at};
}
export async function refreshPrincipal(p:Principal){
 const row=(await getDatabasePool().query<Grant>('SELECT * FROM assistant_grants WHERE id=$1',[p.grantId])).rows[0];
 if(!row)throw invalid();return principal(row);
}
export async function authenticate(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer (ta_ops_[A-Za-z0-9_-]{43})$/)?.[1];
 if(!token)throw invalid();
 const row=(await getDatabasePool().query<Grant>(`SELECT g.* FROM assistant_tokens t JOIN assistant_grants g ON g.id=t.grant_id WHERE t.token_hash=$1 AND t.kind='access' AND t.expires_at>now()`,[hash(token)])).rows[0];
 if(!row)throw invalid();
 const result=await principal(row);
 await getDatabasePool().query('UPDATE assistant_grants SET last_used_at=now() WHERE id=$1',[row.id]);
 return result;
}
export async function registerClient(raw:unknown){
 const v=z.object({client_name:z.string().trim().min(1).max(100),redirect_uris:z.array(z.string().max(2048).refine(validRedirect)).min(1).max(5),token_endpoint_auth_method:z.literal('none').optional(),grant_types:z.array(z.enum(['authorization_code','refresh_token'])).optional(),response_types:z.array(z.literal('code')).optional()}).parse(raw);
 const id=`ta_client_${secret()}`;
 await getDatabasePool().query('INSERT INTO assistant_clients(id,name,redirect_uris) VALUES($1,$2,$3::jsonb)',[id,v.client_name,JSON.stringify(v.redirect_uris)]);
 return {client_id:id,client_name:v.client_name,redirect_uris:v.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']};
}
export async function validateAuthorization(raw:Record<string,string|undefined>){
 const v=z.object({client_id:z.string().max(100),redirect_uri:z.string().max(2048).refine(validRedirect),response_type:z.literal('code'),resource:z.literal(resourceUri()),scope:z.string().max(1000).optional(),state:z.string().min(1).max(2048),code_challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/),code_challenge_method:z.literal('S256')}).parse(raw);
 const client=(await getDatabasePool().query<{name:string;redirect_uris:string[]}>('SELECT name,redirect_uris FROM assistant_clients WHERE id=$1',[v.client_id])).rows[0];
 if(!client||!client.redirect_uris.includes(v.redirect_uri))throw new AssistantError('invalid_request','The application or callback is not registered.');
 return {...v,scopes:parseScopes(v.scope),clientName:client.name};
}
export async function createConsent(v:Awaited<ReturnType<typeof validateAuthorization>>,context:DashboardContext,sessionId:string){
 const nonce=secret();
 const inserted=await getDatabasePool().query(`INSERT INTO assistant_consents(nonce_hash,client_id,user_id,workspace_id,session_id,redirect_uri,challenge,scopes,state,expires_at)
  SELECT $1,$2,$3,$4,s.id,$6,$7,$8,$9,LEAST(s."expiresAt",now()+interval '10 minutes') FROM "session" s WHERE s.id=$5 AND s."userId"=$3 AND s."expiresAt">now()`,[hash(nonce),v.client_id,context.user.id,context.workspace.id,sessionId,v.redirect_uri,v.code_challenge,v.scopes,v.state]);
 if(!inserted.rowCount)throw invalid();
 return nonce;
}
export async function finishConsent(nonce:string,context:DashboardContext,sessionId:string,selected:string[],allow:boolean){
 const db=await getDatabasePool().connect();
 try{await db.query('BEGIN');
  const r=(await db.query<{client_id:string;redirect_uri:string;challenge:string;scopes:string[];state:string}>(`DELETE FROM assistant_consents WHERE nonce_hash=$1 AND user_id=$2 AND workspace_id=$3 AND session_id=$4 AND expires_at>now() RETURNING *`,[hash(nonce),context.user.id,context.workspace.id,sessionId])).rows[0];
  if(!r)throw invalid();
  const callback=new URL(r.redirect_uri);callback.searchParams.set('state',r.state);callback.searchParams.set('iss',assistantOrigin());
  if(!allow){callback.searchParams.set('error','access_denied');await db.query('COMMIT');return callback.href;}
  const approved=parseScopes(selected.join(' '));
  if(approved.some(s=>!r.scopes.includes(s)))throw new AssistantError('invalid_scope','Only requested permissions can be granted.');
  if(context.role==='viewer'&&approved.some(s=>s.endsWith(':write')))throw new AssistantError('access_denied','View-only accounts cannot grant changes.',403);
  const id=randomUUID(),code=secret();
  const inserted=await db.query(`INSERT INTO assistant_grants(id,client_id,user_id,workspace_id,session_id,scopes,resource,expires_at)
   SELECT $1,$2,$3,$4,s.id,$6,$7,LEAST(s."expiresAt",now()+interval '30 days') FROM "session" s
   JOIN workspace_memberships m ON m.user_id=s."userId" AND m.workspace_id=$4 AND m.status='active'
   JOIN workspaces w ON w.id=m.workspace_id AND w.status='active'
   WHERE s.id=$5 AND s."userId"=$3 AND s."expiresAt">now() AND (m.role<>'viewer' OR NOT ($8::boolean)) RETURNING id`,[id,r.client_id,context.user.id,context.workspace.id,sessionId,approved,resourceUri(),approved.some(s=>s.endsWith(':write'))]);
  if(!inserted.rowCount)throw invalid();
  await db.query("INSERT INTO assistant_codes(code_hash,grant_id,redirect_uri,challenge,expires_at) VALUES($1,$2,$3,$4,now()+interval '2 minutes')",[hash(code),id,r.redirect_uri,r.challenge]);
  callback.searchParams.set('code',code);await db.query('COMMIT');return callback.href;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function exchange(raw:Record<string,unknown>){
 const v=z.object({grant_type:z.enum(['authorization_code','refresh_token']),client_id:z.string().min(1).max(100),resource:z.literal(resourceUri()),code:z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),redirect_uri:z.string().max(2048).optional(),code_verifier:z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(),refresh_token:z.string().regex(/^ta_refresh_[A-Za-z0-9_-]{43}$/).optional(),scope:z.string().max(1000).optional()}).parse(raw);
 const db=await getDatabasePool().connect();
 try{await db.query('BEGIN');
  const isCode=v.grant_type==='authorization_code';
  const credential=isCode?v.code:v.refresh_token;if(!credential)throw invalid();
  const row=(await db.query<Grant & {credential_expiry:Date;used_at:Date|null;challenge?:string;redirect_uri?:string}>(isCode?
   `SELECT g.*,c.expires_at credential_expiry,c.used_at,c.challenge,c.redirect_uri FROM assistant_codes c JOIN assistant_grants g ON g.id=c.grant_id WHERE c.code_hash=$1 FOR UPDATE OF g,c`:
   `SELECT g.*,t.expires_at credential_expiry,t.used_at FROM assistant_tokens t JOIN assistant_grants g ON g.id=t.grant_id WHERE t.token_hash=$1 AND t.kind='refresh' FOR UPDATE OF g,t`,[hash(credential)])).rows[0];
  if(!row||row.client_id!==v.client_id||row.resource!==v.resource||row.credential_expiry.getTime()<=Date.now())throw invalid();
  if(isCode && (!v.code_verifier||row.redirect_uri!==v.redirect_uri||createHash('sha256').update(v.code_verifier).digest('base64url')!==row.challenge))throw invalid();
  if(row.used_at){await db.query('UPDATE assistant_grants SET revoked_at=now() WHERE id=$1',[row.id]);await db.query('COMMIT');throw invalid();}
  await principal(row,db);
  const granted=v.scope===undefined?row.scopes:parseScopes(v.scope);if(granted.some(s=>!row.scopes.includes(s)))throw new AssistantError('invalid_scope','Refresh cannot expand permissions.');
  const access=`ta_ops_${secret()}`,refresh=`ta_refresh_${secret()}`;
  await db.query(isCode?'UPDATE assistant_codes SET used_at=now() WHERE code_hash=$1':'UPDATE assistant_tokens SET used_at=now() WHERE token_hash=$1',[hash(credential)]);
  await db.query('UPDATE assistant_grants SET scopes=$2,last_used_at=now() WHERE id=$1',[row.id,granted]);
  const expires=Math.max(1,Math.min(3600,Math.floor((row.expires_at.getTime()-Date.now())/1000)));
  await db.query(`INSERT INTO assistant_tokens(token_hash,grant_id,kind,expires_at) VALUES($1,$2,'access',now()+make_interval(secs=>$3)),($4,$2,'refresh',$5)`,[hash(access),row.id,expires,hash(refresh),row.expires_at]);
  await db.query('COMMIT');return {access_token:access,token_type:'Bearer',expires_in:expires,refresh_token:refresh,scope:granted.join(' ')};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function revokeToken(token:string,clientId:string){
 await getDatabasePool().query(`UPDATE assistant_grants SET revoked_at=now() WHERE client_id=$2 AND id IN(SELECT grant_id FROM assistant_tokens WHERE token_hash=$1)`,[hash(token),clientId]);
}
