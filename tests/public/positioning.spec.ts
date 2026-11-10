import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  // No analytics or inquiry is allowed to reach a provider during this suite.
  await page.route("**/api/analytics/**", route => route.fulfill({ status: 204 }));
  await page.route("**/api/contact", route => route.fulfill({ status: 503, json: { message: "Unexpected test submission" } }));
});

test("visitors can explore workflows, find every service and reach partnerships", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI that works");
  await page.getByRole("button", { name: "Document intake", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Read, match & check" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Document intake", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Team knowledge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find the relevant guidance" })).toBeVisible();
  for (const href of ["/websites", "/seo", "/packages", "/engineering", "/automation", "/work/stonegateos"]) {
    await expect(page.locator(`main a[href='${href}']`).first()).toBeVisible();
  }
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.locator("header").getByRole("link", { name: "Partnerships", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/partners$/);
  await page.getByRole("link", { name: "Discuss revenue sharing" }).click();
  await expect(page.locator("select[name=interest]")).toHaveValue("Revenue-share opportunity");
  await page.screenshot({ path: info.outputPath("contact-prefill.png"), fullPage: true });
});

test("partnership choice reaches the existing inquiry form and stays editable", async ({ page }) => {
  await page.goto("/contact?interest=partnership");
  await expect(page.getByLabel("Area of interest")).toHaveValue("Partnership or referral");
  await page.getByLabel("Area of interest").selectOption("Revenue-share opportunity");
  await page.getByLabel("Name", { exact: true }).fill("Preview Tester");
  await page.getByLabel("Business or organization").fill("Example Company");
  await page.getByLabel("Email", { exact: true }).fill("preview@example.com");
  await page.getByLabel("What would you like to discuss?").fill("We would like to discuss a joint automation opportunity for our business.");
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/contact", async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { message: "Preview inquiry captured; no message was sent." } });
  });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("status")).toContainText("no message was sent");
  expect(payload).toMatchObject({ inquiryType: "project", interest: "Revenue-share opportunity", email: "preview@example.com" });
  await page.goto("/contact?interest=unknown");
  await expect(page.getByLabel("Area of interest")).toHaveValue("");
});

test("solution and call examples can be explored with a keyboard without contacting a provider", async ({ page }) => {
  await page.goto("/solutions");
  const phoneSolution = page.getByRole("button", { name: /AI Phone & Missed-call Recovery/ });
  await phoneSolution.focus();
  await page.keyboard.press("Enter");
  await expect(phoneSolution).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "AI Phone & Missed-call Recovery", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Discuss this workflow" }).click();
  await expect(page.getByLabel("Area of interest")).toHaveValue("Business automation and AI");
  await page.goto("/");
  await page.getByRole("button", { name: "CRM updated", exact: true }).click();
  await expect(page.getByText("CRM note prepared", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "CRM updated", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("public pages fit the viewport and have accessible content and matching share metadata", async ({ page }, info) => {
  test.setTimeout(240_000);
  for (const path of ["/", "/automation", "/pricing", "/partners", "/company", "/solutions", "/work", "/contact", "/engineering", "/websites", "/seo", "/packages", "/industries/hvac", "/free-review", "/work/stonegateos", "/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensions.content, path).toBeLessThanOrEqual(dimensions.viewport + 1);
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect.soft(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), path).toEqual([]);
    if (["/", "/automation", "/pricing", "/partners", "/company", "/solutions", "/work", "/contact"].includes(path)) {
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description!);
      const shareUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
      expect(new URL(shareUrl!).href).toBe(`https://www.tailoredagents.com${path}`);
    }
    await page.screenshot({ path: info.outputPath(`${path.replaceAll("/", "") || "home"}.png`), fullPage: true });
  }
});
