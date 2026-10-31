import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTestDb,insertTestUser} from './test-db';
import {registerClient,issueGrant,getUserByOAuthToken,refreshGrant,revokeToken,revokeClientForUser,issueAuthorizationCode,consumeAuthorizationCode,getClient} from './oauth';
import {POST as tokenPost} from '../../routes/oauth/token/+server';
import {GET as mcpGet,POST as mcpPost} from '../../routes/mcp/+server';
import {GET as metadataGet} from '../../routes/.well-known/oauth-protected-resource/mcp/+server';
import {normalizeOAuthForm,publicMailOrigin} from './mcp-routing';
import {handle} from '../../hooks.server';
const origin='https://mail.example.test',resource=origin+'/mcp';
async function setup(){
 const {db,sqlite}=createTestDb();insertTestUser(sqlite,'one');insertTestUser(sqlite,'two');
 const client=await registerClient(db,{client_name:'Test',redirect_uris:['https://client.example/callback']});
 const tokens=await issueGrant(db,{clientId:client.client_id,userId:'one',scope:['mail:read'],resource});
 return {db,sqlite,client,tokens};
}
function event(db:unknown,path:string,request?:Request):any{return {url:new URL(path,origin),request:request??new Request(new URL(path,origin)),platform:{env:{DB:db,APP_URL:origin}},locals:{},cookies:{get:()=>undefined},getClientAddress:()=> '127.0.0.1'};}

test('public metadata, protected MCP challenge, and cookie-only routes retain protection',async()=>{
 const {db}=await setup();
 for(const method of [mcpGet,mcpPost]) {const response=await method(event(db,'/mcp'));assert.equal(response.status,401);assert.match(response.headers.get('www-authenticate')!,/oauth-protected-resource\/mcp/);}
 const meta=await metadataGet(event(db,'/.well-known/oauth-protected-resource/mcp'));
 assert.equal((await meta.json()).resource,resource);
 const response=await handle({event:event(db,'/.well-known/oauth-protected-resource/mcp'),resolve:async()=>new Response('discovery')} as any);
 assert.equal(await response.text(),'discovery');
 const api=await handle({event:event(db,'/api/oauth/grants'),resolve:async()=>new Response('bad')} as any);assert.equal(api.status,401);
 await assert.rejects(async()=>handle({event:event(db,'/oauth/authorize?client_id=test&state=preserve'),resolve:async()=>new Response('bad')} as any),(e:any)=>e.status===303 && decodeURIComponent(e.location).includes('state=preserve'));
 const cross=event(db,'/mcp',new Request(resource,{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}));
 assert.equal((await handle({event:cross,resolve:async()=>new Response('bad')} as any)).status,403);
});

test('PKCE code exchange requires matching redirect and resource; code is single-use',async()=>{
 const {db,client}=await setup();
 const verifier='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
 const code=await issueAuthorizationCode(db,{client_id:client.client_id,user_id:'one',redirect_uri:client.redirect_uris[0],code_challenge:'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',scope:['mail:read'],resource});
 const params={grant_type:'authorization_code',client_id:client.client_id,redirect_uri:client.redirect_uris[0],code,code_verifier:verifier,resource};
 const request=await normalizeOAuthForm(new Request(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)}));
 const response=await tokenPost(event(db,'/oauth/token',request));assert.equal(response.status,200);
 const issued=await response.json();assert.equal(issued.scope,'mail:read');
 assert.ok(await getUserByOAuthToken(db,issued.access_token,resource));
 assert.equal(await consumeAuthorizationCode(db,code),null);
 for(const override of [{redirect_uri:'https://evil.test'}, {resource:'https://evil.test/mcp'},{code_verifier:'x'.repeat(43)}]) {
  const next=await issueAuthorizationCode(db,{client_id:client.client_id,user_id:'one',redirect_uri:client.redirect_uris[0],code_challenge:'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',scope:['mail:read'],resource});
  const request=new Request(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...params,code:next,...override})});
  assert.equal((await tokenPost(event(db,'/oauth/token',request))).status,400);
 }
});

test('refresh rotates without escalating, checks resource, rejects replay and revokes descendants',async()=>{
 const {db,client,tokens}=await setup();
 const args={refreshToken:tokens.refresh_token,clientId:client.client_id,resource};
 await assert.rejects(refreshGrant(db,{...args,scope:'mail:read mail:send'}),/not widen/);
 await assert.rejects(refreshGrant(db,{...args,resource:'https://evil.test/mcp'}),/resource/);
 const next=await refreshGrant(db,args);
 assert.equal(await getUserByOAuthToken(db,tokens.access_token,resource),null);
 assert.ok(await getUserByOAuthToken(db,next.access_token,resource));
 await assert.rejects(refreshGrant(db,args),/already used/);
 assert.equal(await getUserByOAuthToken(db,next.access_token,resource),null);
});

test('parallel refresh replay fails closed, including insert after family revocation',async()=>{
 const {db,client,tokens}=await setup();
 const attempts=await Promise.allSettled([1,2].map(()=>refreshGrant(db,{refreshToken:tokens.refresh_token,clientId:client.client_id,resource})));
 assert.ok(attempts.some(a=>a.status==='rejected'));
 for(const a of attempts) if(a.status==='fulfilled') assert.equal(await getUserByOAuthToken(db,a.value.access_token,resource),null);
});

test('expiry, disabled accounts, wrong resource and cross-user revocation',async()=>{
 const {db,sqlite,client,tokens}=await setup();
 assert.equal(await getUserByOAuthToken(db,tokens.access_token,'https://evil.test/mcp'),null);
 await revokeClientForUser(db,'two',client.client_id);assert.ok(await getUserByOAuthToken(db,tokens.access_token,resource));
 sqlite.query("UPDATE users SET disabled_at=datetime('now') WHERE id='one'").run();
 assert.equal(await getUserByOAuthToken(db,tokens.access_token,resource),null);
 await assert.rejects(refreshGrant(db,{refreshToken:tokens.refresh_token,clientId:client.client_id,resource}),/Account unavailable/);
 sqlite.query("UPDATE users SET disabled_at=NULL WHERE id='one'").run();
 sqlite.query("UPDATE oauth_grants SET access_expires_at='invalid'").run();assert.equal(await getUserByOAuthToken(db,tokens.access_token,resource),null);
 const fresh=await issueGrant(db,{clientId:client.client_id,userId:'one',scope:['mail:read'],resource});
 await revokeToken(db,fresh.refresh_token,client.client_id);assert.equal(await getUserByOAuthToken(db,fresh.access_token,resource),null);
});

test('canonical issuer and OAuth form normalization do not weaken browser CSRF',async()=>{
 assert.equal(publicMailOrigin({APP_URL:origin},new URL('https://evil.test')),origin);
 assert.throws(()=>publicMailOrigin(undefined,new URL('https://evil.test')));
 const request=new Request(origin+'/oauth/token',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/x-www-form-urlencoded'},body:'grant_type=x'});
 assert.equal(await normalizeOAuthForm(request),request);
 const normal=new Request(origin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'x=y'});
 assert.equal(await normalizeOAuthForm(normal),normal);
 const {db}=await setup();
 let fetched=false;assert.equal(await getClient(db,'https://untrusted.test/client.json',async()=>{fetched=true;throw Error();}),null);assert.equal(fetched,false);
});
