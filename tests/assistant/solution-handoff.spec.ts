import {test,expect} from '@playwright/test';
test.setTimeout(60000);
test('a solution handoff fills an editable assistant request without sending it',async({page})=>{
 await page.goto('/sign-in');await page.getByLabel('Team email').fill('owner@example.test');await page.getByLabel('Password',{exact:true}).fill('Reporting-test-password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/,{timeout:20000});
 let posts=0;page.on('request',r=>{if(r.url().includes('/api/assistant/chat')&&r.method()==='POST')posts++;});
 const id='00000000-0000-4000-8000-000000000317';await page.goto('/dashboard/assistant?relationship=lead%3A'+id);
 await expect(page.getByLabel('Message your assistant')).toHaveValue(new RegExp(id));expect(posts).toBe(0);
 await expect(page.getByLabel('Message your assistant')).toHaveValue(/do not mark it reviewed, start a website build, contact anyone, or run paid external research/);
});
