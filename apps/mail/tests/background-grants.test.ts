import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createTestDb} from '../src/lib/server/test-db';
import {createUser,getAuthenticatedSession,setUserPassword} from '../src/lib/server/auth';
import {handleDashboardAuth,inspectDashboardGrant} from '../src/lib/server/dashboard-auth';
import {inspectBackgroundGrant} from '../src/lib/server/background-grants';
const secret='local-background-bridge-secret-at-least32',password='Background-test-password-2026';
async function fixture(){
 const {db}=createTestDb();const user=await createUser(db,{email:'worker@example.test',name:'Employee',password,isAdmin:true});
 const call=(body:unknown)=>handleDashboardAuth(new Request('https://mail.example.test/api/dashboard-auth',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify(body)}),db,secret);
 const login=await (await call({action:'login',email:user.email,password})).json();
 const token=randomBytes(32).toString('base64url');const input={action:'delegate',token:login.token,delegationToken:token,delegationId:randomUUID(),scopes:['identity','mail:read'],expiresAt:new Date(Date.now()+29*86400000).toISOString()};
 return {db,user,call,login,token,input};
}
test('explicit background delegation survives sign-out without becoming an inbox or login credential',async()=>{
 const f=await fixture();assert.equal((await f.call(f.input)).status,200);
 await f.call({action:'revoke',token:f.login.token});
 assert.equal(await inspectDashboardGrant(f.db,f.token),null);assert.equal(await getAuthenticatedSession(f.db,f.token),null);
 assert.equal((await inspectBackgroundGrant(f.db,f.token))?.id,f.user.id);
 assert.equal((await inspectBackgroundGrant(f.db,f.token,'mail:read'))?.id,f.user.id);
 assert.equal(await inspectBackgroundGrant(f.db,f.token,'mail:send'),null);
 assert.equal((await f.call({action:'inspect_background',token:f.token})).status,200);
});
test('background grants cannot renew or expand themselves; expiry and scope are bounded',async()=>{
 const f=await fixture();assert.equal((await f.call({...f.input,scopes:['identity','mail:send']})).status,400);
 assert.equal((await f.call({...f.input,expiresAt:new Date(Date.now()+31*86400000).toISOString()})).status,400);
 assert.equal((await f.call(f.input)).status,200);
 assert.equal((await f.call({...f.input,token:f.token,delegationId:randomUUID(),delegationToken:randomBytes(32).toString('base64url'),scopes:['identity','mail:read','mail:send']})).status,409);
});
test('password and approval changes permanently revoke delegated identity',async()=>{
 const f=await fixture();await f.call(f.input);await setUserPassword(f.db,f.user.id,'New-temporary-password-2026');
 assert.equal(await inspectBackgroundGrant(f.db,f.token),null);await f.db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').bind(f.user.id).run();assert.equal(await inspectBackgroundGrant(f.db,f.token),null);
 const g=await fixture();await g.call(g.input);await g.db.prepare('UPDATE users SET dashboard_access=0 WHERE id=?').bind(g.user.id).run();await g.db.prepare('UPDATE users SET dashboard_access=1 WHERE id=?').bind(g.user.id).run();assert.equal(await inspectBackgroundGrant(g.db,g.token),null);
});
test('revocation is idempotent and expired background grants are refused',async()=>{
 const f=await fixture();await f.call(f.input);await f.call({action:'revoke_background',token:f.token});await f.call({action:'revoke_background',token:f.token});assert.equal(await inspectBackgroundGrant(f.db,f.token),null);
 const g=await fixture();await g.call(g.input);await g.db.prepare("UPDATE assistant_background_grants SET expires_at=datetime('now','-1 minute')").run();assert.equal(await inspectBackgroundGrant(g.db,g.token),null);
});
