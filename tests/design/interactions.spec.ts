import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(process.env.DESIGN_CAPTURE_PHASE === "before", "Baseline capture predates these controls.");
async function signIn(page: Page) {
  await page.goto("/sign-in"); await page.getByLabel("Team email").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
}
async function accessible(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)}))).toEqual([]);
}
test("page finder opens from the keyboard, navigates and closes with Escape", async ({ page }, info) => {
  await signIn(page); await page.keyboard.press("Control+k");
  const finder = page.getByRole("dialog", { name: "Find a page", exact: true }); await expect(finder).toBeVisible();
  await finder.getByRole("searchbox", { name: "Search dashboard pages", exact: true }).fill("projects");
  await expect(finder.getByRole("link", { name: /Projects/ })).toHaveCount(1); await accessible(page, ".workspace-page-finder");
  await finder.getByRole("link", { name: /Projects/ }).click(); await expect(page).toHaveURL(/\/dashboard\/projects$/); await expect(finder).not.toBeVisible();
  await page.keyboard.press("Control+k"); await expect(finder.getByRole("searchbox")).toHaveValue(""); await page.keyboard.press("Escape"); await expect(finder).not.toBeVisible();
  if (info.project.name === "desktop") await expect(page.getByRole("button", { name: "Find a page Ctrl K", exact: true })).toBeFocused();
});
test("record drawers support existing links, keep cancelled input and fit narrow screens", async ({ page }, info) => {
  await signIn(page); await page.goto("/dashboard/clients"); await page.getByRole("link", { name: "Add client", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Create client", exact: true }); await expect(drawer).toBeVisible();
  await drawer.getByRole("textbox", { name: "Client name", exact: true }).fill("Unsaved design review");
  await accessible(page, ".workspace-record-dialog[open]");
  const directory = process.env.DASHBOARD_TEST_THEME ? `docs/previews/themes/${process.env.DASHBOARD_TEST_THEME}` : "docs/previews/design/after";
  await page.screenshot({ path: `${directory}/client-drawer-${info.project.name}.png` });
  await page.keyboard.press("Escape"); await expect(drawer).not.toBeVisible(); await expect(page).not.toHaveURL(/#create-client/);
  await page.getByRole("link", { name: "Add client", exact: true }).click(); await expect(drawer.getByRole("textbox", { name: "Client name", exact: true })).toHaveValue("Unsaved design review");
  await drawer.getByRole("button", { name: "Close create client", exact: true }).click();
  for (const [path, title] of [["projects#create-project", "Create project"], ["sites#create-site", "Add site"]]) {
    await page.goto(`/dashboard/${path}`); const record = page.getByRole("dialog", { name: title, exact: true }); await expect(record).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true); await accessible(page, ".workspace-record-dialog[open]");
    await page.keyboard.press("Escape"); await expect(record).not.toBeVisible();
  }
});
test("settings section links reveal the correct controls without crowding the summary", async ({ page }) => {
  await signIn(page); await page.goto("/dashboard/settings");
  await expect(page.locator(".workspace-connections > article")).toHaveCount(9);
  await expect(page.locator("#messaging-settings")).not.toHaveAttribute("open"); await expect(page.locator("#voice-settings")).not.toHaveAttribute("open");
  await page.getByRole("link", { name: "SMS settings", exact: true }).click(); await expect(page.locator("#messaging-settings")).toHaveAttribute("open", "");
  await page.goto("/dashboard/settings#calling"); await expect(page.locator("#voice-settings")).toHaveAttribute("open", "");
  const profile = await page.locator(".workspace-profile p").boundingBox();
  expect(profile?.height).toBeLessThan(70);
});
test("record section navigation reaches saved work and account controls", async ({ page }) => {
  await signIn(page); await page.goto("/dashboard/projects/00000000-0000-4000-8000-000000000314");
  await expect(page.locator(".workspace-facts")).toContainText("Project owner");
  await page.getByRole("navigation", { name: "Project sections", exact: true }).getByRole("link", { name: "Decisions & deliverables", exact: true }).click();
  await expect(page.locator("#project-records")).toBeInViewport();
  await page.goto("/dashboard/clients/00000000-0000-4000-8000-000000000311");
  await page.getByRole("navigation", { name: "Client sections", exact: true }).getByRole("link", { name: "Account details", exact: true }).click(); await expect(page.getByRole("form", { name: "Save client", exact: true })).toBeInViewport();
  for (const [label, title] of [["Add site", "Add site"], ["Add project", "Create project"]]) {
    await page.goto("/dashboard/clients/00000000-0000-4000-8000-000000000311");
    await page.getByRole("link", { name: label, exact: true }).click();
    const drawer = page.getByRole("dialog", { name: title, exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("combobox", { name: "Client", exact: true })).toHaveValue("00000000-0000-4000-8000-000000000311");
  }
});
