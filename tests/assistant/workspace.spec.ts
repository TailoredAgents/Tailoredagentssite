import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('workspace keeps a draft across sections and supports keyboard, mobile history and safe rich replies', async ({page}, testInfo) => {
  test.setTimeout(120000);
  await page.goto('/sign-in');
  await page.getByLabel('Team email').fill('owner@example.test');
  await page.getByLabel('Password', {exact:true}).fill('Reporting-test-password-2026');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/assistant');
  const chat = page.getByRole('region', {name:'Employee assistant'});
  const draft = chat.getByLabel('Message your assistant');
  await expect(chat.getByRole('heading',{name:/What’s on your mind/})).toBeVisible();
  await chat.getByRole('button',{name:/Review a prospect/}).click();
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue(/Help me review a prospect/);
  await draft.fill('Keep this unsent while I look at my work.');
  await page.getByRole('tab',{name:/My work/}).click();
  await expect(page.getByRole('heading',{name:'Needs your review',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Files',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your files & results'})).toBeVisible();
  await page.getByRole('tab',{name:'Activity',exact:true}).click();
  const log = page.locator('.assistant-access-log');
  await expect(log).not.toHaveAttribute('open');
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Connections & permissions',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Assistant notifications'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('tab',{name:'Settings',exact:true}).press('Home');
  await expect(page.getByRole('tab',{name:'Chat',exact:true})).toBeFocused();
  await expect(draft).toHaveValue('Keep this unsent while I look at my work.');
  await page.goBack();
  await expect(page.getByRole('tab',{name:'Settings',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'Chat',exact:true}).click();
  if(testInfo.project.name==='phone') {
    await chat.getByRole('button',{name:'Conversations',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Conversations',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(chat.getByRole('button',{name:'Conversations',exact:true})).toBeFocused();
  }
  const violations = (await new AxeBuilder({page}).include('.assistant-workspace').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await draft.fill('');
  await page.screenshot({path:testInfo.outputPath('assistant-workspace.png'),fullPage:false});

  // Simulated read response: formatting cannot turn provider text into script or unsafe links.
  const sourceState = await (await page.request.get('/api/assistant/chat')).json();
  await page.route('**/api/assistant/chat?thread=*', async route => {
    const state = {...sourceState};
    state.turns=[{id:'11111111-1111-4111-8111-111111111111',user_message:'Review the plan.',assistant_message:'## Next steps\n\n**A clear plan**\n\n- Review the brief\n- [Open clients](/dashboard/clients)\n\n<script>window.unsafeAssistant=true</script>\n[Unsafe](javascript:alert(1))\n\n# \n- \n1. ',status:'completed',activity:[],created_at:new Date().toISOString()}];
    await route.fulfill({status:200,json:state});
  });
  await page.goto('/dashboard/assistant?thread=11111111-1111-4111-8111-111111111111');
  await expect(chat.getByRole('heading',{name:'Next steps',exact:true})).toBeVisible();
  await expect(chat.getByRole('link',{name:'Open clients',exact:true})).toHaveAttribute('href','/dashboard/clients');
  await expect(chat.getByRole('link',{name:'Unsafe',exact:true})).toHaveCount(0);
  await expect(chat.locator('.assistant-message-body script')).toHaveCount(0);
  await expect(chat.getByText('<script>window.unsafeAssistant=true</script>',{exact:false})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('assistant-conversation.png'),fullPage:false});
});
