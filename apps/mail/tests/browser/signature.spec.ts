import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const png=readFileSync(new URL('../fixtures/signature-banner.png',import.meta.url));
const jpg=readFileSync(new URL('../fixtures/signature-banner.jpg',import.meta.url));
const headers={Origin:'http://localhost:8787'};
async function signIn(page:Page,email='local-owner@tailoredagents.com'){
 await page.goto('/login');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill('Local browser test password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/inbox/);
}

test('banner editor saves, previews, replaces and removes images with private desktop and phone access',async({page,browser})=>{
 await signIn(page);
 expect((await page.request.patch('/api/settings/signature',{headers,data:{signature:'',banner:null}})).status()).toBe(200);
 await page.goto('/settings/general');await page.getByLabel('Signature text',{exact:true}).fill('Alex Morgan\nTailored Agents');
 const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload banner',exact:true}).click();
 await (await chooserPromise).setFiles({name:'banner.png',mimeType:'image/png',buffer:png});
 await page.getByLabel('Image description',{exact:true}).fill('Tailored Agents test banner');
 await page.getByLabel('Banner link (optional)',{exact:true}).fill('https://tailoredagents.com');
 await expect.poll(()=>page.locator('.signature-preview img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1200);
 await page.getByRole('button',{name:'Save signature',exact:true}).click();await expect(page.getByRole('status')).toContainText('Signature saved.');
 const saved=await (await page.request.get('/api/settings/signature')).json();expect(saved.banner.width).toBe(1200);
 const url='/api/settings/signature/banner/'+saved.banner.id;
 const file=await page.request.get(url);expect(file.status()).toBe(200);expect(await file.body()).toEqual(png);
 expect(file.headers()['content-type']).toBe('image/png');expect(file.headers()['x-content-type-options']).toBe('nosniff');
 await page.reload();await expect(page.getByLabel('Signature text',{exact:true})).toHaveValue('Alex Morgan\nTailored Agents');
 await expect.poll(()=>page.locator('.signature-preview img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1200);
 await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'test-results/signature-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 expect(await page.locator('.signature-preview img').evaluate(img=>img.getBoundingClientRect().right<=window.innerWidth)).toBe(true);
 await page.locator('.signature-preview').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/signature-phone.png',fullPage:true});

 const context=await browser.newContext();const other=await context.newPage();
 expect((await context.request.get('http://localhost:8787'+url)).status()).toBe(401);
 await signIn(other,'local-teammate@tailoredagents.com');expect((await other.request.get(url)).status()).toBe(404);
 expect((await other.request.patch('/api/settings/signature',{headers,data:{signature:'Teammate',banner:{filename:'mine.jpg',content:jpg.toString('base64')}}})).status()).toBe(200);
 expect((await (await other.request.get('/api/settings/signature')).json()).signature).toBe('Teammate');
 expect((await (await page.request.get('/api/settings/signature')).json()).signature).toBe('Alex Morgan\nTailored Agents');
 expect((await page.request.patch('/api/settings/signature',{headers:{Origin:'https://attacker.example'},data:{signature:'forged',banner:null}})).status()).toBe(403);
 expect((await page.request.patch('/api/settings/signature',{headers,data:{signature:'oversized',banner:{filename:'big.png',content:'A'.repeat(2*1024*1024)}}})).status()).toBe(413);

 await page.getByLabel('Upload signature banner').setInputFiles({name:'banner.jpg',mimeType:'image/jpeg',buffer:jpg});
 await page.getByRole('button',{name:'Save signature',exact:true}).click();await expect(page.getByRole('status')).toContainText('Signature saved.');
 const replaced=await (await page.request.get('/api/settings/signature')).json();expect(replaced.banner.id).not.toBe(saved.banner.id);
 expect((await page.request.get(url)).status()).toBe(404);
 await page.getByRole('button',{name:'Remove banner',exact:true}).click();await page.getByRole('button',{name:'Save signature',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Signature saved.');await page.reload();await expect(page.locator('.signature-preview img')).toHaveCount(0);
 expect((await (await page.request.get('/api/settings/signature')).json()).banner).toBeNull();
 await other.request.patch('/api/settings/signature',{headers,data:{signature:'',banner:null}});
 await page.request.patch('/api/settings/signature',{headers,data:{signature:'',banner:null}});
 await context.close();
});
