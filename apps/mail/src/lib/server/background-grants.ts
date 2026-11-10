import type {D1Database} from '@cloudflare/workers-types';
import {hashToken} from './crypto';

export type BackgroundScope='identity'|'mail:read'|'mail:send';
type Identity={id:string;email:string;name:string;is_admin:number;expires_at:string};
const token=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function inspectBackgroundGrant(db:D1Database,credential:string,scope:BackgroundScope='identity'){
 if(!token(credential))return null;
 return db.prepare(`SELECT u.id,u.email,u.name,u.is_admin,g.expires_at FROM assistant_background_grants g JOIN users u ON u.id=g.user_id WHERE g.token_hash=? AND g.revoked_at IS NULL AND datetime(g.expires_at)>datetime('now') AND u.disabled_at IS NULL AND u.must_change_password=0 AND u.dashboard_access=1 AND EXISTS(SELECT 1 FROM json_each(g.scopes) WHERE value=?)`).bind(await hashToken(credential),scope).first<Identity>();
}
/** Called only after the existing dashboard bridge authenticates the server request. */
export async function backgroundGrantRequest(db:D1Database,body:Record<string,unknown>){
 if(!token(body.token))return {status:400,data:{error:'invalid_request'}};
 if(body.action==='inspect_background'){
  const r=await inspectBackgroundGrant(db,body.token);return r?{status:200,data:{authority:'background',user:{id:r.id,email:r.email,name:r.name,isAdmin:r.is_admin===1},expiresAt:r.expires_at}}:{status:401,data:{error:'session_expired'}};
 }
 if(body.action==='revoke_background'){
  await db.prepare("UPDATE assistant_background_grants SET revoked_at=datetime('now') WHERE token_hash=? AND revoked_at IS NULL").bind(await hashToken(body.token)).run();return {status:200,data:{ok:true}};
 }
 if(body.action!=='delegate'||!uuid(body.delegationId)||!token(body.delegationToken)||!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.length>3||body.scopes.some(s=>!['identity','mail:read','mail:send'].includes(s))||!body.scopes.includes('identity')||(body.scopes.includes('mail:send')&&!body.scopes.includes('mail:read'))||typeof body.expiresAt!=='string')return {status:400,data:{error:'invalid_request'}};
 const expiry=Date.parse(body.expiresAt);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*86400000)return {status:400,data:{error:'invalid_expiry'}};
 const scopes=JSON.stringify([...new Set(body.scopes)].sort()),credentialHash=await hashToken(body.token),delegateHash=await hashToken(body.delegationToken);
 // A background credential cannot create or renew itself: this join accepts only a real dashboard login.
 const result=await db.prepare(`INSERT INTO assistant_background_grants(id,token_hash,user_id,scopes,expires_at)
  SELECT ?,?,u.id,?,? FROM dashboard_login_grants login JOIN sessions s ON s.id=login.session_id JOIN users u ON u.id=s.user_id
  WHERE login.token_hash=? AND datetime(s.expires_at)>datetime('now') AND u.disabled_at IS NULL AND u.must_change_password=0 AND u.dashboard_access=1
  AND (SELECT count(*) FROM assistant_background_grants old WHERE old.user_id=u.id AND old.revoked_at IS NULL AND datetime(old.expires_at)>datetime('now'))<20
  ON CONFLICT(id) DO NOTHING`).bind(body.delegationId,delegateHash,scopes,new Date(expiry).toISOString(),credentialHash).run();
 if(result.meta.changes!==1)return {status:409,data:{error:'delegation_unavailable'}};
 const current=await inspectBackgroundGrant(db,body.delegationToken);if(!current)return {status:401,data:{error:'session_expired'}};
 return {status:200,data:{authority:'background',user:{id:current.id,email:current.email,name:current.name,isAdmin:current.is_admin===1},expiresAt:current.expires_at}};
}
