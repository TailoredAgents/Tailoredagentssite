import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = "00000000-0000-4000-8000-";
const routes = [
  ["overview", "/dashboard"], ["inbox", "/dashboard/inbox"], ["my-day", "/dashboard/sales/today"], ["sales-board", "/dashboard/sales"], ["sales-table", "/dashboard/sales?view=table"], ["mockups", "/dashboard/sales/mockups"], ["calling-lists", "/dashboard/sales/imports"],
  ["leads", "/dashboard/leads"], ["clients", "/dashboard/clients"], ["projects", "/dashboard/projects"], ["sites", "/dashboard/sites"], ["analytics", "/dashboard/analytics"], ["activity", "/dashboard/activity"], ["settings", "/dashboard/settings"],
  ["lead-detail", `/dashboard/leads/${base}000000000317`], ["client-detail", `/dashboard/clients/${base}000000000311`], ["contact-detail", `/dashboard/clients/${base}000000000311/contacts/${base}000000000312`], ["project-detail", `/dashboard/projects/${base}000000000314`], ["site-detail", `/dashboard/sites/${base}000000000313`], ["sales-detail", `/dashboard/sales/${base}000000000530`],
  ["email-workspace", "/dashboard/inbox?channel=email"], ["sms-workspace", "/dashboard/inbox?channel=sms"],
] as const;
test("review every dashboard page on desktop and phone", async ({ page }, info) => {
  const phase = process.env.DESIGN_CAPTURE_PHASE || "after";
  if (!["before", "after"].includes(phase)) throw new Error("Use before or after for the visual audit.");
  const theme = process.env.DASHBOARD_TEST_THEME;
  const directory = theme ? `docs/previews/themes/${theme}` : `docs/previews/design/${phase}`;
  await mkdir(directory, { recursive: true });
  await page.goto("/sign-in"); await page.getByLabel("Team email").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
  const findings: Array<{ name: string; path: string; overflow: boolean; violations: unknown[] }> = [];
  for (const [name, path] of routes) {
    await test.step(name, async () => {
      const response = await page.goto(path); expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible(); await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const axe = phase === "after" ? await new AxeBuilder({ page }).include(".dashboard-shell").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze() : null;
      const violations = axe?.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) || [];
      findings.push({ name, path, overflow, violations });
      if (phase === "after") { expect.soft(overflow, `${name}: page overflow`).toBe(false); expect.soft(violations, `${name}: accessibility`).toEqual([]); }
      await page.screenshot({ path: `${directory}/${name}-${info.project.name}.png` });
      if (["settings", "project-detail", "sales-detail"].includes(name)) await page.screenshot({ path: `${directory}/${name}-${info.project.name}-full.png`, fullPage: true });
    });
  }
  await writeFile(`${directory}/checks-${info.project.name}.json`, JSON.stringify(findings, null, 2) + "\n");
});
