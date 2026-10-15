import {test,expect,type Page} from '@playwright/test';
async function signIn(page:Page,email='local-owner@tailoredagents.com'){
 await page.goto('/login');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill('Local browser test password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/inbox/);
}
test('private messages, drafts, attachments, search and owner screens reject another account',async({page,browser})=>{
 await signIn(page);const origin='http://localhost:8787';
 const draft=await page.request.post('/api/drafts',{headers:{Origin:origin},data:{id:'browser-private-draft',to:'friend@example.net',subject:'Private test draft',text:'private-needle',attachments:[{filename:'private.txt',type:'text/plain',content:'cHJpdmF0ZQ=='}]}});expect(draft.status()).toBe(200);
 const context=await browser.newContext();const other=await context.newPage();await signIn(other,'local-teammate@tailoredagents.com');
 for(const url of ['/api/mail/local-message-1','/api/drafts/browser-private-draft','/api/mail/local-message-1/attachments/local-dangerous-file'])expect((await other.request.get(url)).status()).toBe(404);
 for(const url of ['/admin','/admin/unassigned','/api/admin/users'])expect((await other.request.get(url)).status()).toBe(403);
 const search=await other.request.get('/api/mail?q=private-needle');expect((await search.json()).total).toBe(0);
 expect((await other.request.post('/api/drafts',{headers:{Origin:origin},data:{id:'browser-private-draft',text:'overwrite'}})).status()).toBe(400);
 expect((await page.request.post('/api/drafts',{headers:{Origin:'https://attacker.example'},data:{text:'cross-site'}})).status()).toBe(403);
 for(const url of ['/mcp','/api/apikeys','/api/auth/pair','/api/settings/ai'])expect((await page.request.get(url)).status()).toBe(404);
 expect((await page.request.post('/api/setup',{headers:{Origin:origin},data:{}})).status()).toBe(403);
 await context.close();
});
test('desktop compose saves and reopens text and files, including after failed sending',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await signIn(page);
 await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'Compose',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.locator('input').first().fill('friend@example.net');
 const subject='Browser draft '+Date.now();await dialog.getByPlaceholder('Subject',{exact:true}).fill(subject);
 await dialog.locator('[contenteditable="true"]').fill('This draft should survive closing.');
 await dialog.locator('input[type="file"]').setInputFiles({name:'saved-note.txt',mimeType:'text/plain',buffer:Buffer.from('Saved attachment')});
 await expect(dialog.getByText('Saved',{exact:true})).toBeVisible({timeout:15000});
 const drafts=await (await page.request.get('/api/mail?view=drafts')).json();
 const row=drafts.threads.find((d:any)=>d.subject===subject);
 expect(row).toBeTruthy();
 await dialog.getByRole('button',{name:'Close',exact:true}).first().click();
 await page.goto('/inbox?compose=1&draft='+row.latest_id);
 await expect(page.getByRole('dialog').locator('[contenteditable="true"]')).toContainText('This draft should survive closing.');
 await expect(page.getByText('saved-note.txt',{exact:true})).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:/^Send/}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 const saved=await page.request.get('/api/drafts/'+row.latest_id);expect(saved.status()).toBe(200);expect((await saved.json()).attachments[0].filename).toBe('saved-note.txt');expect(errors).toEqual([]);
});
test('desktop reading and phone navigation fit the screen',async({page})=>{
 await signIn(page);await page.setViewportSize({width:1440,height:960});await page.getByText('Your workspace is ready',{exact:true}).click();await expect(page.frameLocator('iframe').getByText('Welcome to Tailored Agents Mail.',{exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/desktop-inbox.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto('/inbox');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.getByText('Your workspace is ready',{exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await expect(page.frameLocator('iframe').getByText('Welcome to Tailored Agents Mail.',{exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/phone-inbox.png',fullPage:true,animations:'disabled'});
});
test('received HTML cannot run scripts or forms and external images require permission',async({page})=>{
 let trackers=0;await page.route('https://tracker.invalid/**',route=>{trackers++;return route.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')});});
 await signIn(page);await page.getByText('Your workspace is ready',{exact:true}).click();
 const frame=page.frameLocator('iframe');await expect(frame.getByText('Welcome to Tailored Agents Mail.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).emailExecuted)).toBeUndefined();expect(await frame.locator('script,form,input').count()).toBe(0);expect(trackers).toBe(0);
 const file=await page.request.get('/api/mail/local-message-1/attachments/local-dangerous-file');expect(file.status()).toBe(200);expect(file.headers()['content-disposition']).toMatch(/^attachment;/);expect(file.headers()['content-security-policy']).toContain('sandbox');
 await page.getByRole('button',{name:/Show images/}).click();await expect.poll(()=>trackers).toBe(1);
});
test('replies retain their text, files and conversation when reopened from Drafts',async({page})=>{
 await signIn(page);await page.getByText('Proposal for Friday’s meeting',{exact:true}).click();await page.locator('.z-msg-actions').getByRole('button',{name:/^Reply /}).first().click();
 const reply=page.locator('form.z-reply');const text='Saved reply '+Date.now();await reply.locator('[contenteditable="true"]').fill(text);
 await reply.locator('input[type="file"]').setInputFiles({name:'reply-note.txt',mimeType:'text/plain',buffer:Buffer.from('Reply file')});
 await expect(reply.getByText('Saved to Drafts',{exact:true})).toBeVisible({timeout:15000});
 const listing=await (await page.request.get('/api/mail?view=drafts')).json();const row=listing.threads.find((d:any)=>d.preview===text);expect(row).toBeTruthy();
 const draft=await (await page.request.get('/api/drafts/'+row.latest_id)).json();expect(draft.context).toMatchObject({mode:'reply',targetId:'local-message-2'});
 await reply.getByRole('button',{name:'Close',exact:true}).click();await page.goto('/inbox?compose=1&draft='+row.latest_id);
 await expect(page.getByRole('dialog').locator('[contenteditable="true"]')).toContainText(text);await expect(page.getByText('reply-note.txt',{exact:true})).toBeVisible();
});
test('keyboard focus stays in Compose and dark mode fits the inbox',async({page})=>{
 await signIn(page);await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'Your account'}).click();await page.getByRole('button',{name:'Switch light / dark'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByText('Your workspace is ready',{exact:true}).click();await expect(page.frameLocator('iframe').getByText('Welcome to Tailored Agents Mail.',{exact:false})).toBeVisible();await page.screenshot({path:'test-results/dark-inbox.png',fullPage:true});
 await page.getByRole('button',{name:'Compose',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 for(let i=0;i<30;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);}
 await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).first().click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('owner resets end existing sessions, require a new password, and disabling blocks access',async({page,browser})=>{
 await signIn(page);const headers={Origin:'http://localhost:8787'},part='browser-'+Date.now(),password='A temporary browser password';
 const response=await page.request.post('/api/admin/users',{headers,data:{name:'Browser Test',localPart:part,domainId:'local-domain',password}});expect(response.status()).toBe(201);const {user}=await response.json();
 const context=await browser.newContext();const other=await context.newPage();await other.goto('/login');
 const login=()=>other.request.post('/api/auth/login',{headers,data:{email:part+'@tailoredagents.com',password}});
 expect((await login()).status()).toBe(200);expect((await other.request.get('/api/mail')).status()).toBe(403);await other.goto('/inbox');await expect(other).toHaveURL(/\/account\/setup/);
 expect((await other.request.post('/api/auth/complete-setup',{headers,data:{name:'Browser Test',password:'My chosen browser password',confirmPassword:'My chosen browser password'}})).status()).toBe(200);
 expect((await other.request.post('/api/auth/login',{headers,data:{email:part+'@tailoredagents.com',password:'My chosen browser password'}})).status()).toBe(200);expect((await other.request.get('/api/mail')).status()).toBe(200);
 expect((await page.request.patch('/api/admin/users/'+user.id,{headers,data:{password}})).status()).toBe(200);expect((await other.request.get('/api/mail')).status()).toBe(401);
 expect((await login()).status()).toBe(200);expect((await other.request.get('/api/mail')).status()).toBe(403);
 expect((await page.request.patch('/api/admin/users/'+user.id,{headers,data:{disabled:true}})).status()).toBe(200);expect((await other.request.get('/api/mail')).status()).toBe(401);expect((await login()).status()).toBe(401);await context.close();
});
test('a 20 MB draft attachment saves in Workers and larger totals show a clear warning',async({page})=>{
 test.setTimeout(60000);await signIn(page);await page.getByRole('button',{name:'Compose',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('To',{exact:true}).fill('friend@example.net');await dialog.getByPlaceholder('Subject',{exact:true}).fill('Large file '+Date.now());await dialog.locator('[contenteditable="true"]').fill('A full-size attachment.');
 await dialog.locator('input[type="file"]').setInputFiles({name:'twenty-megabytes.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(20*1024*1024,65)});
 await expect(dialog.getByText('twenty-megabytes.bin',{exact:true})).toBeVisible();await expect(dialog.getByText('Saved',{exact:true})).toBeVisible({timeout:30000});
 await dialog.locator('input[type="file"]').setInputFiles({name:'too-much.txt',mimeType:'text/plain',buffer:Buffer.from('x')});await expect(dialog.getByText('Keep attachments at or below 20 MB in total.')).toBeVisible();
 await dialog.getByRole('button',{name:'Close',exact:true}).first().click();await expect(dialog).toHaveCount(0);
});
