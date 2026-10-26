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
test("schedules a reviewed call follow-up in My Day and completes it with an outcome",async({page,request},info)=>{
  await control(request,"voicemail");await signIn(page);await openCustomer(page);await page.getByRole("tab",{name:"Call",exact:true}).click();
  const composer=page.locator(".voice-call-composer");await composer.getByRole("button",{name:"Connect phone",exact:true}).click();await expect(composer.getByRole("button",{name:"Call now",exact:true})).toBeEnabled();await composer.getByRole("button",{name:"Call now",exact:true}).click();
  await expect.poll(async()=>(await control(request,"inspect")).connects.length).toBe(1);await control(request,"connected-recording");await page.reload();
  const recording=page.getByRole("region",{name:"Call recording",exact:true});await recording.getByText("Transcript, summary & follow-ups",{exact:true}).click();
  await recording.getByLabel("Suggested follow-up 1",{exact:true}).fill("Send Jordan the website proposal");await recording.getByRole("button",{name:"Create task",exact:true}).click();
  const scheduler=page.getByRole("dialog",{name:"Schedule a follow-up",exact:true});
  await expect(scheduler).toBeVisible();await page.keyboard.press("Escape");await expect(scheduler).toHaveCount(0);await expect(recording.getByRole("button",{name:"Create task",exact:true})).toBeFocused();await recording.getByRole("button",{name:"Create task",exact:true}).click();
  const form=scheduler.getByRole("form",{name:"Schedule follow-up 1",exact:true});await expect(form.getByRole("textbox",{name:"Task title *",exact:true})).toHaveValue("Send Jordan the website proposal");
  await form.getByRole("combobox",{name:"Assign to *",exact:true}).selectOption("voice-austin");
  await form.locator('input[name="dueAtLocal"]').fill(new Date(Date.now()+86400000).toISOString().slice(0,16));await form.getByRole("textbox",{name:"Task notes (optional)",exact:true}).fill("Include the AI receptionist scope.");
  expect((await control(request,"inspect")).tasks).toHaveLength(0);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await scheduler.screenshot({path:dashboardPreviewPath(`call-follow-up-schedule-${info.project.name}.png`)});
  await form.getByRole("button",{name:"Save follow-up task",exact:true}).click();await expect(recording.getByRole("link",{name:"View scheduled task",exact:true})).toBeVisible();
  const saved=(await control(request,"inspect")).tasks;expect(saved).toHaveLength(1);expect(saved[0].owner_user_id).toBe("voice-austin");
  await page.reload();await recording.getByText("Transcript, summary & follow-ups",{exact:true}).click();await expect(recording.getByRole("button",{name:"Create task",exact:true})).toHaveCount(0);
  await page.goto("/dashboard/sales/today");await expect(page.getByRole("link",{name:"Send Jordan the website proposal",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"Team",exact:true}).click();await expect(page.getByRole("link",{name:"Send Jordan the website proposal",exact:true})).toBeVisible();await page.getByRole("link",{name:"Send Jordan the website proposal",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Send Jordan the website proposal",exact:true})).toBeVisible();await expect(page.locator(".voice-task-facts").getByText("Fixture austin",{exact:true})).toBeVisible();
  const edit=page.getByRole("form",{name:"Save task changes",exact:true});await edit.getByRole("combobox",{name:"Assign to *",exact:true}).selectOption("voice-owner");await edit.getByRole("textbox",{name:"Task title *",exact:true}).fill("Review the final website proposal");await edit.getByRole("button",{name:"Save task changes",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Review the final website proposal",exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo({top:0,behavior:"instant"});});
  await page.screenshot({path:dashboardPreviewPath(`call-follow-up-task-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important;}"});
  await page.getByRole("link",{name:"My day",exact:true}).last().click();await expect(page.getByRole("link",{name:"Review the final website proposal",exact:true})).toBeVisible();
  await page.screenshot({path:dashboardPreviewPath(`call-follow-up-my-day-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important;}"});
  await page.getByRole("link",{name:"Review the final website proposal",exact:true}).click();const outcome=page.getByRole("form",{name:"Save task outcome",exact:true});await outcome.getByRole("textbox",{name:"Outcome *",exact:true}).fill("Reviewed the proposal and agreed the next step.");await outcome.getByRole("button",{name:"Save task outcome",exact:true}).click();
  await expect(page.getByText("Reviewed the proposal and agreed the next step.",{exact:false})).toBeVisible();await expect(page.getByRole("form",{name:"Save task changes",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"My day",exact:true}).last().click();await expect(page.getByRole("link",{name:"Review the final website proposal",exact:true})).toHaveCount(0);expect((await control(request,"inspect")).tasks).toHaveLength(1);
});
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

 test("saves personal-phone-only routing without changing recording preferences",async({page},info)=>{
  await signIn(page);await page.goto("/dashboard/settings#calling");
  const form=page.getByRole("form",{name:"Save incoming call destination",exact:true});
  await form.getByRole("combobox",{name:"Ring incoming calls on",exact:true}).selectOption("forward");
  await form.getByRole("combobox",{name:"Receiving teammate",exact:true}).selectOption("voice-owner");
  await form.getByLabel("Forwarding mobile number",{exact:true}).fill("4045550199");
  await form.getByRole("button",{name:"Save incoming call destination",exact:true}).click();
  await expect(form.getByRole("status")).toContainText("Incoming call destination saved");
  await page.reload();await expect(form.getByLabel("Forwarding mobile number",{exact:true})).toHaveValue("+14045550199");
  await expect(form.getByRole("combobox",{name:"Ring incoming calls on",exact:true})).toHaveValue("forward");
  await expect(page.getByLabel("Automatically record answered calls",{exact:true})).toBeChecked();
  expect((await new AxeBuilder({page}).include('#calling').withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await form.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/mobile-forwarding-${info.project.name}.png`,style:"nextjs-portal{display:none!important;}"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });


test("chooses a labeled alternate phone and calls it inside the same customer conversation",async({page,request},info)=>{
  await control(request,"voicemail");await signIn(page);await openCustomer(page);
  await expect(page).toHaveURL(/conversation=/);
  const originalConversation=new URL(page.url()).searchParams.get("conversation");
  const nav=page.getByRole("navigation",{name:"Conversation panes",exact:true});
  if(await nav.isVisible()) await nav.getByRole("button",{name:"Details",exact:true}).click();
  const numbers=page.getByRole("region",{name:"Phone numbers",exact:true});
  await numbers.getByText("Add another number",{exact:true}).click();
  await numbers.getByLabel("Phone number",{exact:true}).fill("4045550199");
  await numbers.getByLabel("Label",{exact:true}).fill("Website");
  await numbers.getByRole("button",{name:"Add number",exact:true}).click();
  await expect(numbers.getByText("(404) 555-0199",{exact:true})).toBeVisible();
  if(await nav.isVisible()) await nav.getByRole("button",{name:"Thread",exact:true}).click();
  await page.getByRole("tab",{name:"Call",exact:true}).click();
  const composer=page.locator(".voice-call-composer");
  await composer.getByRole("combobox",{name:"Customer phone",exact:true}).selectOption({label:"Website · (404) 555-0199"});
  await composer.getByRole("button",{name:"Connect phone",exact:true}).click();
  await expect(composer.getByRole("button",{name:"Call now",exact:true})).toBeEnabled();
  await composer.screenshot({path:`test-results/alternate-call-${info.project.name}.png`});
  await composer.getByRole("button",{name:"Call now",exact:true}).click();
  await expect.poll(async()=>(await control(request,"inspect")).connects.length).toBe(1);
  expect((await control(request,"inspect")).connects[0].to).toBe("+14045550199");
  expect(new URL(page.url()).searchParams.get("conversation")).toBe(originalConversation);
});
