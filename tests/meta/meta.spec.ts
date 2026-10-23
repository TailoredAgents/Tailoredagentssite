import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { mkdir } from "node:fs/promises";
const pool = new pg.Pool({
  connectionString:
    "postgresql://ta_test@127.0.0.1:55433/ta_reporting_browser_test",
  max: 1,
});
const fixtureId = "00000000-0000-4000-8000-000000009871";
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as typeof window & { __metaCalls?: unknown[][] }).__metaCalls ||
      [],
  );
test.beforeEach(async ({ page }) => {
  await pool.query(
    "DELETE FROM request_rate_limits WHERE scope='public-contact'",
  );
  await page.route("https://connect.facebook.net/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.__metaCalls = [...window.fbq.queue]; window.fbq.callMethod = (...args) => window.__metaCalls.push(args);",
    }),
  );
  await page.route("https://www.facebook.com/**", (route) => route.abort());
});
test.afterAll(async () => {
  await pool.end();
});

test("only measures accepted public visits and saved website inquiries", async ({
  page,
}, info) => {
  await page.goto("/contact");
  await expect(
    page.getByRole("region", { name: "Advertising cookie preferences" }),
  ).toBeVisible();
  expect(await calls(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Allow Meta cookies", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await calls(page)).filter((row) => row[2] === "PageView").length,
    )
    .toBe(1);
  // Exercise the real database-backed website form; invalid requests never count.
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.getByText("Please review the highlighted fields."),
  ).toBeVisible();
  expect((await calls(page)).filter((row) => row[2] === "Lead")).toHaveLength(
    0,
  );
  await page.getByLabel("Name", { exact: true }).fill("Meta website fixture");
  await page
    .getByLabel("Business or organization")
    .fill("Meta browser fixture");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`pixel-${info.project.name}@example.test`);
  await page.getByLabel("Area of interest").selectOption({ index: 1 });
  await page
    .getByLabel("Brief project description")
    .fill(
      "Synthetic browser inquiry to verify saved-lead advertising measurement.",
    );
  await page.waitForTimeout(2600);
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.getByText("Thank you. Your project inquiry has been received."),
  ).toBeVisible();
  const events = (await calls(page)).filter((row) => row[2] === "Lead");
  expect(events).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain("example.test");
  expect(JSON.stringify(events)).not.toContain("Meta website fixture");
  await page
    .getByRole("button", { name: "Cookie preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  expect((await calls(page)).at(-1)).toEqual(["consent", "revoke"]);
});

test("declining and private sign-in keep the Pixel unloaded", async ({
  page,
}, info) => {
  let loads = 0;
  page.on("request", (request) => {
    if (request.url().includes("connect.facebook.net")) loads++;
  });
  await page.goto("/");
  const banner = page.getByRole("region", {
    name: "Advertising cookie preferences",
  });
  await expect(banner).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include('[aria-label="Advertising cookie preferences"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir("test-results/meta-previews", { recursive: true });
  await page.screenshot({
    path: `test-results/meta-previews/preferences-${info.project.name}.png`,
  });
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  await page.goto("/websites");
  await expect(banner).not.toBeVisible();
  expect(loads).toBe(0);
  await page.goto("/sign-in");
  await expect(
    page.getByRole("button", { name: "Cookie preferences", exact: true }),
  ).toHaveCount(0);
  expect(loads).toBe(0);
  const response = await page.request.get("/sign-in");
  expect(response.headers()["content-security-policy"]).not.toContain(
    "facebook",
  );
});

test("Meta leads and source details fit the CRM and connection status is honest", async ({
  page,
}, info) => {
  await pool.query(
    `INSERT INTO leads(id,workspace_id,name,organization,email,source,description,delivery_status,meta_context)
    VALUES($1,'00000000-0000-4000-8000-000000000001','Example contact','Meta browser lead','meta-browser@example.test','facebook','What do you need: A business website','not_configured',$2::jsonb)
    ON CONFLICT(id) DO NOTHING`,
    [
      fixtureId,
      JSON.stringify({
        platform: "instagram",
        formId: "222222222",
        campaignName: "Website launch campaign",
        adName: "Georgia business owners",
        submittedAt: "2026-10-23T16:00:00Z",
      }),
    ],
  );
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/leads?source=facebook");
  await expect(page.getByLabel("Filter leads by source")).toHaveValue(
    "facebook",
  );
  await page.getByRole("link", { name: /Meta browser lead/ }).click();
  await expect(
    page.getByText("Website launch campaign", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Georgia business owners", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-long-copy p")).toHaveText(
    "What do you need: A business website",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir("test-results/meta-previews", { recursive: true });
  await page.screenshot({
    path: `test-results/meta-previews/lead-${info.project.name}.png`,
  });
  await page.goto("/dashboard/settings#meta");
  await expect(
    page.getByRole("heading", { name: "Facebook & Instagram", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Configured — verify in Meta Test Events", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include("#meta")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page
    .locator("#meta")
    .screenshot({
      path: `test-results/meta-previews/settings-${info.project.name}.png`,
    });
});
