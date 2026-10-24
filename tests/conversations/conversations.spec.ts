import { dashboardPreviewPath } from "../dashboard-theme-state";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
type Source = { id: string; conversation_id: string; channel: string; thread_id: string | null; sms_conversation_id: string | null };
async function control(request: APIRequestContext, action: string, fields: Record<string,string> = {}) {
  const response=await request.post("http://127.0.0.1:3151/control",{headers:{authorization:"Bearer conversations-synthetic-control"},data:{action,...fields}});
  expect(response.ok()).toBeTruthy();
  return await response.json();
}
async function signIn(page:Page,name="owner") {
  page.setDefaultTimeout(20000);
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(`${name}@example.test`);
  await page.getByLabel("Password",{exact:true}).fill("Conversations-test-password-2026");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/analytics)?$/);
  await page.goto("/dashboard/inbox");
  await expect(page.getByRole("region",{name:"Customer conversations",exact:true})).toBeVisible();
}
async function pane(page:Page,name:"Conversations"|"Thread"|"Details") {
  const nav=page.getByRole("navigation",{name:"Conversation panes",exact:true});
  if (await nav.isVisible()) await nav.getByRole("button",{name,exact:true}).click();
}
async function combine(page:Page,request:APIRequestContext) {
  const state=await control(request,"inspect");
  const sources=state.sources as Source[];
  const sms=sources.find(s=>s.channel==="sms")!;
  const email=sources.find(s=>s.thread_id==="thread-website")!;
  expect(sms).toBeTruthy();expect(email).toBeTruthy();
  await page.goto(`/dashboard/inbox?conversation=${sms.conversation_id}`);
  await pane(page,"Details");
  await page.getByText("Combine conversations",{exact:true}).click();
  await page.getByRole("combobox",{name:"Move this history into",exact:true}).selectOption(email.conversation_id);
  await page.getByRole("checkbox",{name:"I reviewed the relationship and want to combine these conversation histories.",exact:true}).check();
  await page.getByRole("button",{name:"Combine conversation histories",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`conversation=${email.conversation_id}`));
  await pane(page,"Details");
  const connected=page.getByText("Connected CRM records",{exact:true});
  const connect=page.getByText("Connect this conversation",{exact:true});
  if (await connected.isVisible()) {
    if ((await connected.locator("xpath=ancestor::details").getAttribute("open")) === null) await connected.click();
  } else if (await connect.isVisible()) {
    if ((await connect.locator("xpath=ancestor::details").getAttribute("open")) === null) await connect.click();
  }
  await page.getByRole("combobox",{name:"Contact",exact:true}).selectOption(state.contactId);
  await page.getByRole("combobox",{name:"Business",exact:true}).selectOption(state.businessId);
  await page.getByRole("combobox",{name:"Website inquiry",exact:true}).selectOption(state.leadId);
  await page.getByRole("button",{name:"Save connected records",exact:true}).click();
  await expect(page.getByRole("form",{name:"Save connected records",exact:true}).getByRole("status")).toContainText(/connected|updated|linked/i);
  await pane(page,"Thread");
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Email: Could you build our website and an AI receptionist?",{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Text: Tuesday morning works for our website review.",{exact:true})).toBeVisible();
  return email.conversation_id;
}
test.beforeEach(async({request})=>{await control(request,"reset");});

test("chooses a person first and opens a lead directly in the Inbox", async ({page,request}, info) => {
  await signIn(page);
  await page.getByRole("link",{name:"New conversation",exact:true}).click();
  await expect(page.getByRole("heading",{name:"New conversation",exact:true})).toBeVisible();
  await page.getByRole("searchbox",{name:"Find a contact or lead"}).fill("Taylor");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.locator(".conversation-recipient-result")).toHaveCount(1);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:`test-results/recipient-picker-${info.project.name}.png`,fullPage:true,caret:"initial",style:"nextjs-portal{display:none!important;}"});
  await page.getByRole("link",{name:/Taylor Example.*Contact/}).click();
  await expect(page.getByRole("region",{name:"Selected customer conversation",exact:true}).getByRole("heading",{name:"Taylor Example",exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true})).toContainText("Taylor has a separate request.");
  const state=await control(request,"inspect");
  await page.goto(`/dashboard/leads/${state.leadId}`);
  await page.getByRole("link",{name:"Contact lead",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`lead=${state.leadId}`));
  await expect(page.getByRole("region",{name:"Selected customer conversation",exact:true}).getByRole("heading",{name:"Jordan Example",exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true})).toContainText("Tuesday morning");
  expect((await control(request,"inspect")).smsCreates).toHaveLength(0);
});

test("prefills a new lead, preserves its draft and keeps first SMS and email together", async ({page,request},info) => {
  const lead=await control(request,"newLead");
  await signIn(page);
  await page.goto(`/dashboard/inbox?lead=${lead.id}`);
  const sms=page.getByRole("form",{name:"Compose SMS",exact:true});
  await expect(sms.getByRole("textbox",{name:"Recipient phone *",exact:true})).toHaveValue("+16785550103");
  await sms.getByRole("textbox",{name:"Text message *",exact:true}).fill("First message for Morgan");
  await sms.getByRole("button",{name:"Save private draft",exact:true}).click();
  await expect(sms.getByRole("status").filter({hasText:"Private draft saved"})).toBeVisible();
  await page.reload();
  await expect(sms.getByRole("textbox",{name:"Text message *",exact:true})).toHaveValue("First message for Morgan");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
  await sms.getByRole("button",{name:"Send text",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`test-results/recipient-start-${info.project.name}.png`,fullPage:true,style:"nextjs-portal{display:none!important;}"});
  await sms.getByRole("button",{name:"Send text",exact:true}).click();
  await expect(page).toHaveURL(/conversation=/);
  const canonical=new URL(page.url()).searchParams.get("conversation");
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true})).toContainText("First message for Morgan");
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  const email=page.getByRole("form",{name:"Compose email",exact:true});
  await expect(email.getByRole("textbox",{name:"To *",exact:true})).toHaveValue("morgan@example.test");
  await email.getByRole("textbox",{name:"Subject *",exact:true}).fill("Your project");
  await email.getByRole("textbox",{name:"Message *",exact:true}).fill("Email follow-up for Morgan");
  await email.getByRole("button",{name:"Send email",exact:true}).click();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true})).toContainText("Email follow-up for Morgan");
  expect(new URL(page.url()).searchParams.get("conversation")).toBe(canonical);
  const state=await control(request,"inspect");
  expect(state.sources.filter((s:Source)=>s.conversation_id===canonical).map((s:Source)=>s.channel).sort()).toEqual(["email","sms"]);
  expect(state.smsCreates).toHaveLength(1);expect(state.emailSends).toBe(1);
  await page.goto(`/dashboard/inbox?lead=${lead.id}`);
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true})).toContainText("First message for Morgan");
});

test("keeps an unresolved first text available after refreshing the recipient view", async ({page,request}) => {
  const lead=await control(request,"newLead");
  await signIn(page);await page.goto(`/dashboard/inbox?lead=${lead.id}`);
  await control(request,"unknownSms");
  await page.getByRole("textbox",{name:"Text message *",exact:true}).fill("Uncertain first text");
  await page.getByRole("button",{name:"Send text",exact:true}).click();
  await expect(page.getByRole("button",{name:"Check SMS status",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Check SMS status",exact:true})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Text message *",exact:true})).toHaveValue("Uncertain first text");
  expect((await control(request,"inspect")).smsCreates).toHaveLength(1);
});

test("recovers an uncertain first email after its new thread is discovered without sending twice", async ({page,request}) => {
  const lead=await control(request,"newLead");
  await signIn(page);await page.goto(`/dashboard/inbox?lead=${lead.id}`);
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  await page.getByRole("textbox",{name:"Subject *",exact:true}).fill("First email");
  await page.getByRole("textbox",{name:"Message *",exact:true}).fill("Uncertain first email");
  await control(request,"unknownMail");
  await page.getByRole("button",{name:"Send email",exact:true}).click();
  await expect(page.getByRole("button",{name:"Check send status",exact:true})).toBeVisible();
  await control(request,"refreshMailIndex");await page.reload();
  await expect(page.getByRole("button",{name:"Check send status",exact:true})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue("Uncertain first email");
  await page.getByRole("button",{name:"Check send status",exact:true}).click();
  await expect(page.getByRole("button",{name:"Send reply",exact:true})).toBeEnabled();
  expect((await control(request,"inspect")).emailSends).toBe(1);
  await expect(page).toHaveURL(/conversation=/);
});

test("keeps new-recipient drafts separate and respects read-only send grants", async ({page,request}) => {
  const lead=await control(request,"newLead");
  await signIn(page,"readonly");await page.goto(`/dashboard/inbox?lead=${lead.id}`);
  await expect(page.getByRole("button",{name:"Send text",exact:true})).toBeDisabled();
  await page.getByRole("textbox",{name:"Text message *",exact:true}).fill("Private Morgan draft");
  await page.getByRole("button",{name:"Save private draft",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Private draft saved"})).toBeVisible();
  await page.goto("/dashboard/inbox?contact=00000000-0000-4000-8000-000000000904");
  await page.getByRole("tab",{name:"SMS",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Text message *",exact:true})).toBeEmpty();
  await expect(page.getByRole("textbox",{name:"Recipient phone *",exact:true})).toHaveValue("+16785550102");
  await expect(page.getByRole("button",{name:"Send text",exact:true})).toBeDisabled();
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  await expect(page.getByRole("button",{name:"Send reply",exact:true})).toBeDisabled();
});

test("combines customer history and exposes agency context in a responsive workspace",async({page,request},info)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await signIn(page);await combine(page,request);
  const timeline=page.getByRole("region",{name:"Conversation timeline",exact:true});
  await expect(timeline.getByText("Mail-only legacy note",{exact:true})).toBeVisible();
  await expect(timeline.getByText("SMS-only legacy note",{exact:true})).toBeVisible();
  await expect(page.locator('img[src*="tracking.example"]')).toHaveCount(0);
  await expect(page.getByText("private@example.test",{exact:true})).toHaveCount(0);
  await pane(page,"Details");
  await expect(page.getByText("Website discovery call",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:/Mockup preview/})).toHaveAttribute("href","https://example.test/mockup");
  await pane(page,"Thread");
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
    await pane(page,"Thread");
    await expect(page.getByRole("tablist",{name:"Communication channel",exact:true})).toBeVisible();
  }
  await page.setViewportSize(info.project.name==="phone"?{width:390,height:844}:{width:1440,height:1000});
  await page.locator(".conversation-details-pane").evaluate(node=>{node.scrollTop=0;});
  await page.locator(".conversation-timeline").evaluate(node=>{node.scrollTop=0;});
  await expect(page.getByRole("button",{name:"Send reply",exact:true})).toBeInViewport();
  await expect(timeline.getByText("Email: Could you build our website and an AI receptionist?",{exact:true})).toBeInViewport();
  await page.screenshot({path: dashboardPreviewPath(`conversations-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important;}"});
  if (info.project.name === "phone") {
    for (const name of ["Conversations", "Details"] as const) {
      await pane(page, name);
      await page.locator(".conversation-details-pane").evaluate(node=>{node.scrollTop=0;});
      await page.screenshot({path: dashboardPreviewPath(`conversations-${name.toLowerCase()}-phone.png`),style:"nextjs-portal{display:none!important;}"});
    }
    await pane(page, "Thread");
  }
  const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,message:n.failureSummary}))}))).toEqual([]);
  expect(errors).toEqual([]);
});

test("keeps draft text across channel changes and sends from the same selected customer",async({page,request},info)=>{
  await signIn(page);const id=await combine(page,request);
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  const email=page.getByRole("tabpanel",{name:"Email",exact:true});
  await email.getByRole("textbox",{name:"Message *",exact:true}).fill("Email draft to the customer.");
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.getByLabel("Appearance", { exact: true }).selectOption(process.env.DASHBOARD_TEST_THEME || "light");
  if (mobile) await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue("Email draft to the customer.");
  await page.getByRole("tab",{name:"SMS",exact:true}).click();
  const sms=page.getByRole("tabpanel",{name:"SMS",exact:true});
  await expect(sms.getByText("Text details", { exact: true })).toHaveCount(0);
  await sms.getByRole("textbox",{name:"Text message *",exact:true}).fill("Text draft to the customer.");
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue("Email draft to the customer.");
  expect((await control(request,"inspect")).emailSends).toBe(0);
  await email.getByRole("button",{name:"Send reply",exact:true}).click();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Email draft to the customer.",{exact:true})).toBeVisible();
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue("");
  await email.getByRole("textbox",{name:"Message *",exact:true}).fill("A new email draft after the confirmed send.");
  await expect(page).toHaveURL(new RegExp(`conversation=${id}`));
  await page.getByRole("tab",{name:"SMS",exact:true}).click();
  await expect(sms.getByRole("textbox",{name:"Text message *",exact:true})).toHaveValue("Text draft to the customer.");
  await expect(sms.locator('[name="permissionConfirmed"], [name="permissionEvidence"]')).toHaveCount(0);
  await sms.getByRole("button",{name:"Send text",exact:true}).click();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Text draft to the customer.",{exact:true})).toBeVisible();
  await page.locator(".conversation-details-pane").evaluate(node=>{node.scrollTop=0;});
  await page.screenshot({path: dashboardPreviewPath(`conversations-outgoing-${info.project.name}.png`),style:"nextjs-portal{display:none!important;}"});
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue("A new email draft after the confirmed send.");
  const state=await control(request,"inspect");expect(state.emailSends).toBe(1);expect(state.smsCreates).toHaveLength(1);
  await page.getByRole("tab",{name:"Note",exact:true}).click();
  await page.getByLabel("Note *",{exact:true}).fill("Austin should present the mockup next.");
  await page.getByRole("button",{name:"Add internal note",exact:true}).click();
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Austin should present the mockup next.",{exact:true})).toBeVisible();
});

test("assigns follow-up work and reopens a completed conversation after a customer reply",async({page,request})=>{
  await signIn(page);await combine(page,request);await pane(page,"Details");
  await page.getByRole("combobox",{name:"Assigned teammate",exact:true}).selectOption("conv-austin");
  await page.getByRole("combobox",{name:"Work status",exact:true}).selectOption("done");
  await page.getByRole("button",{name:"Save ownership and follow-up",exact:true}).click();
  await expect(page.getByRole("form",{name:"Save ownership and follow-up",exact:true}).getByRole("status")).toContainText(/saved|updated/i);
  await control(request,"incomingSms",{text:"We have another website question."});
  await page.reload();await pane(page,"Details");
  await expect(page.getByRole("combobox",{name:"Work status",exact:true})).toHaveValue("needs_reply");
  await expect(page.getByRole("combobox",{name:"Assigned teammate",exact:true})).toHaveValue("conv-austin");
  await page.getByLabel("Remind at",{exact:true}).fill(new Date(Date.now()+48*60*60*1000).toISOString().slice(0,16));
  await page.getByRole("button",{name:"Save ownership and follow-up",exact:true}).click();
  await expect(page.getByRole("form",{name:"Save ownership and follow-up",exact:true}).getByRole("status")).toContainText(/saved|updated/i);
  await expect(page.getByLabel("Remind at",{exact:true})).not.toHaveValue("");
  await pane(page,"Thread");
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("We have another website question.",{exact:true})).toBeVisible();
});

test("uncertain sends keep their original request across channel switches and refresh",async({page,request})=>{
  await signIn(page);const id=await combine(page,request);
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  let email=page.getByRole("tabpanel",{name:"Email",exact:true});
  await email.getByRole("textbox",{name:"Message *",exact:true}).fill("Email recovery stays with this customer.");
  await control(request,"unknownMail");await email.getByRole("button",{name:"Send reply",exact:true}).click();
  await expect(email.getByRole("button",{name:"Check send status",exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"SMS",exact:true}).click();await page.reload();
  await page.getByRole("tab",{name:"Email",exact:true}).click();email=page.getByRole("tabpanel",{name:"Email",exact:true});
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveAttribute("readonly","");
  await expect(email.getByRole("button",{name:"Suggest message",exact:true})).toBeDisabled();
  await email.getByRole("button",{name:"Check send status",exact:true}).click();
  await expect(email.getByRole("button",{name:"Send reply",exact:true})).toBeEnabled();
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue("");
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Email recovery stays with this customer.",{exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"SMS",exact:true}).click();
  const sms=page.getByRole("tabpanel",{name:"SMS",exact:true});
  await expect(sms.getByText("Text details", { exact: true })).toHaveCount(0);
  await sms.getByRole("textbox",{name:"Text message *",exact:true}).fill("Text recovery stays with this customer.");
  await control(request,"unknownSms");await sms.getByRole("button",{name:"Send text",exact:true}).click();
  await expect(sms.getByRole("button",{name:"Check SMS status",exact:true})).toBeVisible();
  await page.reload();await page.getByRole("tab",{name:"SMS",exact:true}).click();
  const receipt=await control(request,"smsStatus");expect(receipt.status).toBe(204);
  await sms.getByRole("button",{name:"Check SMS status",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`conversation=${id}`));
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Text recovery stays with this customer.",{exact:true})).toBeVisible();
  const state=await control(request,"inspect");expect(state.emailSends).toBe(1);expect(state.emailAttempts).toHaveLength(2);expect(state.emailAttempts[0].key).toBe(state.emailAttempts[1].key);expect(state.smsCreates).toHaveLength(1);
});

test("loads older email history within the combined timeline",async({page,request})=>{
  await control(request,"manyHistory");await signIn(page);await combine(page,request);
  const timeline=page.getByRole("region",{name:"Conversation timeline",exact:true});
  await expect(timeline.getByText("Earlier email 0",{exact:true})).toHaveCount(0);
  await timeline.getByRole("button",{name:/Load earlier/}).click();
  await expect(timeline.getByText("Earlier email 0",{exact:true})).toBeVisible();
});

test("revoked Mail access hides its messages and notes while SMS remains available",async({page,request})=>{
  await signIn(page);const id=await combine(page,request);
  await control(request,"revokeMail");await page.reload();await pane(page,"Thread");
  await expect(page.getByText("Email: Could you build our website and an AI receptionist?",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Mail-only legacy note",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("region",{name:"Conversation timeline",exact:true}).getByText("Text: Tuesday morning works for our website review.",{exact:true})).toBeVisible();
  await expect(page.getByText("SMS-only legacy note",{exact:true})).toBeVisible();
  const attachment=await page.request.get("/api/dashboard/inbox/attachments?mailbox=address-sales&message=message-website&attachment=attachment-brief");expect(attachment.status()).toBe(403);
  await page.context().clearCookies();await signIn(page,"smsonly");await page.goto(`/dashboard/inbox?conversation=${id}`);await pane(page,"Thread");
  await expect(page.getByText("Mail-only legacy note",{exact:true})).toHaveCount(0);
  await expect(page.getByText("SMS-only legacy note",{exact:true})).toBeVisible();
});

test("viewer can read the combined history but cannot send or change ownership",async({page,request})=>{
  await signIn(page);const id=await combine(page,request);
  await page.context().clearCookies();await signIn(page,"viewer");await page.goto(`/dashboard/inbox?conversation=${id}`);await pane(page,"Thread");
  await page.getByRole("tab",{name:"Email",exact:true}).click();await expect(page.getByRole("button",{name:"Send reply",exact:true})).toBeDisabled();
  await page.getByRole("tab",{name:"SMS",exact:true}).click();await expect(page.getByRole("button",{name:"Send text",exact:true})).toBeDisabled();
  await pane(page,"Details");await expect(page.getByRole("button",{name:"Save ownership and follow-up",exact:true})).toBeDisabled();
  expect((await control(request,"inspect")).smsCreates).toHaveLength(0);
});

test("discovers more than one Mail page and searches indexed customer addresses",async({page,request})=>{
  await control(request,"manyEmails");await signIn(page);
  await page.reload();
  await page.getByRole("searchbox",{name:"Search people, businesses or addresses",exact:true}).fill("person131@example.test");
  await page.getByRole("button",{name:"Apply conversation search",exact:true}).click();
  await expect(page.getByRole("region",{name:"Customer conversations",exact:true}).getByText("person131@example.test",{exact:true})).toBeVisible();
});


test("AI drafts use client context and both channels without sending or overwriting edits", async ({page,request}, info) => {
  await signIn(page); await combine(page,request);
  await page.getByRole("tab",{name:"SMS",exact:true}).click();
  const sms=page.getByRole("tabpanel",{name:"SMS",exact:true});
  const message=sms.getByRole("textbox",{name:"Text message *",exact:true});
  await message.fill("My existing draft");
  await sms.getByRole("button",{name:"Suggest message",exact:true}).click();
  await sms.getByRole("button",{name:"Set up a meeting",exact:true}).click();
  await sms.getByLabel("Message direction").fill("Initial message after lead came in, looking for their first site");
  await sms.getByRole("button",{name:"Generate draft",exact:true}).click();
  const preview=sms.getByRole("region",{name:"Suggested message",exact:true});
  await expect(preview).toContainText("Jordan Example");
  await expect(message).toHaveValue("My existing draft");
  const state=await control(request,"inspect");
  expect(state.emailSends).toBe(0); expect(state.smsCreates).toHaveLength(0);
  const context=JSON.parse(state.aiRequests[0].input[0].content);
  expect(context.staffDirection).toContain("first site");
  expect(JSON.stringify(context.history)).toContain("Could you build our website");
  expect(JSON.stringify(context.history)).toContain("Tuesday morning");
  expect(JSON.stringify(context)).not.toContain("legacy note");
  expect(state.aiRequests[0].store).toBe(false);
  await expect(page.locator("body")).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:`test-results/ai-draft-${info.project.name}.png`,fullPage:info.project.name==="phone",style:"nextjs-portal{display:none!important;}"});
  await sms.getByRole("button",{name:"Use draft",exact:true}).click();
  await expect(message).toHaveValue(/Jordan Example/);
  await message.fill("Edited by me before sending");
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  const email=page.getByRole("tabpanel",{name:"Email",exact:true});
  const subject=await email.locator('[name="subject"]').inputValue();
  await email.getByRole("button",{name:"Suggest message",exact:true}).click();
  await email.getByRole("button",{name:"Generate draft",exact:true}).click();
  await expect(email.getByRole("button",{name:"Use draft",exact:true})).toBeEnabled();
  await email.getByRole("button",{name:"Use draft",exact:true}).click();
  await expect(email.locator('[name="subject"]')).toHaveValue(subject);
  await page.getByRole("tab",{name:"SMS",exact:true}).click();
  await expect(message).toHaveValue("Edited by me before sending");
  await sms.getByRole("button",{name:"Suggest message",exact:true}).click();
  await sms.getByRole("button",{name:"Generate draft",exact:true}).click();
  await message.fill("Keep my newer edit");
  await expect(sms.getByRole("alert")).toContainText("changed");
  await expect(message).toHaveValue("Keep my newer edit");
  const final=await control(request,"inspect"); expect(final.smsCreates).toHaveLength(0); expect(final.emailSends).toBe(0);
});

test("AI drafts cover a new lead and preserve manual writing when the provider fails", async ({page,request}) => {
  const lead=await control(request,"newLead"); await signIn(page);
  await page.goto(`/dashboard/inbox?lead=${lead.id}`);
  await page.getByRole("tab",{name:"Email",exact:true}).click();
  const email=page.getByRole("tabpanel",{name:"Email",exact:true});
  await email.getByRole("button",{name:"Suggest message",exact:true}).click();
  await email.getByRole("button",{name:"Introduce us",exact:true}).click();
  await email.getByRole("button",{name:"Generate draft",exact:true}).click();
  await expect(email.getByRole("region",{name:"Suggested message"})).toContainText("Morgan New");
  await email.getByRole("button",{name:"Use draft",exact:true}).click();
  await expect(email.locator('[name="subject"]')).toHaveValue("Your website project");
  await control(request,"failAi");
  await email.getByRole("button",{name:"Suggest message",exact:true}).click();
  await email.getByRole("button",{name:"Generate draft",exact:true}).click();
  await expect(email.getByRole("alert")).toContainText("temporarily unavailable");
  await expect(email.getByRole("textbox",{name:"Message *",exact:true})).toHaveValue(/Morgan New/);
  expect((await control(request,"inspect")).emailSends).toBe(0);
});
