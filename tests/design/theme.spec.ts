import { test, expect, type Page } from "@playwright/test";

test.skip(process.env.DESIGN_CAPTURE_PHASE === "before", "Appearance preferences postdate the baseline.");
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function themeColors(page: Page) {
  return page.locator(".dashboard-theme").evaluate(element => ({ background: getComputedStyle(element).backgroundColor, scheme: getComputedStyle(element).colorScheme }));
}

test("appearance choices persist through reload, navigation and server rendering", async ({ page }) => {
  await signIn(page); await page.goto("/dashboard/settings");
  const appearance = page.getByRole("group", { name: "Dashboard appearance", exact: true });
  await appearance.getByRole("button", { name: /^Dark / }).click();
  await expect(page.locator(".dashboard-theme")).toHaveAttribute("data-theme", "dark");
  await expect(appearance.getByRole("button", { name: /^Dark / })).toHaveAttribute("aria-pressed", "true");
  expect(await themeColors(page)).toEqual({ background: "rgb(17, 24, 39)", scheme: "dark" });
  const response = await page.request.get("/dashboard/clients");
  expect(await response.text()).toContain('class="dashboard-theme" data-theme="dark"');
  await page.reload(); await expect(appearance.getByRole("button", { name: /^Dark / })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/dashboard/projects"); expect((await themeColors(page)).background).toBe("rgb(17, 24, 39)");
  const cookie = (await page.context().cookies()).find(cookie => cookie.name === "ta-dashboard-theme");
  expect(cookie).toMatchObject({ value: "dark", path: "/", sameSite: "Lax" }); expect(cookie!.expires).toBeGreaterThan(Date.now()/1000 + 300*86400);
  await page.getByRole("link", { name: "Tailored Agents website", exact: true }).click();
  await expect(page).toHaveURL(/\/$/); await expect(page.locator(".dashboard-theme")).toHaveCount(0);
  expect(await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(247, 249, 252)");
});

test("system follows appearance changes while an explicit light choice stays light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" }); await signIn(page); await page.goto("/dashboard/settings");
  const appearance = page.getByRole("group", { name: "Dashboard appearance", exact: true });
  await appearance.getByRole("button", { name: /^System / }).click();
  expect((await themeColors(page)).background).toBe("rgb(226, 232, 240)");
  await page.emulateMedia({ colorScheme: "dark" }); expect((await themeColors(page)).background).toBe("rgb(17, 24, 39)");
  await appearance.getByRole("button", { name: /^Light / }).click();
  expect((await themeColors(page)).background).toBe("rgb(226, 232, 240)");
  await page.reload(); expect((await themeColors(page)).background).toBe("rgb(226, 232, 240)");
});

test("sidebar appearance changes preserve unsaved page input and theme the phone", async ({ page }, info) => {
  await signIn(page); await page.goto("/dashboard/leads");
  const search = page.getByRole("searchbox", { name: "Search leads", exact: true }); await search.fill("Unsaved color preference check");
  if (info.project.name === "phone") await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  if (info.project.name === "phone") await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await expect(search).toHaveValue("Unsaved color preference check");
  await page.getByRole("button", { name: /^Open browser phone/ }).click();
  const phone = page.locator(".voice-phone-panel"); await expect(phone).toBeVisible();
  expect(await phone.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(27, 38, 56)");
});

test("saved dark colors render before JavaScript and malformed values fall back to slate", async ({ page, browser }) => {
  await signIn(page); await page.context().addCookies([{ name: "ta-dashboard-theme", value: "dark", domain: "127.0.0.1", path: "/" }]);
  const context = await browser.newContext({ storageState: await page.context().storageState(), javaScriptEnabled: false });
  try {
    const serverPage = await context.newPage(); await serverPage.goto(new URL("/dashboard/settings", page.url()).href);
    await expect(serverPage.locator(".dashboard-theme")).toHaveAttribute("data-theme", "dark");
    expect((await themeColors(serverPage)).background).toBe("rgb(17, 24, 39)");
  } finally { await context.close(); }
  await page.context().addCookies([{ name: "ta-dashboard-theme", value: "unknown-theme", domain: "127.0.0.1", path: "/" }]);
  await page.reload(); await expect(page.locator(".dashboard-theme")).toHaveAttribute("data-theme", "light");
  expect((await themeColors(page)).background).toBe("rgb(226, 232, 240)");
});
