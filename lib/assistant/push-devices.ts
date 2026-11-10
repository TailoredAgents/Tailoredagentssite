import 'server-only';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {resolveDashboardConfiguration} from '@/lib/dashboard/config';
import {encryptCredential} from '@/lib/search-console/crypto';
import {AssistantError} from './config';
import {apnsConfiguration,sendPush} from './apns';
import type {PushRequest} from './push-contract';
import {notificationDestination} from './notification-contract';
export const pushKey=()=>resolveDashboardConfiguration().authSecret+':assistant-push';
// All values are high-entropy native/provider tokens; stable hashes permit re-binding after server key rotation.
const fingerprint=(purpose:string,value:string)=>createHash('sha256').update('assistant-push:'+purpose+':'+value).digest('hex');
const unavailable=()=>new AssistantError('device_unavailable','This notification device is unavailable. Enable notifications again from the app.',409);
async function active(c:DashboardContext){if(!(await getDatabasePool().query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",[c.workspace.id,c.user.id])).rowCount)throw unavailable();}
/** Narrow installation secret can only revoke this installation; no login or data access. */
export async function revokePushInstallation(v:Extract<PushRequest,{operation:'revoke'}>){
 await getDatabasePool().query("UPDATE assistant_push_devices SET enabled=false,revoked_at=now(),verified_at=NULL,verification_hash=NULL,permission='denied' WHERE installation_id=$1 AND binding_secret_hash=$2",[v.installationId,fingerprint('binding',v.secret)]);return {ok:true};
}
export async function pushDeviceStatus(c:DashboardContext,v:Extract<PushRequest,{operation:'status'}>){
 await active(c);const r=(await getDatabasePool().query('UPDATE assistant_push_devices SET last_seen_at=now() WHERE installation_id=$1 AND binding_secret_hash=$2 RETURNING id,workspace_id,user_id,enabled,verified_at,revoked_at',[v.installationId,fingerprint('binding',v.secret)])).rows[0];
 const own=r?.workspace_id===c.workspace.id&&r?.user_id===c.user.id;
 return {configured:apnsConfiguration().ready,account:c.user.id,boundElsewhere:!!(r&&!own&&!r.revoked_at),device:r&&own?{id:r.id,enabled:r.enabled&&!r.revoked_at,verified:!!r.verified_at}:null};
}
export async function removeOwnedPushDevice(c:DashboardContext,id:string){
 await active(c);await getDatabasePool().query("UPDATE assistant_push_devices SET enabled=false,revoked_at=now(),verified_at=NULL,verification_hash=NULL,permission='denied' WHERE id=$1 AND workspace_id=$2 AND user_id=$3",[id,c.workspace.id,c.user.id]);
}
export async function openPushNotification(c:DashboardContext,v:Extract<PushRequest,{operation:'open'}>){
 await active(c);const r=(await getDatabasePool().query(`UPDATE assistant_employee_notifications n SET read_at=COALESCE(n.read_at,now()) WHERE n.id=$1 AND n.workspace_id=$2 AND n.user_id=$3 AND EXISTS(SELECT 1 FROM assistant_push_devices d WHERE d.id=$4 AND d.installation_id=$5 AND d.binding_secret_hash=$6 AND d.workspace_id=n.workspace_id AND d.user_id=n.user_id AND d.revoked_at IS NULL AND d.verified_at IS NOT NULL) RETURNING n.*`,[v.notificationId,c.workspace.id,c.user.id,v.id,v.installationId,fingerprint('binding',v.secret)])).rows[0];
 if(!r)throw unavailable();return {path:notificationDestination(r)};
}
export async function registerPushDevice(c:DashboardContext,v:Extract<PushRequest,{operation:'register'}>){
 await active(c);const config=apnsConfiguration();if(!config.ready||config.environment!==v.environment)throw new AssistantError('push_setup','Native push is not enabled for this app build yet. Use SMS alerts for now.',503);
 const hash=fingerprint('binding',v.secret),tokenHash=fingerprint('token',v.token),code=randomBytes(32).toString('base64url'),db=await getDatabasePool().connect();let id=randomUUID(),verified=false;
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(8129130057)');
  const existing=(await db.query('SELECT * FROM assistant_push_devices WHERE installation_id=$1 FOR UPDATE',[v.installationId])).rows[0];
  if(existing&&existing.binding_secret_hash!==hash)throw unavailable();
  if((await db.query('SELECT 1 FROM assistant_push_devices WHERE token_hash=$1 AND installation_id<>$2',[tokenHash,v.installationId])).rowCount)throw unavailable();
  if((!existing||existing.user_id!==c.user.id||existing.workspace_id!==c.workspace.id||existing.revoked_at)&&(await db.query('SELECT count(*)::int n FROM assistant_push_devices WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL',[c.workspace.id,c.user.id])).rows[0].n>=5)throw new AssistantError('device_limit','Remove an old notification device before adding another.',409);
  id=existing?.id??id;verified=!!(existing?.verified_at&&existing.enabled&&!existing.revoked_at&&existing.user_id===c.user.id&&existing.workspace_id===c.workspace.id&&existing.token_hash===tokenHash&&existing.environment===v.environment);
  await db.query(`INSERT INTO assistant_push_devices(id,workspace_id,user_id,installation_id,token_hash,token_encrypted,environment,binding_secret_hash,verification_hash,verification_expires_at,permission)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '10 minutes',$10) ON CONFLICT(installation_id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id,user_id=EXCLUDED.user_id,token_hash=EXCLUDED.token_hash,token_encrypted=EXCLUDED.token_encrypted,environment=EXCLUDED.environment,binding_secret_hash=EXCLUDED.binding_secret_hash,verification_hash=CASE WHEN $11 THEN NULL ELSE EXCLUDED.verification_hash END,verification_expires_at=EXCLUDED.verification_expires_at,permission=EXCLUDED.permission,enabled=true,revoked_at=NULL,verified_at=CASE WHEN $11 THEN assistant_push_devices.verified_at ELSE NULL END,registered_at=now(),last_seen_at=now()`,[id,c.workspace.id,c.user.id,v.installationId,tokenHash,encryptCredential(v.token,pushKey()),v.environment,hash,fingerprint('verification',code),v.permission,verified]);
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 if(verified)return {id,account:c.user.id,verified:true};
 const r=await sendPush({token:v.token,environment:v.environment,id:randomUUID(),expiresAt:new Date(Date.now()+600000),collapseId:'assistant-device-verification',payload:{aps:{alert:{title:'Tailored Agents',body:'Open the app to finish enabling assistant notifications.'},sound:'default'},ta_device:id,ta_verify:code}}).catch(()=>({status:'unknown' as const}));
 if(r.status==='failed'){await getDatabasePool().query('UPDATE assistant_push_devices SET enabled=false WHERE id=$1 AND verification_hash=$2',[id,fingerprint('verification',code)]);throw new AssistantError('push_failed','Apple did not accept the verification notification. SMS alerts remain available.',503);}
 return {id,account:c.user.id,verified:false,message:r.status==='unknown'?'Verification delivery is uncertain. Do not repeatedly register; check your notifications first.':'Open the verification notification on this iPhone to finish setup.'};
}
export async function confirmPushDevice(c:DashboardContext,v:Extract<PushRequest,{operation:'confirm'}>){
 await active(c);if(!apnsConfiguration().ready)throw new AssistantError('push_setup','Native push is currently disabled.',503);const db=await getDatabasePool().connect();
 try{await db.query('BEGIN');const r=await db.query("UPDATE assistant_push_devices SET verified_at=now(),verification_hash=NULL,last_seen_at=now() WHERE id=$1 AND installation_id=$2 AND binding_secret_hash=$3 AND verification_hash=$4 AND verification_expires_at>now() AND workspace_id=$5 AND user_id=$6 AND enabled AND revoked_at IS NULL AND permission IN ('authorized','provisional') RETURNING id",[v.id,v.installationId,fingerprint('binding',v.secret),fingerprint('verification',v.code),c.workspace.id,c.user.id]);
  if(!r.rowCount)throw unavailable();await db.query('INSERT INTO assistant_notification_preferences(workspace_id,user_id,push_enabled) VALUES($1,$2,true) ON CONFLICT(workspace_id,user_id) DO UPDATE SET push_enabled=true,revision=assistant_notification_preferences.revision+1,updated_at=now()',[c.workspace.id,c.user.id]);await db.query('COMMIT');return {id:v.id,account:c.user.id,verified:true};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
