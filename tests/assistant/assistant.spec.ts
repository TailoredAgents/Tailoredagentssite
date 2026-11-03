import {test,expect} from '@playwright/test';
import {createHash,randomBytes} from 'node:crypto';

for(const direct of [false,true])for(const javascript of [true,false])test(`human OAuth consent returns a usable code (${javascript?'interactive':'plain form'}, ${direct?'direct':'reviewed'})`,async({page,browser,request,baseURL})=>{
 test.setTimeout(120000);
 const callback='https://chatgpt.com/connector_platform/oauth/callback';
 const verifier=randomBytes(32).toString('base64url');
 const clientName=`Browser test assistant ${test.info().project.name} ${javascript} ${direct}`;
 const registration=await request.post('/oauth/operations/register',{data:{client_name:clientName,redirect_uris:[callback]}});
 expect(registration.status()).toBe(201);
 const client=await registration.json(),resource=baseURL+'/api/mcp/operations';
 await page.goto('/sign-in');
 await page.getByLabel('Team email').fill('owner@example.test');
 await page.getByLabel('Password',{exact:true}).fill('Reporting-test-password-2026');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 const fallback=javascript?null:await browser.newContext({storageState:await page.context().storageState(),javaScriptEnabled:false,viewport:page.viewportSize()??undefined});
 if(fallback)page=await fallback.newPage();
 let callbackReferrer:string|undefined;
 // Never send the synthetic authorization code to the real external client.
 await page.route(callback+'**',async route=>{callbackReferrer=route.request().headers().referer;await route.fulfill({body:'Synthetic callback received',contentType:'text/plain'});});
 const query=new URLSearchParams({client_id:client.client_id,redirect_uri:callback,response_type:'code',resource,scope:'operations:read personal:read personal:write',state:'browser-consent-test',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
 await page.goto('/oauth/operations/authorize?'+query);
 await expect(page.getByRole('heading',{name:'Connect your assistant'})).toBeVisible();
 if(direct){await page.getByRole('checkbox',{name:'Change your private goals'}).check();await page.getByRole('checkbox',{name:/Allow direct actions without/}).check();}
 const posted=page.waitForRequest(r=>r.url().endsWith('/oauth/operations/consent')&&r.method()==='POST');
 await page.getByRole('button',{name:'Allow selected access'}).click();
 expect((await posted).headers().origin).toBe(baseURL);
 if(!javascript)await page.getByRole('link',{name:'Continue to your assistant'}).click();
 await expect(page).toHaveURL(new RegExp('^https://chatgpt.com/connector_platform/oauth/callback'));
 const returned=new URL(page.url());expect(returned.searchParams.get('state')).toBe('browser-consent-test');expect(callbackReferrer).toBeUndefined();
 const tokens=await request.post('/oauth/operations/token',{form:{grant_type:'authorization_code',client_id:client.client_id,code:returned.searchParams.get('code')!,redirect_uri:callback,code_verifier:verifier,resource}});
 expect(tokens.status()).toBe(200);
 const credentials=await tokens.json();expect(credentials.scope).toBe(direct?'operations:read personal:write':'operations:read');
 const identity=await request.post('/api/mcp/operations',{headers:{authorization:'Bearer '+credentials.access_token,accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'whoami',arguments:{}}}});
 const account=(await identity.json()).result.structuredContent.data;expect(account.user.email).toBe('owner@example.test');expect(account.directActions).toBe(direct);
 if(direct){
  const action=await request.post('/api/mcp/operations',{headers:{authorization:'Bearer '+credentials.access_token,accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'execute_action',arguments:{idempotencyKey:'browser-direct-goal',operation:{action:'save_goal',change:{title:clientName}}}}}});
  expect((await action.json()).result.structuredContent.data).toMatchObject({status:'succeeded',executionAuthority:'delegated'});
  if(javascript){
   await page.goto('/dashboard/assistant');
   const connection=page.getByRole('article').filter({has:page.getByRole('heading',{name:clientName,exact:true})}).first();
   await connection.getByRole('button',{name:'Require my review',exact:true}).click();
   await expect(page.getByRole('status')).toContainText('Direct actions are off');
   await connection.getByRole('button',{name:'Enable direct actions',exact:true}).click();
   await expect(page.getByRole('status')).toContainText('Direct actions are enabled');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
 }
 await fallback?.close();
});
