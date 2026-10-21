import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function control(request: APIRequestContext, action: string, data: Record<string, unknown> = {}) {
  const response = await request.post("http://127.0.0.1:3141/control", { headers: { authorization: "Bearer sms-fixture-control" }, data: { action, ...data } });
  expect(response.ok()).toBeTruthy(); return await response.json();
}
async function signIn(page: Page, user = "owner") {
  page.setDefaultTimeout(20000); await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(`${user}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Sms-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/analytics)?$/, { timeout: 20000 });
  await page.goto("/dashboard/inbox?channel=sms");
}
async function incoming(request: APIRequestContext, text?: string, sid?: string) {
  const result = await control(request, "incoming", { text, sid }); expect(result.status).toBe(200); return result;
}
async function openThread(page: Page) {
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "+16785550101", exact: true }) }).click();
  await expect(page.getByLabel("SMS message history", { exact: true })).toBeVisible();
}
async function permission(page: Page) {
  await page.getByRole("checkbox", { name: "I have permission to text this recipient about this conversation." }).check();
  await page.getByRole("textbox", { name: "Permission evidence *", exact: true }).fill("Customer requested a reply by text during our discovery call.");
}
test.beforeEach(async ({ request }) => { await control(request, "reset"); });

test("receives one signed message, links CRM context and keeps notes internal", async ({ page, request }, info) => {
  await incoming(request); await incoming(request);
  await signIn(page); await openThread(page);
  await expect(page.getByRole("article", { name: "Incoming text", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Mark SMS read", exact: true }).click();
  await expect(page.getByText("Read", { exact: true })).toBeVisible();
  if (!(await page.getByRole("combobox", { name: "Team status", exact: true }).isVisible())) await page.getByText("Conversation details", { exact: true }).click();
  await page.getByRole("combobox", { name: "Team status", exact: true }).selectOption("waiting");
  await page.getByRole("combobox", { name: "Assigned teammate", exact: true }).selectOption("sms-owner");
  await page.getByRole("combobox", { name: "Linked business", exact: true }).selectOption("00000000-0000-4000-8000-000000000802");
  await page.getByRole("combobox", { name: "Linked website inquiry", exact: true }).selectOption("00000000-0000-4000-8000-000000000803");
  await page.getByRole("button", { name: "Save SMS details", exact: true }).click();
  await expect(page.getByText("SMS conversation updated.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "New internal note", exact: true }).fill("Discuss the website and AI receptionist on Tuesday.");
  await page.getByRole("button", { name: "Add internal note", exact: true }).click();
  await expect(page.getByText("Discuss the website and AI receptionist on Tuesday.", { exact: true })).toBeVisible();
  expect((await control(request, "inspect")).creates).toHaveLength(0);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
  await page.screenshot({ path: `docs/previews/sms-${info.project.name}.png`, fullPage: true });
});

test("saves a private draft and sends a text once with separate delivered status", async ({ page, request }) => {
  await incoming(request); await signIn(page); await openThread(page);
  await page.getByRole("textbox", { name: "Text message *", exact: true }).fill("Thanks. Tuesday morning works for our discovery call.");
  await page.getByRole("button", { name: "Save private draft", exact: true }).click();
  await expect(page.getByText("Private draft saved. No text was sent.", { exact: true })).toBeVisible();
  expect((await control(request, "inspect")).creates).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Text message *", exact: true })).toHaveValue("Thanks. Tuesday morning works for our discovery call.");
  await permission(page); await page.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(page.getByRole("article", { name: "Outgoing text", exact: true })).toContainText("Thanks. Tuesday morning works for our discovery call.");
  expect((await control(request, "inspect")).creates).toHaveLength(1);
  const delivered = await control(request, "status"); expect(delivered.status).toBe(204);
  await page.reload(); await expect(page.getByRole("article", { name: "Outgoing text", exact: true })).toContainText("Delivered");
});

test("checks an uncertain send across refresh without creating a second provider message", async ({ page, request }) => {
  await signIn(page); await page.getByRole("link", { name: "New text", exact: true }).click();
  await page.getByRole("textbox", { name: "Recipient phone *", exact: true }).fill("+16785550101");
  await page.getByRole("textbox", { name: "Text message *", exact: true }).fill("Would Tuesday morning work for you?"); await permission(page);
  await control(request, "unknown"); await page.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check SMS status", exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Check SMS status", exact: true }).click();
  expect((await control(request, "inspect")).creates).toHaveLength(1);
  await expect(page.getByRole("textbox", { name: "Text message *", exact: true })).toHaveAttribute("readonly", "");
  expect((await control(request, "status")).status).toBe(204);
  await page.getByRole("button", { name: "Check SMS status", exact: true }).click();
  await expect(page.getByRole("article", { name: "Outgoing text", exact: true })).toContainText("Would Tuesday morning work for you?");
  expect((await control(request, "inspect")).creates).toHaveLength(1);
});

test("blocks opt-outs even from new compose and preserves them after a START request", async ({ page, request }) => {
  await incoming(request, "STOP", `SM${"5".repeat(32)}`); await signIn(page); await openThread(page);
  await expect(page.getByRole("button", { name: "Send text", exact: true })).toBeDisabled();
  await incoming(request, "START", `SM${"6".repeat(32)}`); await page.reload();
  await expect(page.getByRole("button", { name: "Send text", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "New text", exact: true }).click();
  await page.getByRole("textbox", { name: "Recipient phone *", exact: true }).fill("+16785550101");
  await page.getByRole("textbox", { name: "Text message *", exact: true }).fill("An attempted text to a blocked recipient."); await permission(page);
  await page.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(page.locator(".sms-composer").getByRole("alert")).toContainText(/opted out|Do not text|blocked/i);
  expect((await control(request, "inspect")).creates).toHaveLength(0);
});

test("enforces viewer, read-only and revoked number access", async ({ page, request }) => {
  await incoming(request); await signIn(page, "viewer"); await openThread(page);
  await expect(page.getByRole("button", { name: "Send text", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save private draft", exact: true })).toBeDisabled();
  await page.context().clearCookies(); await signIn(page, "readonly"); await openThread(page);
  await expect(page.getByRole("button", { name: "Send text", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save private draft", exact: true })).toBeEnabled();
  await control(request, "revoke", { userId: "sms-readonly" }); await page.reload();
  await expect(page.getByLabel("SMS message history", { exact: true })).toHaveCount(0);
  await page.context().clearCookies(); await signIn(page, "unapproved");
  await expect(page.getByRole("heading", { name: "Number access is required" })).toBeVisible();
});

test("keeps SMS usable at phone widths and rejects unsigned callbacks", async ({ page, request }) => {
  await incoming(request); await signIn(page); await openThread(page);
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    await expect(page.getByRole("button", { name: "Send text", exact: true })).toBeVisible();
  }
  const forged = await request.post("/api/integrations/twilio/sms/incoming", { form: { AccountSid: `AC${"1".repeat(32)}`, MessageSid: `SM${"7".repeat(32)}`, From: "+16785550101", To: "+16785550100", Body: "Forged inbound text" } });
  expect(forged.status()).toBe(401);
});

test("connects the provider-owned number and manages explicit teammate grants and sending status", async ({ page, request }) => {
  await control(request, "clear-number");
  await signIn(page);
  await page.goto("/dashboard/settings#sms");
  const panel = page.locator("#sms");
  const connect = panel.getByRole("form", { name: "Connect configured SMS number", exact: true });
  await expect(connect.getByRole("textbox")).toHaveValue("+16785550100");
  await expect(connect.getByRole("textbox")).toHaveAttribute("readonly", "");
  await connect.getByRole("button", { name: "Connect configured number", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "+16785550100", exact: true })).toBeVisible();
  const grants = panel.locator(".sms-settings-grants");
  await expect(grants).toContainText("Fixture owner");
  await expect(grants).not.toContainText("Fixture unapproved");
  const grantForm = panel.getByRole("form", { name: "Grant SMS number access for +16785550100", exact: true });
  await grantForm.getByRole("combobox", { name: "Teammate *", exact: true }).selectOption("sms-unapproved");
  await expect(grantForm.getByRole("checkbox", { name: "Allow reading conversations", exact: true })).toBeChecked();
  await expect(grantForm.getByRole("checkbox", { name: "Allow sending texts", exact: true })).not.toBeChecked();
  await grantForm.getByRole("button", { name: "Save number access", exact: true }).click();
  const granted = grants.locator(":scope > div").filter({ has: page.getByText("Fixture unapproved", { exact: true }) });
  await expect(granted).toContainText("Read only");
  await grantForm.getByRole("checkbox", { name: "Allow sending texts", exact: true }).check();
  await grantForm.getByRole("button", { name: "Save number access", exact: true }).click();
  await expect(granted).toContainText("Read and send");
  await granted.getByRole("button", { name: "Revoke access for Fixture unapproved", exact: true }).click();
  await expect(granted).toHaveCount(0);
  const statusForm = panel.getByRole("form", { name: "Change SMS status for +16785550100", exact: true });
  await statusForm.getByRole("button", { name: "Pause number", exact: true }).click();
  await expect(statusForm.getByRole("button", { name: "Resume number", exact: true })).toBeVisible();
  await expect(panel.locator(".sms-settings-number > header")).toContainText("Paused");
  await statusForm.getByRole("button", { name: "Resume number", exact: true }).click();
  await expect(statusForm.getByRole("button", { name: "Pause number", exact: true })).toBeVisible();
  await expect(panel.locator(".sms-settings-number > header")).toContainText("Sending enabled");
  expect((await control(request, "inspect")).creates).toHaveLength(0);
});
