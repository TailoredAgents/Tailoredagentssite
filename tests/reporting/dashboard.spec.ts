import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function signIn(
  page: import("@playwright/test").Page,
  email = "owner@example.test",
) {
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/analytics");
}
test("readable report, dates, search, sorting, pagination, exports, and keyboard access", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await expect(page.getByRole("heading", { name: /See what/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Website visits", exact: true }),
  ).toBeVisible();
  await page.getByText("View chart data", { exact: true }).first().click();
  await expect(
    page.getByRole("region", { name: "Website activity data" }),
  ).toBeVisible();
  const terms = page
    .locator(".report-detail")
    .filter({
      has: page.getByRole("heading", {
        name: "Google search terms",
        exact: true,
      }),
    });
  await expect(terms.getByText("19 rows · Page 1")).toBeVisible();
  await terms
    .getByRole("button", { name: "Next page of Google search terms" })
    .click();
  await expect(terms.getByText("19 rows · Page 2")).toBeVisible();
  await terms.getByRole("searchbox").fill("website design");
  await expect(terms.getByText("1 rows · Page 1")).toBeVisible();
  await expect(
    terms.getByRole("rowheader", { name: "website design woodstock" }),
  ).toBeVisible();
  await terms.getByRole("button", { name: /Clicks/ }).click();
  await expect(terms.locator('th[aria-sort="ascending"]')).toHaveCount(1);
  await page.getByRole("link", { name: "7 days", exact: true }).click();
  await expect(page).toHaveURL(/range=7d/);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "7 days", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "tailored-agents-report.csv",
  );
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => document.activeElement !== document.body),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole("heading", { name: "Website visits", exact: true })
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(14);
  await page.goto("/dashboard/analytics");
  await expect(
    page
      .locator(".report-detail")
      .first()
      .getByText(/rows · Page 1/),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".reporting")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `test-results/reporting-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("anonymous requests and viewer management fail closed", async ({
  page,
  request,
}) => {
  for (const path of [
    "/api/dashboard/reports/export",
    "/api/dashboard/reports/table?table=queries",
    "/api/integrations/search-console/status",
  ])
    expect((await request.get(path)).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/sign-up/email", {
        data: {
          name: "Intruder",
          email: "intruder@example.test",
          password: "Example-password-only",
        },
      })
    ).status(),
  ).toBe(404);
  await signIn(page, "viewer@example.test");
  await expect(
    page.getByRole("button", { name: "Refresh Google", exact: true }),
  ).toBeDisabled();
  const status = await page.evaluate(
    async () =>
      (await fetch("/api/integrations/search-console/sync", { method: "POST" }))
        .status,
  );
  expect(status).toBe(403);
  expect(
    (await page.request.get("/api/dashboard/reports/export")).status(),
  ).toBe(200);
});
test("www remains reachable before the hosting cutover is enabled", async ({
  request,
}) => {
  const response = await request.get("/api/health?source=test", {
    headers: { host: "www.tailoredagents.com" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  expect(response.headers().location).toBeUndefined();
  expect((await request.get("/api/health")).status()).toBe(200);
});
test("disconnect explains saved reports and can be cancelled", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByText("Google connection & update history", { exact: true })
    .click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByText(/Your saved reports will remain available/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep connected" }).click();
  await expect(
    page.getByRole("button", { name: "Yes, disconnect Google" }),
  ).toHaveCount(0);
});
