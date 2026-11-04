import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
const path='/solutions/commercial-insurance';
test.beforeEach(async({page})=>{
 // The production server accepts only the canonical website Origin. This harness
 // forwards that header to the isolated loopback server; never to production.
 await page.route('**/api/smart-cards/**',async route=>{
  if(route.request().url().includes('/chat'))return route.fulfill({json:{answer:'We can discuss submission preparation and assess your current systems during a workflow review.',draft:null}});
  const response=await route.fetch({headers:{...route.request().headers(),origin:'https://www.tailoredagents.com'}});
  await route.fulfill({response});
 });
});
for(const person of ['austin','jeffrey'])test(`${person}: example, calculator, AI and shared-calendar booking`,async({page},info)=>{
 test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${path}?person=${person}&card=insurance-${person}&via=qr`);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Stop rebuildingsubmissionsby hand.');
 const name=person==='austin'?'Austin Dugger':'Jeffrey Hacker';
 await expect(page.getByAltText(`Portrait of ${name}`)).toBeVisible();
 await expect(page.getByRole('link',{name:`${person}@tailoredagents.com`})).toHaveAttribute('href',`mailto:${person}@tailoredagents.com`);
 await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content',new RegExp(`share-image\\?card=insurance-${person}`));
 await expect(page.locator('.ins-estimate-number')).toContainText('20');
 await page.getByLabel('Files handled per month',{exact:true}).fill('120');
 await expect(page.locator('.ins-estimate-number')).toContainText('40');
 await page.getByLabel('Assisted minutes per file, including review').fill('40');
 await expect(page.locator('.ins-estimate')).toContainText('Additional processing time');
 await page.getByLabel('Assisted minutes per file, including review').fill('10');
 await page.getByRole('button',{name:'02 Check the details'}).click();
 await expect(page.getByText('Payroll values conflict',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'See the prepared packet'}).click();
 await expect(page.getByText('ILLUSTRATIVE FOLLOW-UP DRAFT · NOT SENT')).toBeVisible();
 await page.getByRole('button',{name:'What happens in the workflow review?'}).click();
 await expect(page.getByText('We can discuss submission preparation and assess your current systems during a workflow review.')).toBeVisible();
 await page.getByRole('button',{name:`Meet with ${person==='austin'?'Austin':'Jeffrey'}`,exact:true}).click();
 const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 await page.getByLabel('Appointment date (Eastern time)').fill(date);
 const select=page.getByRole('combobox',{name:'Available consultation',exact:true});
 await expect(async()=>expect(await select.locator('option').count()).toBeGreaterThan(1)).toPass({timeout:15000});
 await expect(select).toBeEnabled();
 await select.selectOption({index:1});
 await page.locator('.ins-booking').screenshot({path:`/private/tmp/ta-insurance-form-${info.project.name}.png`});
 await page.getByLabel('Your name',{exact:true}).fill(`Synthetic Insurance ${person} ${info.project.name}`);
 await page.getByLabel('Email',{exact:true}).fill(`insurance-${person}-${info.project.name}@example.test`);
 await page.getByRole('textbox',{name:'Phone (required for your call)',exact:true}).fill('+16785550123');
 await page.getByLabel('Tailored Agents may contact me').check();
 await page.getByRole('button',{name:'Confirm phone consultation',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your consultation is booked.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(accessibility.violations.map(v=>({id:v.id,description:v.description,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 expect(errors).toEqual([]);
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`/private/tmp/ta-insurance-${person}-${info.project.name}.png`,fullPage:true});
 await page.screenshot({path:`/private/tmp/ta-insurance-hero-${person}-${info.project.name}.png`});
 await page.locator('.ins-demo').screenshot({path:`/private/tmp/ta-insurance-demo-${info.project.name}.png`});
 const other=person==='austin'?'Jeffrey':'Austin';
 await page.getByRole('link',{name:other,exact:true}).click();
 await expect(page.getByRole('heading',{name:`Review your workflow with ${other}`,exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your consultation is booked.'})).toHaveCount(0);
 await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('');
});
test('unavailable campaign does not fall back to a different destination',async({page})=>{
 expect((await page.goto(`${path}?person=austin&card=austin-personal`))?.status()).toBe(404);
 expect((await page.goto(`${path}?person=unknown`))?.status()).toBe(404);
 await page.goto(`${path}?person=austin&card=insurance-jeffrey`);
 await expect(page.getByRole('heading',{name:'Jeffrey Hacker',exact:true})).toBeVisible();
});

test('personalized share images, QR downloads and contact files',async({request})=>{
 for(const person of ['austin','jeffrey']){
  const image=await request.get(`${path}/share-image?card=insurance-${person}`);expect(image.status()).toBe(200);
  const bytes=await image.body();const size=await sharp(bytes).metadata();expect([size.width,size.height]).toEqual([1200,630]);
  await writeFile(`/private/tmp/ta-insurance-share-${person}.png`,bytes);
  const qr=await request.get(`/api/smart-cards/qr/insurance-${person}?format=png`);expect(qr.status()).toBe(200);expect(qr.headers()['content-type']).toBe('image/png');
  await writeFile(`/private/tmp/ta-insurance-qr-${person}.png`,await qr.body());
  expect(await (await request.get(`/c/${person}/contact`)).text()).toContain(`${person}@tailoredagents.com`);
  const redirect=await request.get(`/go/insurance-${person}?via=qr`,{maxRedirects:0});expect(redirect.status()).toBe(307);
  const location=new URL(redirect.headers().location);expect(location.pathname).toBe(path);expect(location.searchParams.get('utm_campaign')).toBe('commercial-insurance');
 }
});
test('dashboard exposes campaign reporting and copyable flyer URLs',async({page},info)=>{
 await page.goto('/sign-in');
 await page.getByLabel('Team email').fill('owner@example.test');
 await page.getByLabel('Password',{exact:true}).fill('Reporting-test-password-2026');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL('**/dashboard');
 await page.goto('/dashboard/smart-cards');
 await expect(page.getByRole('heading',{name:'Commercial insurance campaign',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Permanent flyer QR URL'})).toHaveCount(2);
 await expect(page.getByRole('link',{name:'Flyer QR PNG',exact:true})).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByRole('heading',{name:'Commercial insurance campaign',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:`/private/tmp/ta-insurance-dashboard-${info.project.name}.png`});
});
