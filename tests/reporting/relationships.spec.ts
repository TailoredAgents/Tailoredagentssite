import {randomUUID} from 'node:crypto';
import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {Pool} from 'pg';

const databaseUrl=process.env.REPORTING_TEST_DATABASE_URL||'postgresql://ta_test@127.0.0.1:55443/ta_reporting_browser_test';
const parsed=new URL(databaseUrl);
if(!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/ta_reporting_browser_test')throw new Error('Use only the isolated browser-test database.');
async function sql(query:string,values:unknown[]=[]){const pool=new Pool({connectionString:databaseUrl,max:1});try{return await pool.query(query,values);}finally{await pool.end();}}
async function signIn(page:Page,viewer=false){await page.goto('/sign-in');await page.getByLabel('Team email').fill(viewer?'viewer@example.test':'owner@example.test');await page.getByLabel('Password',{exact:true}).fill('Reporting-test-password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);}
async function fixture(label:string){const id=randomUUID();await sql("INSERT INTO leads(id,workspace_id,name,organization,email,phone,source,owner_user_id) VALUES($1,'00000000-0000-4000-8000-000000000001',$2,'',NULL,'+17705550191','manual','preview-owner')",[id,label]);return id;}
test.use({timezoneId:'America/Los_Angeles'});
test('relationship handoff stays connected from creation through My day and completion',async({page},info)=>{
 const name=`Relationship browser ${info.project.name}`,id=await fixture(name);await signIn(page);await page.goto(`/dashboard/leads/${id}`);
 await page.getByRole('link',{name:/Open relationship overview/}).click();await expect(page).toHaveURL(new RegExp('/dashboard/relationships/lead/'+id+'$'));await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 await page.getByLabel('Next action',{exact:true}).fill('Prepare document workflow discovery');await page.getByLabel('Responsible teammate').selectOption('preview-owner');await page.getByLabel('Due by',{exact:true}).fill('2026-11-12T10:00');await page.getByLabel('Context for your teammate').fill('Met at a business meetup. Confirm volume; no scope agreed.');
 await page.getByRole('button',{name:'Create handoff',exact:true}).click();await expect(page.getByText('Handoff saved. It is waiting for your teammate to accept.')).toBeVisible();
 expect((await sql('SELECT status,due_at FROM crm_relationship_handoffs WHERE lead_id=$1',[id])).rows).toMatchObject([{status:'pending',due_at:new Date('2026-11-12T15:00:00Z')}]);
 await page.screenshot({path:info.outputPath('relationship-desktop-or-phone.png'),fullPage:true});
 const axe=await new AxeBuilder({page}).include('.relationship-workspace').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.goto('/dashboard/sales/today');const card=page.locator('.relationship-handoff').filter({hasText:'Prepare document workflow discovery'}).last();await card.getByRole('button',{name:'Accept handoff'}).click();await expect(card.getByText('accepted',{exact:true})).toBeVisible();
 await card.getByText('Complete handoff',{exact:true}).click();await card.getByLabel('What happened?').fill('Discovery questions ready for the appointment.');await card.getByRole('button',{name:'Mark completed'}).click();await expect(card).toHaveCount(0);
 await page.goto(`/dashboard/relationships/lead/${id}`);await page.getByText('Completed & cancelled handoffs · 1',{exact:true}).click();await expect(page.getByText('completed',{exact:true}).first()).toBeVisible();await page.getByText('Handoff history',{exact:true}).click();await expect(page.getByText('Discovery questions ready for the appointment.',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Open conversations'})).toHaveAttribute('href',`/dashboard/inbox?lead=${id}`);
});
test('viewer can read but cannot create, accept or complete handoffs',async({page},info)=>{
 const id=await fixture(`Viewer relationship ${info.project.name}`);await signIn(page,true);await page.goto(`/dashboard/relationships/lead/${id}`);await expect(page.getByRole('button',{name:'Create handoff',exact:true})).toBeDisabled();await expect(page.getByLabel('Next action',{exact:true})).toBeDisabled();
});
test('unauthenticated relationship URLs do not reveal customer data',async({page},info)=>{
 const id=await fixture(`Private relationship ${info.project.name}`);await page.goto(`/dashboard/relationships/lead/${id}`);await expect(page).toHaveURL(/\/sign-in/);await expect(page.getByRole('heading',{name:`Private relationship ${info.project.name}`})).toHaveCount(0);
});
