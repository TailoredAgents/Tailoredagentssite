import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Pool, type QueryResultRow } from "pg";

const databaseUrl =
  process.env.REPORTING_TEST_DATABASE_URL ||
  "postgresql://ta_test@127.0.0.1:55432/ta_reporting_browser_test";
const parsedDatabase = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(parsedDatabase.hostname) ||
  parsedDatabase.pathname !== "/ta_reporting_browser_test"
) {
  throw new Error(
    "Manual lead browser tests require the isolated local test database.",
  );
}
async function rows<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    return (await pool.query<T>(sql, values)).rows;
  } finally {
    await pool.end();
  }
}
async function signIn(page: Page, viewer = false) {
  page.setDefaultTimeout(15000);
  await page.goto("/sign-in");
  await page
    .getByLabel("Team email")
    .fill(viewer ? "viewer@example.test" : "owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const run = Date.now().toString(36);

test("adds a phone-only lead directly from Leads and retains useful sales context", async ({
  page,
}, info) => {
  const organization = `Manual landscaping ${info.project.name} ${run}`;
  const phone = info.project.name === "phone" ? "+17705550242" : "+17705550241";
  const notes =
    "Referral from a current customer. Interested in a website refresh and an AI receptionist.";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await page.goto("/dashboard/leads");
  const trigger = page.getByRole("button", { name: "Add lead", exact: true });
  await trigger.click();
  const form = page.getByRole("form", { name: "Add lead", exact: true });
  const business = form.getByRole("textbox", {
    name: "Business name (optional)",
    exact: true,
  });
  await expect(business).toBeFocused();
  await business.fill(organization);
  await form
    .getByRole("textbox", { name: "Contact name (optional)", exact: true })
    .fill("Jordan Referral");
  await form.getByRole("textbox", { name: "Phone", exact: true }).fill(phone);
  await form.getByText("More details", { exact: false }).click();
  await form
    .getByRole("textbox", { name: "Website", exact: true })
    .fill("manual-prospect.example.test");
  await form
    .getByRole("textbox", { name: "Service or interest", exact: true })
    .fill("Website and AI receptionist");
  await form.getByRole("textbox", { name: "Notes", exact: true }).fill(notes);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: `test-results/manual-lead-entry-${info.project.name}.png`,
    fullPage: true,
  });
  await form.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/leads\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: organization, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Added manually", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.locator(".dashboard-long-copy p")).toHaveText(notes);
  await expect(
    page.getByRole("link", { name: phone, exact: true }),
  ).toHaveAttribute("href", `tel:${phone}`);
  await expect(
    page.getByRole("link", {
      name: "https://manual-prospect.example.test/",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://manual-prospect.example.test/");
  expect(await page.locator('a[href^="mailto:"]').count()).toBe(0);
  const saved = await rows(
    "SELECT id,email,source,status,owner_user_id,measurement_context,measurement_status,delivery_status FROM leads WHERE organization=$1",
    [organization],
  );
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    email: null,
    source: "manual",
    status: "new",
    owner_user_id: "preview-owner",
    measurement_context: null,
    measurement_status: null,
    delivery_status: "not_configured",
  });
  await page.getByRole("link", { name: "Back to leads", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search leads", exact: true })
    .fill(phone.slice(-7));
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  const lead = page
    .getByRole("link")
    .filter({ has: page.getByText(organization, { exact: true }) });
  await expect(lead).toBeVisible();
  await expect(lead).toContainText(phone);
  expect(errors).toEqual([]);
});

test("adds a person without a business and shows their name in Leads", async ({ page }, info) => {
  const name = `Personal referral ${info.project.name} ${run}`;
  await signIn(page);
  await page.goto("/dashboard/leads");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  const form = page.getByRole("form", { name: "Add lead", exact: true });
  await expect(form.getByRole("textbox", { name: "Business name (optional)", exact: true })).not.toHaveAttribute("required", "");
  await form.getByRole("textbox", { name: "Contact name (optional)", exact: true }).fill(name);
  await form.getByRole("textbox", { name: "Email", exact: true }).fill(`person-${info.project.name}-${run}@example.test`);
  await form.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(await rows("SELECT organization FROM leads WHERE name=$1", [name])).toEqual([{ organization: "" }]);
  await page.getByRole("link", { name: "Back to leads", exact: true }).click();
  await expect(page.locator("strong").filter({ hasText: name })).toBeVisible();
});

test("retains manual lead fields after server validation and keeps entry accessible at narrow widths", async ({
  page,
}, info) => {
  await signIn(page);
  await page.goto("/dashboard/leads");
  const trigger = page.getByRole("button", { name: "Add lead", exact: true });
  await trigger.click();
  const form = page.getByRole("form", { name: "Add lead", exact: true });
  const organization = `Manual validation ${info.project.name} ${run}`;
  await form
    .getByRole("textbox", { name: "Business name (optional)", exact: true })
    .fill(organization);
  await form
    .getByRole("textbox", { name: "Phone", exact: true })
    .fill("2125550243");
  await form.getByText("More details", { exact: false }).click();
  await form
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Keep these details while correcting the website.");
  await form
    .getByRole("textbox", { name: "Website", exact: true })
    .fill("javascript:alert(1)");
  await form.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(
    form.getByRole("textbox", { name: "Business name (optional)", exact: true }),
  ).toHaveValue(organization);
  await expect(
    form.getByRole("textbox", { name: "Phone", exact: true }),
  ).toHaveValue("2125550243");
  await expect(
    form.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Keep these details while correcting the website.");
  await expect(
    form.getByRole("textbox", { name: "Website", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(
    await rows("SELECT id FROM leads WHERE organization=$1", [organization]),
  ).toHaveLength(0);
  await form
    .getByRole("textbox", { name: "Website", exact: true })
    .fill("valid.example.test");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const widths = info.project.name === "phone" ? [390, 320] : [1440, 768, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    const inputSizes = await form
      .locator("input:not([type=hidden]),textarea,button")
      .evaluateAll((fields) =>
        fields
          .filter(
            (field) => (field as HTMLElement).getBoundingClientRect().width > 0,
          )
          .map((field) => Number.parseFloat(getComputedStyle(field).fontSize)),
      );
    expect(inputSizes.every((size) => size >= 14)).toBe(true);
  }
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("viewers can read Leads without a manual create control", async ({
  page,
}) => {
  await signIn(page, true);
  await page.goto("/dashboard/leads");
  await expect(
    page.getByRole("heading", { name: "Leads", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add lead", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("form", { name: "Add lead", exact: true }),
  ).toHaveCount(0);
});
