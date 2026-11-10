import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/analytics/**", route => route.fulfill({ status: 204 }));
  await page.route("**/api/contact", route => route.fulfill({ status: 503, json: { message: "Blocked by test" } }));
});

test("mobile navigation supports current location, Escape, outside focus and short screens", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 360 });
  await page.goto("/solutions");
  const toggle = page.locator(".menu-button");
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await toggle.click();
  await expect(nav.getByRole("link", { name: "Solutions", exact: true })).toHaveAttribute("aria-current", "page");
  const dimensions = await nav.evaluate(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, viewport: innerHeight, scroll: el.scrollHeight, height: el.clientHeight }));
  expect(dimensions.top).toBeGreaterThan(0);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.scroll).toBeGreaterThan(dimensions.height);
  await nav.getByRole("link", { name: "Solutions", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole("button", { name: /01 AI Operations Automation/ }).focus();
  await expect(nav).toBeHidden();
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await nav.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect(nav).toBeHidden();
});

for (const review of [false, true]) test(`${review ? "review" : "inquiry"} form keeps entries and retry identity, focuses errors, and announces progress`, async ({ page }) => {
  await page.goto(review ? "/free-review" : "/contact?interest=automation");
  const form = page.locator("form.contact-form");
  await form.locator('[name="name"]').fill("Preview Tester");
  await form.locator('[name="organization"]').fill("Example Business");
  await form.locator('[name="email"]').fill("not-an-email");
  if (review) await form.locator('[name="websiteUrl"]').fill("example.com");
  else await form.locator('[name="description"]').fill("We want to connect our existing business systems and improve customer follow-up.");
  let mode: "invalid" | "network" | "success" = "invalid";
  const payloads: Record<string, unknown>[] = [];
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/contact", async route => {
    payloads.push(route.request().postDataJSON());
    if (mode === "invalid") return route.fulfill({ status: 400, json: { message: "Please check your email.", errors: { email: "Enter a valid business email." } } });
    if (mode === "network") return route.abort("failed");
    await pending;
    return route.fulfill({ status: 200, json: {} });
  });
  const submit = form.getByRole("button", { name: review ? "Request my review" : "Send inquiry", exact: true });
  await submit.click();
  await expect(form.locator('[name="email"]')).toBeFocused();
  await expect(form.locator('[name="email"]')).toHaveAttribute("aria-invalid", "true");
  await expect(form.locator('[name="name"]')).toHaveValue("Preview Tester");
  await form.locator('[name="email"]').fill("preview@example.com");
  mode = "network";
  await submit.click();
  await expect(form.getByRole("alert")).toContainText("network error");
  await expect(form.getByRole("alert")).toBeFocused();
  await expect(form.locator('[name="email"]')).toHaveValue("preview@example.com");
  mode = "success";
  await submit.click();
  await expect(form.getByRole("button", { name: "Sending…", exact: true })).toBeDisabled();
  release();
  await expect(form.getByRole("status")).toContainText("has been received");
  await expect(form.locator('[name="name"]')).toHaveValue("");
  expect(payloads).toHaveLength(3);
  expect(new Set(payloads.map(payload => payload.submissionId)).size).toBe(1);
  expect(payloads[2].inquiryType).toBe(review ? "website-review" : "project");
});

test("package calculator and pricing FAQs work with the keyboard", async ({ page }) => {
  await page.goto("/packages");
  await page.getByRole("button", { name: /Launch Visibility/ }).click();
  const range = page.getByLabel("Adjust your upfront website investment", { exact: true });
  await range.focus();
  await page.keyboard.press("Home");
  await expect(range).toHaveValue("750");
  await expect(page.locator(".package-monthly-focus strong")).toContainText("$550.00");
  await page.keyboard.press("End");
  await expect(page.locator(".package-monthly-focus strong")).toContainText("$400.00");
  await page.getByRole("button", { name: /Advanced Growth/ }).click();
  await expect(range).toHaveValue("4000");
  await expect(page.locator(".package-monthly-focus strong")).toContainText("$650.00");
  await page.goto("/pricing");
  for (const summary of await page.locator(".pricing-faq-list summary").all()) {
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(summary.locator("..")).toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(summary.locator("..")).not.toHaveAttribute("open", "");
  }
});

test("all six product examples are keyboard-operable and the sample workspace can be scrolled", async ({ page }, info) => {
  await page.goto("/work/stonegateos");
  const chooser = page.getByRole("group", { name: "Explore StonegateOS capabilities", exact: true });
  for (const button of await chooser.getByRole("button").all()) {
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#platform-panel")).toHaveAttribute("aria-labelledby", (await button.getAttribute("id"))!);
    const result = await new AxeBuilder({ page }).include(".platform-showcase").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect.soft(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), await button.innerText()).toEqual([]);
  }
  if (info.project.name === "mobile") {
    const workspace = page.getByRole("region", { name: "Scrollable sample workspace", exact: true });
    await workspace.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => workspace.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  }
});

test("legal page links are visually identifiable and the contact route works", async ({ page }) => {
  for (const path of ["/terms", "/privacy"]) {
    await page.goto(path);
    for (const link of await page.locator(".legal a").all()) {
      expect(await link.evaluate(el => getComputedStyle(el).textDecorationLine)).toContain("underline");
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
  }
  await page.goto("/terms");
  await page.getByRole("link", { name: "Contact Tailored Agents", exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
});

test("narrow phones and tablets keep public pages and all solution choices usable", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The viewport matrix only needs one run.");
  test.setTimeout(180_000);
  const paths = ["/", "/automation", "/pricing", "/partners", "/company", "/solutions", "/work", "/contact", "/engineering", "/websites", "/seo", "/packages", "/industries/hvac", "/free-review", "/work/stonegateos", "/privacy", "/terms"];
  for (const width of [320, 768, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} at ${width}px`).toBe(true);
      if (path === "/solutions") {
        const chooser = page.getByRole("group", { name: "Choose a solution" });
        expect(await chooser.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.getByRole("button", { name: /05 AI Marketing Intelligence/ }).click();
        await expect(page.getByRole("heading", { name: "AI Marketing Intelligence", exact: true })).toBeVisible();
        await chooser.screenshot({ path: info.outputPath(`solutions-${width}.png`) });
      }
    }
  }
});
