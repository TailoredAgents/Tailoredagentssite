import {test,expect} from '@playwright/test';
import {createHash,randomBytes} from 'node:crypto';

test('built Worker: discovery, login continuation, explicit consent, PKCE, read-only monitoring, refresh and revocation',async({page,request})=>{
 const origin='http://localhost:8787';
 const resource=origin+'/mcp';
 const discovery=await request.get('/.well-known/oauth-protected-resource/mcp');
 expect(discovery.status()).toBe(200);expect((await discovery.json()).resource).toBe(resource);
 const denied=await request.post('/mcp',{data:{}});expect(denied.status()).toBe(401);expect(denied.headers()['www-authenticate']).toContain('resource_metadata');
 const client=await request.post('/oauth/register',{data:{client_name:'Local MCP verification',redirect_uris:[origin+'/callback-test'],token_endpoint_auth_method:'none'}});
 expect(client.status()).toBe(201);const {client_id}=await client.json();
 const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const params=new URLSearchParams({client_id,redirect_uri:origin+'/callback-test',response_type:'code',code_challenge:challenge,code_challenge_method:'S256',resource,state:'local-test'});
 await page.goto('/oauth/authorize?'+params);
 await expect(page).toHaveURL(/\/login\?next=/);
 await page.getByLabel('Email address').fill('local-owner@tailoredagents.com');
 await page.getByLabel('Password',{exact:true}).fill('Local browser test password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/oauth\/authorize\?/);
 const choices=page.locator('input[name=grant_scope]');expect(await choices.count()).toBe(3);
 await expect(page.locator('input[name=grant_scope][value="mail:read"]')).toBeChecked();
 await expect(page.locator('input[name=grant_scope][value="mail:send"]')).not.toBeChecked();
 await expect(page.locator('input[name=grant_scope][value="mail:manage"]')).not.toBeChecked();
 await expect(page.locator('p').filter({hasText:'Mailboxes:'})).toContainText('local-owner@tailoredagents.com');
 await page.screenshot({path:'test-results/mcp-consent-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/mcp-consent-mobile.png',fullPage:true});
 await page.locator('button[value=allow]').click();
 await expect(page).toHaveURL(/callback-test\?/);
 const code=new URL(page.url()).searchParams.get('code')!;
 // Form encoding, no Origin: exercises the Worker adapter before SvelteKit CSRF.
 const exchange=await request.post('/oauth/token',{form:{client_id,redirect_uri:origin+'/callback-test',grant_type:'authorization_code',code_verifier:verifier,code,resource}});
 expect(exchange.status()).toBe(200);const tokens=await exchange.json();expect(tokens.scope).toBe('mail:read');
 const call=async(token:string,method:string,params:any={})=>request.post('/mcp',{headers:{Authorization:'Bearer '+token,Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method,params}});
 const listing=await call(tokens.access_token,'tools/list');expect(listing.status()).toBe(200);
 const tools=(await listing.json()).result.tools;expect(tools.some((t:any)=>t.name==='get_thread')).toBe(true);expect(tools.some((t:any)=>t.name==='send_message')).toBe(false);
 const reading=await call(tokens.access_token,'tools/call',{name:'get_thread',arguments:{id:'local-message-1'}});expect(reading.status()).toBe(200);expect((await reading.json()).result.isError).not.toBe(true);
 const refresh=await request.post('/oauth/token',{form:{client_id,grant_type:'refresh_token',refresh_token:tokens.refresh_token,resource}});expect(refresh.status()).toBe(200);const next=await refresh.json();
 expect((await call(tokens.access_token,'tools/list')).status()).toBe(401);
 expect((await call(next.access_token,'tools/list')).status()).toBe(200);
 const revoke=await request.post('/oauth/revoke',{form:{client_id,token:next.refresh_token}});expect(revoke.status()).toBe(200);
 expect((await call(next.access_token,'tools/list')).status()).toBe(401);
 expect((await request.post('/api/auth/login',{headers:{Origin:'https://attacker.example'},form:{email:'local-owner@tailoredagents.com',password:'invalid'}})).status()).toBe(403);
});


test('all three scopes can be explicitly granted; permanent deletion needs a session form',async({page,request})=>{
 const origin='http://localhost:8787',resource=origin+'/mcp';
 const clientName='Local full mailbox test '+Date.now();
 const registered=await request.post('/oauth/register',{data:{client_name:clientName,redirect_uris:[origin+'/callback-test']}});
 const {client_id}=await registered.json();
 const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const params=new URLSearchParams({client_id,redirect_uri:origin+'/callback-test',response_type:'code',code_challenge:challenge,code_challenge_method:'S256',resource});
 await page.goto('/oauth/authorize?'+params);
 await page.getByLabel('Email address').fill('local-owner@tailoredagents.com');await page.getByLabel('Password',{exact:true}).fill('Local browser test password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('checkbox',{name:'Send mail',exact:true}).check();await page.getByRole('checkbox',{name:'Manage mailbox',exact:true}).check();
 await page.locator('button[value=allow]').click();await expect(page).toHaveURL(/callback-test\?/);
 const code=new URL(page.url()).searchParams.get('code')!;
 const exchange=await request.post('/oauth/token',{form:{client_id,redirect_uri:origin+'/callback-test',grant_type:'authorization_code',code_verifier:verifier,code,resource}});
 const tokens=await exchange.json();expect(tokens.scope).toBe('mail:read mail:send mail:manage');
 const call=async(name:string,args:any)=>{
  const r=await request.post('/mcp',{headers:{Authorization:'Bearer '+tokens.access_token,Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});
  expect(r.status()).toBe(200);const result=(await r.json()).result;expect(result.isError).not.toBe(true);return JSON.parse(result.content[0].text);
 };
 const id='mcp-browser-delete-'+Date.now();
 await call('save_draft',{id,to:'nobody@example.test',subject:'Disposable local draft',text:'This test never sends an email.'});
 await call('delete_draft',{id});
 const pending=await call('request_permanent_delete',{id});
 expect(pending.pending_confirmation).toBe(true);
 const noSession=await request.post(pending.url,{headers:{Authorization:'Bearer '+tokens.access_token,Origin:origin,Accept:'text/html'},form:{confirmation:'DELETE'},maxRedirects:0});
 expect(noSession.status()).toBe(303);expect(noSession.headers().location).toContain('/login?next=');
 await page.goto(pending.url);await expect(page.getByRole('heading',{name:'Permanently delete this message?'})).toBeVisible();
 await page.getByLabel('Type DELETE to confirm').fill('DELETE');await page.getByRole('button',{name:'Permanently delete',exact:true}).click();await expect(page.getByRole('heading',{name:'Message deleted'})).toBeVisible();
 await page.goto('/settings/connections');
 const card=page.locator('article').filter({hasText:clientName});await card.getByRole('button',{name:'Disconnect'}).click();await expect(page.locator('article').filter({hasText:clientName})).toHaveCount(0);
});
