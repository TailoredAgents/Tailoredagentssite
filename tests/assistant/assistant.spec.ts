import {test,expect} from '@playwright/test';
import {createHash,randomBytes} from 'node:crypto';

for(const javascript of [true,false])test(`human OAuth consent returns a usable code (${javascript?'interactive':'plain form'})`,async({page,browser,request,baseURL})=>{
 test.setTimeout(120000);
 const callback='https://chatgpt.com/connector_platform/oauth/callback';
 const verifier=randomBytes(32).toString('base64url');
 const registration=await request.post('/oauth/operations/register',{data:{client_name:'Browser test assistant',redirect_uris:[callback]}});
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
 const query=new URLSearchParams({client_id:client.client_id,redirect_uri:callback,response_type:'code',resource,scope:'operations:read personal:read',state:'browser-consent-test',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
 await page.goto('/oauth/operations/authorize?'+query);
 await expect(page.getByRole('heading',{name:'Connect your assistant'})).toBeVisible();
 const posted=page.waitForRequest(r=>r.url().endsWith('/oauth/operations/consent')&&r.method()==='POST');
 await page.getByRole('button',{name:'Allow selected access'}).click();
 expect((await posted).headers().origin).toBe(baseURL);
 if(!javascript)await page.getByRole('link',{name:'Continue to your assistant'}).click();
 await expect(page).toHaveURL(new RegExp('^https://chatgpt.com/connector_platform/oauth/callback'));
 const returned=new URL(page.url());expect(returned.searchParams.get('state')).toBe('browser-consent-test');expect(callbackReferrer).toBeUndefined();
 const tokens=await request.post('/oauth/operations/token',{form:{grant_type:'authorization_code',client_id:client.client_id,code:returned.searchParams.get('code')!,redirect_uri:callback,code_verifier:verifier,resource}});
 expect(tokens.status()).toBe(200);
 const credentials=await tokens.json();expect(credentials.scope).toBe('operations:read');
 const identity=await request.post('/api/mcp/operations',{headers:{authorization:'Bearer '+credentials.access_token,accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'whoami',arguments:{}}}});
 expect((await identity.json()).result.structuredContent.data.user.email).toBe('owner@example.test');
 await fallback?.close();
});
