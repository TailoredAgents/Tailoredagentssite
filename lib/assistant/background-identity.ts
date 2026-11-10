import 'server-only';
import {createHmac,randomBytes} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {resolveDashboardConfiguration,isAllowedDashboardEmail} from '@/lib/dashboard/config';
import {createMailBackgroundGrant,inspectMailBackgroundGrant,readMailDashboardToken,revokeMailBackgroundGrant} from '@/lib/dashboard/mail-identity';
import {encryptCredential,decryptCredential} from '@/lib/search-console/crypto';
import {AssistantError,type AssistantScope} from './config';
export const BACKGROUND_CLIENT='ta_native_background';
type Database=Pick<PoolClient,'query'>;
const key=()=>resolveDashboardConfiguration().authSecret+':assistant-background';
const unavailable=()=>new AssistantError('background_unavailable','Background access expired or changed. Update your assistant access while signed in.',401);
export type BackgroundIdentity={identity_kind:'mail'|'password';identity_credential:string;expires_at:Date};
async function passwordIdentity(userId:string,db:Database){const a=(await db.query('SELECT password FROM "account" WHERE "userId"=$1 AND "providerId"=\'credential\' AND password IS NOT NULL',[userId])).rows[0];if(!a?.password)throw unavailable();return createHmac('sha256',key()).update(a.password).digest('hex');}
export async function authorizeBackgroundIdentity(c:DashboardContext,sessionId:string,grantId:string,scopes:AssistantScope[],db:Database):Promise<BackgroundIdentity>{
 if(process.env.ASSISTANT_BACKGROUND_ENABLED!=='true')throw new AssistantError('background_setup','Background delegation is not enabled on the server yet.',503);
 if(!(await db.query('SELECT 1 FROM "session" WHERE id=$1 AND "userId"=$2 AND "expiresAt">now()',[sessionId,c.user.id])).rowCount)throw unavailable();
 const expires_at=new Date(Date.now()+30*86400000-60000);
 if(resolveDashboardConfiguration().authMode==='password'){
  if(!isAllowedDashboardEmail(c.user.email))throw unavailable();return {identity_kind:'password',identity_credential:await passwordIdentity(c.user.id,db),expires_at};
 }
 const sessionToken=await readMailDashboardToken(sessionId,c.user.id);if(!sessionToken)throw unavailable();
 const token=randomBytes(32).toString('base64url'),mailScopes=['identity'];if(scopes.includes('conversations:read'))mailScopes.push('mail:read');if(scopes.includes('mail:send'))mailScopes.push('mail:send');
 let identity:Awaited<ReturnType<typeof createMailBackgroundGrant>>;
 try{identity=await createMailBackgroundGrant(sessionToken,grantId,token,mailScopes,expires_at);}catch(error){await revokeMailBackgroundGrant(token).catch(()=>{});throw error;}
 const linked=(await db.query('SELECT mail_user_id FROM mail_dashboard_identities WHERE user_id=$1',[c.user.id])).rows[0];
 if(!linked||linked.mail_user_id!==identity.user.id||identity.user.email.toLowerCase()!==c.user.email.toLowerCase()){await revokeMailBackgroundGrant(token).catch(()=>{});throw unavailable();}
 return {identity_kind:'mail',identity_credential:encryptCredential(token,key()),expires_at:new Date(Math.min(expires_at.getTime(),Date.parse(identity.expiresAt)))};
}
export async function verifyBackgroundIdentity(g:BackgroundIdentity&{user_id:string},email:string,db:Database){
 if(process.env.ASSISTANT_BACKGROUND_ENABLED!=='true')throw unavailable();
 if(g.identity_kind==='password'){
  if(resolveDashboardConfiguration().authMode!=='password'||!isAllowedDashboardEmail(email)||g.identity_credential!==await passwordIdentity(g.user_id,db))throw unavailable();return;
 }
 if(resolveDashboardConfiguration().authMode!=='mail')throw unavailable();
 const identity=await inspectMailBackgroundGrant(decryptCredential(g.identity_credential,key()));
 const linked=(await db.query('SELECT mail_user_id FROM mail_dashboard_identities WHERE user_id=$1',[g.user_id])).rows[0];
 if(!linked||linked.mail_user_id!==identity.user.id||identity.user.email.toLowerCase()!==email.toLowerCase()||Date.parse(identity.expiresAt)<=Date.now())throw unavailable();
}
export async function backgroundMailToken(grantId:string,c:DashboardContext){
 const row=(await getDatabasePool().query(`SELECT g.* FROM assistant_grants g JOIN workspace_memberships m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id AND m.status='active' JOIN workspaces w ON w.id=g.workspace_id AND w.status='active' WHERE g.id=$1 AND g.workspace_id=$2 AND g.user_id=$3 AND g.authority='background' AND g.client_id=$4 AND g.identity_kind='mail' AND g.revoked_at IS NULL AND g.expires_at>now()`,[grantId,c.workspace.id,c.user.id,BACKGROUND_CLIENT])).rows[0];
 if(!row)throw unavailable();await verifyBackgroundIdentity(row,c.user.email,getDatabasePool());return decryptCredential(row.identity_credential,key());
}
export async function revokeBackgroundIdentity(grantId:string,c:DashboardContext){
 const row=(await getDatabasePool().query("SELECT identity_credential FROM assistant_grants WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND authority='background' AND identity_kind='mail' AND revoked_at IS NOT NULL",[grantId,c.workspace.id,c.user.id])).rows[0];
 if(row)await revokeMailBackgroundGrant(decryptCredential(row.identity_credential,key()));
}
export async function releaseBackgroundIdentity(identity:BackgroundIdentity){if(identity.identity_kind==='mail')await revokeMailBackgroundGrant(decryptCredential(identity.identity_credential,key()));}
