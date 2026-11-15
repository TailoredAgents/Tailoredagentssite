import {randomUUID} from 'node:crypto';
import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {Pool} from 'pg';
const url=process.env.REPORTING_TEST_DATABASE_URL||'postgresql://ta_test@127.0.0.1:55469/ta_reporting_browser_test';
const parsed=new URL(url);if(!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/ta_reporting_browser_test')throw new Error('Only the isolated browser-test database is allowed.');
async function sql(query:string,values:unknown[]=[]){const db=new Pool({connectionString:url,max:1});try{return await db.query(query,values);}finally{await db.end();}}
async function login(page:Page,viewer=false){await page.goto('/sign-in');await page.getByLabel('Team email').fill(viewer?'viewer@example.test':'owner@example.test');await page.getByLabel('Password',{exact:true}).fill('Reporting-test-password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);}
test('prepares a mixed invoice, reviews it and simulates without sending or posting',async({page},info)=>{
 const id=randomUUID(),name=`Synthetic finance ${info.project.name}`;
 await sql("INSERT INTO clients(id,workspace_id,name) VALUES($1,'00000000-0000-4000-8000-000000000001',$2)",[id,name]);
 await login(page);await page.goto('/dashboard/partners');await page.getByRole('link',{name:/Agreements, referral decisions/}).click();await expect(page.getByRole('heading',{name:'Agreements & billing'})).toBeVisible();
 await page.getByRole('link',{name:'Invoice draft',exact:true}).click();
 const form=page.getByRole('form',{name:'Save draft',exact:true});await expect(form.getByLabel('Billing email')).toBeVisible();
 await form.getByLabel('Document title').fill('Synthetic setup and support');await form.getByRole('combobox',{name:'Client',exact:true}).selectOption(id);await form.getByLabel('Payment due').fill('2026-12-01');await form.getByLabel('Billing email').fill('billing@example.test');
 await form.getByLabel('Description',{exact:true}).fill('Synthetic monthly support');await form.getByLabel('Line total (USD)').fill('123.45');await form.getByLabel('Service start').fill('2026-11-01');await form.getByLabel('Service end').fill('2026-11-30');
 await form.getByRole('button',{name:'Add invoice line'}).click();await form.getByLabel('Description',{exact:true}).nth(1).fill('Synthetic one-time setup');await form.getByLabel('Revenue category').nth(1).selectOption('upfront');await form.getByLabel('Line total (USD)').nth(1).fill('50');
 await form.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page).toHaveURL(/\/dashboard\/finance\/[a-f0-9-]+$/);await expect(page.getByRole('heading',{name:'Synthetic setup and support'})).toBeVisible();await expect(page.getByText('Total $173.45')).toBeVisible();
 const review=page.getByRole('form',{name:'Save review'});await review.getByLabel('Evidence / document reference and reason').fill('Synthetic arithmetic and service dates checked');await review.getByLabel('I reviewed this exact version').check();await review.getByRole('button',{name:'Save review'}).click();await expect(page.getByText('reviewed · invoice',{exact:true})).toBeVisible();
 await page.getByLabel('Calculate through').fill('2026-11-30');await page.getByLabel('Collection date').fill('2026-11-01');await page.getByLabel('Collected amount (USD)',{exact:true}).fill('173.45');await page.getByLabel('Assume funds cleared').check();await page.getByRole('button',{name:'Calculate scenario',exact:true}).click();await expect(page.getByText('Hypothetical scenario only.',{exact:false})).toBeVisible();
 expect(Number((await sql("SELECT count(*) FROM crm_referral_earnings WHERE workspace_id='00000000-0000-4000-8000-000000000001'")).rows[0].count)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const axe=await new AxeBuilder({page}).include('.dashboard-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
 await page.screenshot({path:info.outputPath('commercial-invoice.png'),fullPage:true});
});
test('finance access is required even when the route is known',async({page})=>{
 await login(page,true);const response=await page.goto('/dashboard/finance');expect(response?.status()).toBe(404);await expect(page.getByRole('heading',{name:'Agreements & billing'})).toHaveCount(0);
});
