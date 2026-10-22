import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dashboardPreviewPath } from "../dashboard-theme-state";
async function control(request: APIRequestContext, action: string) {
  const response = await request.post("http://127.0.0.1:3171/control", {
    headers: { authorization: "Bearer seo-synthetic-control" },
    data: { action },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function step(request: APIRequestContext) {
  await control(request, "due");
  const r = await request.post("/api/cron/seo", {
    headers: {
      authorization: "Bearer seo-browser-local-worker-secret-1234567890",
    },
  });
  expect(r.status()).toBe(200);
  return r.json();
}
async function signIn(page: Page, role = "owner") {
  page.setDefaultTimeout(25000);
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(`${role}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Seo-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/seo");
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}
test.beforeEach(async ({ request }) => {
  await control(request, "reset");
});
test("scans, plans, reviews, publishes, verifies and rolls back actual public metadata", async ({
  page,
  request,
}, info) => {
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "SEO manager", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Monthly AI & data limit ($)")).toHaveValue(
    "40",
  );
  await expect(page.getByLabel("Local service areas")).toContainText(
    "Woodstock",
  );
  await page
    .getByRole("button", { name: "Queue website scan", exact: true })
    .click();
  for (let i = 0; i < 14; i++) await step(request);
  expect((await control(request, "inspect")).modelCalls).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("link", {
      name: "/websites (opens in a new tab)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("I have reviewed the business knowledge").check();
  await page.getByLabel("Run daily monitoring").check();
  await page
    .getByRole("button", { name: "Save SEO settings", exact: true })
    .click();
  await expect(
    page.getByText("SEO settings saved.", { exact: true }),
  ).toBeVisible();
  let state;
  for (let i = 0; i < 35; i++) {
    await step(request);
    state = await control(request, "inspect");
    if (state.changes.some((c: { status: string }) => c.status === "ready"))
      break;
  }
  expect(
    state.changes.some((c: { status: string }) => c.status === "ready"),
    JSON.stringify(state),
  ).toBe(true);
  expect(state.modelCalls).toBe(2);
  await step(request);
  await step(request);
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "7", exact: true }).first(),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.screenshot({
    path: dashboardPreviewPath(`seo-manager-${info.project.name}.png`),
    fullPage: true,
    style: "nextjs-portal{display:none!important}",
  });
  await page
    .getByRole("link", { name: "Review change", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Review search metadata", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.screenshot({
    path: dashboardPreviewPath(`seo-change-${info.project.name}.png`),
    fullPage: true,
    style: "nextjs-portal{display:none!important}",
  });
  const title = await page
    .getByRole("textbox", { name: "Page title *", exact: true })
    .inputValue();
  await page.getByLabel("I checked the final wording").check();
  await page
    .getByRole("button", { name: "Publish reviewed change", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Restore previous metadata",
      exact: true,
    }),
  ).toBeVisible();
  const detail = page.url();
  await page.goto("/websites");
  await expect(page).toHaveTitle(title);
  await step(request);
  await page.goto(detail);
  await expect(page.getByText("verified", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Restore previous metadata", exact: true })
    .click();
  await expect(page.getByText("rolled back", { exact: true })).toBeVisible();
  await page.goto("/websites");
  await expect(page).not.toHaveTitle(title);
  expect(
    (await control(request, "inspect")).costs.every(
      (c: { status: string }) => c.status === "settled",
    ),
  ).toBe(true);
});
test("keeps viewers read-only and rejects unsigned worker requests", async ({
  page,
  request,
}) => {
  await signIn(page, "viewer");
  await expect(
    page.getByRole("button", { name: "Save SEO settings", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Queue website scan", exact: true }),
  ).toHaveCount(0);
  expect((await request.post("/api/cron/seo")).status()).toBe(401);
  expect((await request.get("/api/cron/seo")).status()).toBe(405);
  expect((await control(request, "inspect")).modelCalls).toBe(0);
});
