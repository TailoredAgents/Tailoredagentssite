import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill('local-owner@tailoredagents.com');
  await page.getByLabel('Password', { exact: true }).fill('Local browser test password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/inbox/);
}

async function observeImages(page: Page) {
  const requests: string[] = [];
  await page.route('https://images.example.invalid/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') });
  });
  return requests;
}

test('verified images load, tiny trackers stay blocked, and sender image choices survive reload', async ({ page }) => {
  const images = await observeImages(page);
  await signIn(page);
  await page.request.put('/api/mail/smart-verified/images', { headers: { Origin: 'http://localhost:8787' }, data: { mode: 'automatic' } });
  await page.goto('/inbox?thread=smart-verified');
  await expect(page.getByText('Domain verified', { exact: true })).toBeVisible();
  await expect.poll(() => images.filter(url => url.includes('banner')).length).toBeGreaterThan(0);
  expect(images.some(url => url.includes('tracking'))).toBe(false);
  await expect(page.frameLocator('iframe').locator('img')).toHaveCount(1);
  const saved = page.waitForResponse(response => response.url().endsWith('/smart-verified/images') && response.request().method() === 'PUT');
  await page.getByLabel('Images from this sender').selectOption('block');
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole('button', { name: /Show images/ })).toBeVisible();
  const count = images.length;
  await page.reload();
  await expect(page.getByLabel('Images from this sender')).toHaveValue('block');
  await expect(page.frameLocator('iframe').getByText('Your project update is ready.')).toBeVisible();
  expect(images.length).toBe(count);
  await page.getByLabel('Images from this sender').selectOption('automatic');
  await expect.poll(() => images.length).toBeGreaterThan(count);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/smart-inbox-phone.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unknown and junk messages require a choice; a saved preference cannot bypass failed authentication', async ({ page }) => {
  const images = await observeImages(page);
  await signIn(page);
  const headers = { Origin: 'http://localhost:8787' };
  await page.request.put('/api/mail/smart-unknown/images', { headers, data: { mode: 'automatic' } });
  await page.goto('/inbox?thread=smart-unknown');
  await expect(page.getByText('Sender not verified', { exact: true })).toBeVisible();
  await expect(page.frameLocator('iframe').getByText('Your project update is ready.')).toBeVisible();
  expect(images.length).toBe(0);
  await page.getByLabel('Images from this sender').selectOption('allow');
  await expect.poll(() => images.length).toBe(1);
  await page.reload();
  await expect(page.getByLabel('Images from this sender')).toHaveValue('allow');
  await expect.poll(() => images.length).toBe(2);
  await page.request.put('/api/mail/smart-failed/images', { headers, data: { mode: 'allow' } });
  await page.goto('/spam?thread=smart-failed');
  await expect(page.getByText('Sender authentication failed', { exact: true })).toBeVisible();
  await expect(page.getByText(/receiving server reported a failed domain authentication/)).toBeVisible();
  await expect(page.frameLocator('iframe').getByText('Your project update is ready.')).toBeVisible();
  expect(images.length).toBe(2);
  await page.getByRole('button', { name: /Show images/ }).click();
  await expect.poll(() => images.length).toBe(3);
  expect(images.some(url => url.includes('tracking'))).toBe(false);
});

test('links alone do not show an image warning and blocked senders are visible and removable', async ({ page }) => {
  await signIn(page);
  await page.goto('/inbox?thread=smart-links');
  await expect(page.frameLocator('iframe').getByRole('link', { name: 'our notes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Show images/ })).toHaveCount(0);
  await page.goto('/settings/general');
  await page.getByLabel('Email address', { exact: true }).fill('block-browser@example.net');
  await page.getByRole('button', { name: 'Block sender', exact: true }).click();
  const row = page.locator('.ta-inline').filter({ has: page.getByText('block-browser@example.net', { exact: true }) });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Unblock', exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await page.request.put('/api/mail/another-users-message/images', { headers: { Origin: 'http://localhost:8787' }, data: { mode: 'allow' } })).status()).toBe(404);
  expect((await page.request.put('/api/mail/smart-links/images', { headers: { Origin: 'http://localhost:8787' }, data: { mode: 'invalid' } })).status()).toBe(400);
});
