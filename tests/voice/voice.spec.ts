import { dashboardPreviewPath } from "../dashboard-theme-state";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function control(request: APIRequestContext, action: string, fields: Record<string, unknown> = {}) {
  const response = await request.post("http://127.0.0.1:3161/control", { headers: { authorization: "Bearer voice-synthetic-control" }, data: { action, ...fields } });
  expect(response.ok()).toBeTruthy(); return response.json();
}
async function signIn(page: Page, user = "owner") {
  page.setDefaultTimeout(20000); await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(`${user}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Voice-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/analytics)?$/);
  await page.goto("/dashboard/inbox");
  // The development-only Next diagnostics widget overlaps mobile call buttons.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}
async function phone(page: Page) {
  const panel = page.getByRole("region", { name: "Browser phone", exact: true });
  if (!(await panel.isVisible())) {
    const launcher = page.locator(".voice-launcher");
    if (await launcher.isVisible()) await launcher.click();
    else await page.getByRole("button", { name: "Open browser phone", exact: true }).click();
  }
  return panel;
}
async function connect(page: Page, request: APIRequestContext) {
  const panel = await phone(page); await panel.getByRole("button", { name: "Connect phone", exact: true }).click();
  await expect(panel.getByText("Phone connected", { exact: true })).toBeVisible();
  await expect.poll(async () => (await control(request, "inspect")).presence.length).toBe(1);
  return panel;
}
async function openCustomer(page: Page) {
  const link = page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Jordan Example", exact: true }) });
  await link.click();
  const nav = page.getByRole("navigation", { name: "Conversation panes", exact: true });
  if (await nav.isVisible()) await nav.getByRole("button", { name: "Thread", exact: true }).click();
}
test.beforeEach(async ({ request }) => { await control(request, "reset"); });
test("keeps protected call recordings, transcripts and editable follow-ups in the conversation",async({page,request},info)=>{
  await control(request,"voicemail");await signIn(page);await openCustomer(page);
  await page.getByRole("tab",{name:"Call",exact:true}).click();
  const composer=page.locator(".voice-call-composer");
  await composer.getByRole("button",{name:"Connect phone",exact:true}).click();
  await expect(composer.getByRole("button",{name:"Call now",exact:true})).toBeEnabled();
  await composer.getByRole("button",{name:"Call now",exact:true}).click();
  await expect.poll(async()=>(await control(request,"inspect")).connects.length).toBe(1);
  await control(request,"connected-recording");
  await page.reload();
  const recording=page.getByRole("region",{name:"Call recording",exact:true});
  await recording.getByText("Transcript, summary & follow-ups",{exact:true}).click();
  await expect(recording.getByText("Jordan requested a website proposal for next week.",{exact:true})).toBeVisible();
  const audio=recording.getByLabel("Play call recording",{exact:true});
  const src=await audio.getAttribute("src");expect(src).toMatch(/^\/api\/dashboard\/voice\/recordings\//);
  const media=await page.request.get(src!);expect(media.status()).toBe(200);expect(media.headers()["cache-control"]).toContain("no-store");
  await recording.getByText("Full transcript",{exact:true}).click();
  await expect(recording.locator(".voice-transcript > div")).toContainText("Please send a website proposal next week.");
  await recording.getByText("Full transcript",{exact:true}).click();
  const followUp=recording.getByLabel("Suggested follow-up 1",{exact:true});await followUp.fill("Prepare a website and AI receptionist proposal.");await expect(followUp).toHaveValue("Prepare a website and AI receptionist proposal.");
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await recording.getByText("Transcript, summary & follow-ups",{exact:true}).click();
  await page.locator(".conversation-timeline").evaluate(node=>{const recording=node.querySelector(".voice-recording");if(recording)node.scrollTop+=recording.getBoundingClientRect().top-node.getBoundingClientRect().top-10;});
  await page.locator(".conversation-details-pane").evaluate(node=>{node.scrollTop=0;});
  await page.screenshot({path:dashboardPreviewPath(`call-recording-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important;}"});
  await recording.getByRole("button",{name:"Delete recording & analysis",exact:true}).click();
  await recording.getByRole("button",{name:"Confirm recording deletion",exact:true}).click();
  await expect(audio).toHaveCount(0);await expect(recording.getByText("Jordan requested a website proposal for next week.",{exact:true})).toHaveCount(0);expect((await page.request.get(src!)).status()).not.toBe(200);
});

test("makes one durable outbound call, mutes and retains it through client navigation", async ({ page, request }, info) => {
  await control(request, "voicemail"); await signIn(page); await openCustomer(page);
  await page.getByRole("tab", { name: "Call", exact: true }).click();
  const composer = page.locator(".voice-call-composer");
  await expect(composer.getByRole("combobox", { name: "Calling line", exact: true })).toHaveCount(0);
  await expect(composer.getByText("(678) 555-0100", { exact: true })).toBeVisible();
  await expect(composer.getByRole("combobox", { name: "Customer phone *", exact: true })).toHaveValue("(678) 555-0101");
  await page.locator(".conversation-composer-shell").evaluate((element) => { element.scrollTop = 0; });
  await expect(composer.getByRole("button", { name: "Connect phone", exact: true })).toBeInViewport({ ratio: .99 });
  await expect(composer.getByRole("combobox", { name: "Customer phone *", exact: true })).toBeInViewport({ ratio: .99 });
  await composer.screenshot({ path: dashboardPreviewPath(`voice-composer-disconnected-${info.project.name}.png`) });
  await composer.getByRole("button", { name: "Connect phone", exact: true }).click();
  await expect(composer.getByRole("button", { name: "Call now", exact: true })).toBeEnabled();
  const panel = page.getByRole("region", { name: "Browser phone", exact: true });
  await expect(panel).not.toBeVisible();
  await expect(composer.getByRole("button", { name: "Call now", exact: true })).toBeInViewport({ ratio: .99 });
  await composer.screenshot({ path: dashboardPreviewPath(`voice-composer-ready-${info.project.name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await expect(page.getByRole("combobox", { name: "Customer phone *", exact: true })).toBeInViewport();
  await page.getByRole("combobox", { name: "Customer phone *", exact: true }).fill("(678) 555-0101");
  await page.getByRole("form", { name: "Start browser call", exact: true }).getByRole("button", { name: "Call now", exact: true }).click();
  await expect(panel.locator(".voice-connection-state")).toContainText("Call in progress");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: dashboardPreviewPath(`voice-active-${info.project.name}.png`), fullPage: true });
  await panel.getByRole("button", { name: "Mute microphone", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Unmute microphone", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Changing appearance must not replace the persistent phone or its live call.
  await panel.getByRole("button", { name: "Minimize browser phone", exact: true }).click();
  if (info.project.name === "phone") await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  if (info.project.name === "phone") await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await phone(page);
  await expect(panel.locator(".voice-connection-state")).toContainText("Call in progress");
  await expect(panel.getByRole("button", { name: "Unmute microphone", exact: true })).toHaveAttribute("aria-pressed", "true");
  const state = await control(request, "inspect"); expect(state.connects).toHaveLength(1); expect(state.connects[0].keys).toEqual(["IntentToken"]); expect(state.connects[0].to).toBe("+16785550101");
  // The client Link must retain the layout's live phone rather than remount it.
  await panel.getByRole("link", { name: "Open customer conversation", exact: true }).click();
  await expect(panel.locator(".voice-connection-state")).toContainText("Call in progress");
  await panel.getByRole("button", { name: "End call", exact: true }).click();
  await expect(panel.getByText("Phone connected", { exact: true })).toBeVisible();
  expect((await control(request, "inspect")).connects).toHaveLength(1);
});

test("rings only registered approved staff and accepts an incoming call", async ({ page, request }) => {
  await signIn(page); const panel = await connect(page, request);
  await expect.poll(async () => (await control(request, "inspect")).devices.length).toBe(1);
  await control(request, "incoming");
  await expect(panel.getByText("Incoming call", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Accept call", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Accept call", exact: true }).click();
  await expect(panel.locator(".voice-connection-state")).toContainText("Call in progress");
  await panel.getByRole("button", { name: "End call", exact: true }).click();
  await expect(panel.getByText("Phone connected", { exact: true })).toBeVisible();
});

test("canceling a delayed incoming answer never accepts or opens audio afterward", async ({ page, request }) => {
  await signIn(page); const panel = await connect(page, request); await control(request, "incoming");
  await expect(panel.getByRole("button", { name: "Accept call", exact: true })).toBeEnabled();
  let intercepted = false, release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/dashboard/inbox**", async (route) => {
    if (!intercepted && route.request().method() === "POST" && route.request().postData()?.includes('"callId"')) {
      intercepted = true; const response = await route.fetch(); await gate; await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await panel.getByRole("button", { name: "Accept call", exact: true }).click();
    await expect.poll(() => intercepted).toBeTruthy();
    await panel.getByRole("button", { name: "End call", exact: true }).click();
  } finally { release(); }
  await expect(panel.getByText("Phone connected", { exact: true })).toBeVisible();
  await expect.poll(async () => (await control(request, "inspect")).accepts).toBe(0);
  expect((await control(request, "inspect")).stored.every((call: { answered_at: string | null }) => call.answered_at === null)).toBeTruthy();
});

test("declines without answering and refuses acceptance after access is revoked", async ({ page, request }) => {
  await signIn(page); const panel = await connect(page, request);
  await control(request, "incoming");
  await expect(panel.getByRole("button", { name: "Accept call", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Decline call", exact: true }).click();
  await expect(panel.getByText("Phone connected", { exact: true })).toBeVisible();
  await control(request, "incoming");
  await expect(panel.getByRole("button", { name: "Accept call", exact: true })).toBeEnabled();
  await control(request, "revoke");
  await panel.getByRole("button", { name: "Accept call", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("could not be accepted");
  expect((await control(request, "inspect")).stored.every((call: { answered_at: string | null }) => call.answered_at === null)).toBeTruthy();
});

test("plays scoped voicemail, deletes provider audio, and keeps a readable history", async ({ page, request }, info) => {
  await control(request, "close-hours"); await control(request, "voicemail"); await signIn(page); await openCustomer(page);
  const audio = page.getByLabel("Play voicemail recording", { exact: true }); await expect(audio).toBeVisible();
  const src = await audio.getAttribute("src"); expect(src).toMatch(/^\/api\/dashboard\/voice\/voicemails\//);
  const media = await page.request.get(src!); expect(media.status()).toBe(200); expect(media.headers()["content-type"]).toContain("audio/mpeg"); expect(media.headers()["cache-control"]).toContain("no-store");
  expect((await control(request, "inspect")).mediaReads).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Delete voicemail", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.locator(".conversation-timeline").evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: dashboardPreviewPath(`voice-${info.project.name}.png`), fullPage: true });
  await page.getByRole("button", { name: "Delete voicemail", exact: true }).click();
  await page.getByRole("button", { name: "Confirm voicemail deletion", exact: true }).click();
  await expect(page.getByText("This voicemail recording has been deleted.", { exact: true })).toBeVisible();
  await expect(audio).toHaveCount(0); expect((await control(request, "inspect")).deletes).toBe(1);
  expect((await page.request.get(src!)).status()).not.toBe(200);
});

test("shows an unsupported browser without registering it or placing a call", async ({ page, request }) => {
  await signIn(page); await page.evaluate(() => sessionStorage.setItem("voice-fixture-unsupported", "true"));
  const panel = await phone(page); await panel.getByRole("button", { name: "Connect phone", exact: true }).click();
  await expect(panel.getByText(/This browser cannot provide supported calling/)).toBeVisible();
  expect((await control(request, "inspect")).devices).toEqual([]); expect((await control(request, "inspect")).connects).toEqual([]);
});

test("saves routing and grants in Settings and refreshes phone permissions", async ({ page, request }) => {
  await signIn(page); await page.goto("/dashboard/settings#calling");
  const calling = page.locator("#calling");
  await calling.getByRole("combobox", { name: "Calling teammate *", exact: true }).selectOption("voice-unapproved");
  await calling.getByRole("checkbox", { name: "Start outbound calls", exact: true }).check();
  await calling.getByRole("button", { name: "Save calling access", exact: true }).click();
  await expect(calling.getByText("Voice permissions updated.", { exact: true })).toBeVisible();
  await calling.getByRole("textbox", { name: /^Voicemail greeting/ }).fill("Thank you for calling our synthetic test business. Please leave a message.");
  await calling.getByRole("button", { name: "Save call routing", exact: true }).click();
  await expect(calling.getByText("Call routing updated.", { exact: true })).toBeVisible();
  expect((await control(request, "inspect")).connects).toEqual([]);
});

test("read-only grants can review voicemail but cannot call, delete, or read after revocation", async ({ page, request }) => {
  await control(request, "voicemail"); await signIn(page, "readonly"); await openCustomer(page);
  const src = await page.getByLabel("Play voicemail recording", { exact: true }).getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Delete voicemail", exact: true })).toHaveCount(0);
  const panel = await phone(page); await expect(panel.getByRole("button", { name: "Connect phone", exact: true })).toHaveCount(0);
  await control(request, "revoke", { actor: "readonly" }); expect((await page.request.get(src!)).status()).not.toBe(200);
});

test("handles denied microphones and keeps the public microphone policy restrictive", async ({ page, request }) => {
  await control(request, "voicemail"); await signIn(page); await openCustomer(page);
  const dashboard = await page.request.get("/dashboard/inbox"); expect(dashboard.headers()["permissions-policy"]).toContain("microphone=(self)");
  const publicPage = await page.request.get("/"); expect(publicPage.headers()["permissions-policy"]).toContain("microphone=()");
  await page.evaluate(() => sessionStorage.setItem("voice-fixture-deny-microphone", "true"));
  await page.getByRole("tab", { name: "Call", exact: true }).click(); const panel = await connect(page, request);
  await panel.getByRole("button", { name: "Minimize browser phone", exact: true }).click();
  await page.getByRole("form", { name: "Start browser call", exact: true }).getByRole("button", { name: "Call now", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Microphone access was denied"); expect((await control(request, "inspect")).connects).toHaveLength(0);
});
