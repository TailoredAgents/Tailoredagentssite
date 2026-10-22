import { dashboardPreviewPath } from "../dashboard-theme-state";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function control(request: APIRequestContext, action: string) {
  const response = await request.post("http://127.0.0.1:3131/test-control", { headers: { authorization: "Bearer inbox-synthetic-control" }, data: { action } });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}
async function signIn(page: Page, name = "owner") {
  page.setDefaultTimeout(20000);
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(`${name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Inbox-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/analytics)?$/, { timeout: 20000 });
  await page.goto("/dashboard/inbox?channel=email");
  await expect(page.getByRole("heading", { name: "Team inbox", exact: true })).toBeVisible();
}
async function openThread(page: Page) {
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Website project", exact: true }) }).click();
  await expect(page.getByLabel("Email message history", { exact: true })).toBeVisible();
}
test.beforeEach(async ({ request }) => { await control(request, "reset"); });

test("reads approved mail safely, downloads attachments, assigns and links a conversation", async ({ page, request }, info) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await signIn(page);
  await expect(page.getByRole("combobox", { name: "Mailbox", exact: true })).toHaveValue("address-sales");
  await openThread(page);
  await expect(page.getByLabel("Email message history", { exact: true }).getByText("Could you build our website and an AI receptionist?", { exact: true })).toBeVisible();
  await expect(page.locator('img[src*="tracking.example"]')).toHaveCount(0);
  await expect(page.getByText("private@example.test")).toHaveCount(0);
  const downloadLink = page.getByRole("link", { name: /project-brief.txt/ });
  const attachment = await page.request.get(await downloadLink.getAttribute("href") || "");
  expect(attachment.ok()).toBeTruthy();
  expect(attachment.headers()["content-type"]).toBe("application/octet-stream");
  expect(attachment.headers()["content-disposition"]).toMatch(/^attachment/);
  expect(await attachment.text()).toBe("Synthetic project brief");
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(page.locator(".inbox-read-status")).toHaveText("Read");
  const details = page.getByText("Conversation details", { exact: true });
  if (!(await page.getByLabel("Team status").isVisible())) await details.click();
  await page.getByLabel("Team status").selectOption("waiting");
  await page.getByLabel("Assigned teammate").selectOption("inbox-owner");
  await page.getByLabel("Linked business").selectOption("00000000-0000-4000-8000-000000000901");
  await page.getByLabel("Linked website inquiry").selectOption("00000000-0000-4000-8000-000000000902");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByText("Conversation updated.")).toBeVisible();
  await page.getByLabel("New internal note").fill("Customer prefers a morning discovery call.");
  await page.getByRole("button", { name: "Add internal note", exact: true }).click();
  await expect(page.getByText("Customer prefers a morning discovery call.", { exact: true })).toBeVisible();
  expect((await control(request, "inspect")).sends).toBe(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: dashboardPreviewPath(`inbox-${info.project.name}.png`), fullPage: true, style: "nextjs-portal { display: none !important; }" });
  expect(errors).toEqual([]);
});

test("saves private drafts and sends a reply only after an explicit click", async ({ page, request }) => {
  await signIn(page); await openThread(page);
  await page.getByRole("textbox", { name: "Message *", exact: true }).fill("Thanks. We can review your website goals together.");
  await page.getByRole("button", { name: "Save private draft", exact: true }).click();
  await expect(page.getByText("Private draft saved. No email was sent.")).toBeVisible();
  expect((await control(request, "inspect")).sends).toBe(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message *", exact: true })).toHaveValue("Thanks. We can review your website goals together.");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.getByLabel("Email message history", { exact: true }).getByText("Thanks. We can review your website goals together.", { exact: true })).toBeVisible();
  const state = await control(request, "inspect");
  expect(state.sends).toBe(1); expect(state.attempts).toHaveLength(1);
  expect(state.attempts[0]).toMatchObject({ threadId: "thread-website" });
  expect(state.attempts[0]).not.toHaveProperty("to"); expect(state.attempts[0]).not.toHaveProperty("subject");
});

test("recovers an uncertain new email using the same send key across refresh", async ({ page, request }) => {
  await signIn(page);
  await page.getByRole("link", { name: "New email", exact: true }).click();
  await page.getByLabel("To *", { exact: true }).fill("customer@example.test");
  await page.getByLabel("Subject *", { exact: true }).fill("Discovery call");
  await page.getByRole("textbox", { name: "Message *", exact: true }).fill("Would Tuesday morning work?");
  await control(request, "uncertain");
  await page.getByRole("button", { name: "Send email", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check send status", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message *", exact: true })).toHaveAttribute("readonly", "");
  await page.reload();
  await expect(page.getByRole("button", { name: "Check send status", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check send status", exact: true }).click();
  await expect(page.getByLabel("Email message history", { exact: true }).getByText("Would Tuesday morning work?", { exact: true })).toBeVisible();
  const state = await control(request, "inspect");
  expect(state.sends).toBe(1); expect(state.attempts).toHaveLength(2);
  expect(state.attempts[0].key).toBe(state.attempts[1].key);
});

test("honors mailbox grants and dashboard read-only access", async ({ page, request }) => {
  await signIn(page, "viewer"); await openThread(page);
  await expect(page.getByRole("button", { name: "Send reply", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save private draft", exact: true })).toBeDisabled();
  await page.context().clearCookies(); await signIn(page, "readonly"); await openThread(page);
  await expect(page.getByRole("button", { name: "Send reply", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save private draft", exact: true })).toBeEnabled();
  await control(request, "revoke"); await page.reload();
  await expect(page.getByText("Could you build our website and an AI receptionist?", { exact: true })).toHaveCount(0);
  const revokedAttachment = await page.request.get("/api/dashboard/inbox/attachments?mailbox=address-sales&message=message-website&attachment=attachment-brief");
  expect(revokedAttachment.status()).toBe(403);
  await page.context().clearCookies(); await signIn(page, "unapproved");
  await expect(page.getByLabel("Email message history", { exact: true })).toHaveCount(0);
  expect((await control(request, "inspect")).sends).toBe(0);
});

test("searches conversations and stays usable at narrow widths", async ({ page }) => {
  await signIn(page);
  await page.getByRole("searchbox", { name: "Search email conversations" }).fill("Quote");
  await page.getByRole("button", { name: "Apply email filters" }).click();
  await expect(page.getByRole("heading", { name: "Quote follow-up", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Website project", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/inbox?channel=email"); await openThread(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
    await expect(page.getByRole("button", { name: "Send reply", exact: true })).toBeVisible();
  }
});
