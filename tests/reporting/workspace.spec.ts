import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fixture = { client: "00000000-0000-4000-8000-000000000311", contact: "00000000-0000-4000-8000-000000000312", site: "00000000-0000-4000-8000-000000000313", project: "00000000-0000-4000-8000-000000000314", lead: "00000000-0000-4000-8000-000000000317" };
async function signIn(page: Page, viewer = false) {
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(viewer ? "viewer@example.test" : "owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
const routes = [
  ["overview", "/dashboard"], ["leads", "/dashboard/leads"], ["clients", "/dashboard/clients"], ["projects", "/dashboard/projects"], ["sites", "/dashboard/sites"], ["activity", "/dashboard/activity"], ["settings", "/dashboard/settings"], ["analytics", "/dashboard/analytics"],
  ["lead", `/dashboard/leads/${fixture.lead}`], ["client", `/dashboard/clients/${fixture.client}`], ["contact", `/dashboard/clients/${fixture.client}/contacts/${fixture.contact}`], ["project", `/dashboard/projects/${fixture.project}`], ["site", `/dashboard/sites/${fixture.site}`],
];

test("every tab and record view has readable text, accessible controls and no page overflow", async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signIn(page);
  for (const [name, path] of routes) {
    await test.step(name, async () => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      const tinyText = await page.locator(".dashboard-shell").evaluate(shell => {
        const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT), bad: string[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode, parent = node.parentElement;
          if (!node.textContent?.trim() || !parent || parent.closest(".sr-only, script, style, svg")) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          const rect = range.getBoundingClientRect(), style = getComputedStyle(parent);
          if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number.parseFloat(style.fontSize) < 14) bad.push(`${node.textContent.trim().slice(0, 55)}: ${style.fontSize}`);
        }
        return bad;
      });
      expect.soft(tinyText, `${name}: small text`).toEqual([]);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: page overflow`).toBe(true);
      const smallFields = await page.locator('.dashboard-main input:not([type="hidden"]), .dashboard-main select, .dashboard-main textarea').evaluateAll(fields => fields.filter(field => field.getBoundingClientRect().width > 0 && Number.parseFloat(getComputedStyle(field).fontSize) < 16).map(field => field.getAttribute("name")));
      // Analytics already has a separate responsive reporting scale.
      if (name !== "analytics") expect.soft(smallFields, `${name}: form text`).toEqual([]);
      const accessibility = await new AxeBuilder({ page }).include(".dashboard-shell").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect.soft(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), `${name}: accessibility`).toEqual([]);
      if (["overview", "clients", "project", "settings"].includes(name)) await page.screenshot({ path: `test-results/workspace-${name}-${info.project.name}.png`, fullPage: true });
    });
  }
  expect(errors).toEqual([]);
});

test("navigation, search, empty results and shortcuts work with keyboard and phone menus", async ({ page }, info) => {
  await signIn(page);
  const menu = page.locator(".dashboard-menu-toggle");
  if (info.project.name === "phone") {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
  }
  const navigation = page.getByRole("navigation", { name: "Dashboard navigation" });
  await navigation.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);
  if (info.project.name === "phone") { await expect(menu).toHaveAttribute("aria-expanded", "false"); await menu.click(); }
  await expect(navigation.getByRole("link", { name: "Clients", exact: true })).toHaveAttribute("aria-current", "page");
  if (info.project.name === "phone") await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "Search clients" }).fill("no-such-client-xyz");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No matching clients", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Clear", exact: true }).click();
  await expect(page.getByText("Northstar Heating & Air", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Add client", exact: true }).click();
  const input = page.getByRole("form", { name: "Create client" }).getByLabel("Client name");
  await input.focus(); await page.keyboard.type("Keyboard entry");
  await expect(input).toHaveValue("Keyboard entry");
  expect(await input.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
});

test("real record changes save and milestone updates report success", async ({ page }, info) => {
  await signIn(page);
  await page.goto(`/dashboard/leads/${fixture.lead}`);
  const lead = page.getByRole("form", { name: "Save lead" });
  await lead.getByLabel("Next action", { exact: true }).fill(`Confirm discovery call — ${info.project.name}`);
  await lead.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(lead.getByRole("status")).toHaveText("Lead updated.");
  await page.reload();
  await expect(lead.getByLabel("Next action", { exact: true })).toHaveValue(`Confirm discovery call — ${info.project.name}`);
  const note = page.getByRole("form", { name: "Add note" });
  await note.getByLabel("New note").fill(`Browser workflow check — ${info.project.name}`);
  await note.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(page.locator(".dashboard-notes-list")).toContainText(`Browser workflow check — ${info.project.name}`);
  await page.goto(`/dashboard/projects/${fixture.project}`);
  const milestone = page.getByRole("form", { name: "Update milestone" }).first();
  await milestone.getByRole("combobox").selectOption("completed");
  await milestone.getByRole("button", { name: "Update milestone" }).click();
  await expect(milestone.getByRole("status")).toHaveText("Milestone updated.");
  await page.reload(); await expect(milestone.getByRole("combobox")).toHaveValue("completed");
  await page.goto(`/dashboard/clients/${fixture.client}/contacts/${fixture.contact}`);
  const contact = page.getByRole("form", { name: "Save contact" });
  await contact.getByLabel("Title", { exact: true }).fill(`Office manager — ${info.project.name}`);
  await contact.getByRole("button", { name: "Save contact", exact: true }).click();
  await expect(contact.getByRole("status")).toHaveText("Contact updated.");
  await page.getByRole("link", { name: "Back to client", exact: true }).click();
  await expect(page.getByText(`Office manager — ${info.project.name}`, { exact: true })).toBeVisible();
});

test("view-only teammates can read every record without misleading edit buttons", async ({ page }) => {
  await signIn(page, true);
  for (const [, path] of routes.filter(([name]) => ["clients", "projects", "sites", "lead", "client", "contact", "project", "site"].includes(name))) {
    await page.goto(path);
    await expect(page.getByText(/You have view-only access/)).toBeVisible();
    for (const form of await page.locator(".dashboard-operation-form, .dashboard-milestone-form").all()) {
      await expect(form.getByRole("button", { name: /Save|Add|Create|Convert|Update/ })).toBeDisabled();
    }
  }
});

test("small phones, tablets and narrow desktop windows keep every page inside the screen", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "One viewport sweep is sufficient.");
  test.setTimeout(120000);
  await signIn(page);
  for (const width of [320, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of routes) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} at ${width}px`).toBe(true);
    }
  }
});
