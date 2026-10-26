import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dashboardPreviewPath } from "../dashboard-theme-state";

async function control(request: APIRequestContext, action = "inspect") {
  const response = await request.post("http://127.0.0.1:3181/control", {headers:{authorization:"Bearer factory-synthetic-control"},data:{action}});
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function step(request: APIRequestContext) {
  const response = await request.post("/api/cron/factory", {headers:{authorization:"Bearer factory-browser-local-worker-secret-1234567890"}});
  expect(response.status()).toBe(200);
  return response.json();
}
async function signIn(page: Page, role = "owner") {
  page.setDefaultTimeout(20000);
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(`${role}@example.test`);
  await page.getByLabel("Password",{exact:true}).fill("Factory-test-password-2026");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function openLeadPlan(page: Page, leadId: string) {
  await page.goto(`/dashboard/leads/${leadId}`);
  await page.getByRole("button",{name:"Research & plan website",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\/sales\/factory\/[0-9a-f-]+$/);
}
async function generate(request: APIRequestContext) {
  for(let i=0;i<4;i++) {
    const result=await step(request);
    expect(result.failed).toBe(0);
    const state=await control(request);
    if(!state.jobs.some((j:{status:string})=>["queued","running"].includes(j.status)))return state;
  }
  throw new Error("Fixture planning did not finish within four stages.");
}
test.beforeEach(async({request})=>{await control(request,"reset");});

test("researches a sparse lead, refines through chat, and approves only the reviewed plan",async({page,request},info)=>{
  await signIn(page);
  await page.goto("/dashboard/sales/factory");
  await page.getByLabel("Enable AI research").check();
  await page.getByLabel("Research new leads automatically").check();
  await page.getByLabel("Monthly research limit (USD)").fill("25");
  await page.getByRole("button",{name:"Save research settings",exact:true}).click();
  await expect(page.getByText("Website planning settings saved.",{exact:true})).toBeVisible();
  await openLeadPlan(page,(await control(request)).leadId);
  expect((await control(request)).calls).toBe(0);
  let state=await generate(request);
  expect(state.plans).toHaveLength(1);
  expect(state.builds).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Proposed website plan",exact:true})).toBeVisible();
  await expect(page.getByText("Company name and service area are not confirmed.",{exact:true})).toBeVisible();
  await page.getByLabel("Your direction",{exact:true}).fill("They mostly do commercial roofing. Emphasize estimate requests.");
  await expect(page.getByRole("button",{name:"Approve v1 & queue build",exact:true})).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("They mostly do commercial roofing. Emphasize estimate requests.");
  await page.getByRole("button",{name:"Send to planning agent",exact:true}).click();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("");
  await expect(page.getByRole("button",{name:"Approve v1 & queue build",exact:true})).toBeDisabled();
  state=await generate(request);
  expect(state.plans).toHaveLength(2);
  expect(state.builds).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("button",{name:"Approve v2 & queue build",exact:true})).toBeEnabled();
  await expect(page.getByText("Changed the audience and service direction to commercial roofing.",{exact:true}).first()).toBeVisible();
  const versions=page.getByLabel("Plan version",{exact:true});
  await versions.selectOption(state.plans[0].id);
  await expect(page.getByRole("button",{name:"Approve v1 & queue build",exact:true})).toBeDisabled();
  await versions.selectOption(state.plans[1].id);
  await page.getByLabel("Your direction",{exact:true}).fill("No change please. Thanks for the explanation.");
  await page.getByRole("button",{name:"Send to planning agent",exact:true}).click();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("");
  state=await generate(request);
  expect(state.plans).toHaveLength(2);
  await page.reload();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:dashboardPreviewPath(`factory-plan-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important}"});
  await page.getByRole("button",{name:"Approve v2 & queue build",exact:true}).click();
  await expect(page.getByText("Approved plan saved for the build queue",{exact:true})).toBeVisible();
  state=await control(request);
  expect(state.builds).toEqual([{plan_id:state.plans[1].id,status:"awaiting_builder"}]);
  await page.reload();
  expect((await control(request)).builds).toHaveLength(1);
  await page.goto("/dashboard/sales/factory");
  await expect(page.getByText("Approved for build",{exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:dashboardPreviewPath(`factory-queue-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important}"});
});

test("keeps paused work and drafts, recovers provider failure, and restricts viewers",async({page,request,browser})=>{
  await signIn(page);
  await openLeadPlan(page,(await control(request)).leadId);
  await page.getByLabel("Your direction",{exact:true}).fill("No company name yet. Keep the plan general.");
  await page.getByRole("button",{name:"Send to planning agent",exact:true}).click();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("");
  expect((await step(request)).checked).toBe(0);
  expect((await control(request)).calls).toBe(0);
  await control(request,"enabled");
  await control(request,"fail");
  expect((await step(request)).failed).toBe(1);
  await page.reload();
  await expect(page.getByText("Research needs attention",{exact:true})).toBeVisible();
  await control(request,"recover");
  await page.getByRole("button",{name:"Retry research",exact:true}).click();
  await expect(page.getByText("Research request saved",{exact:true})).toBeVisible();
  const state=await generate(request);
  expect(state.plans).toHaveLength(1);
  expect(state.builds).toHaveLength(0);
  const target=page.url();
  const viewerContext=await browser.newContext();
  const viewer=await viewerContext.newPage();
  await signIn(viewer,"viewer");
  await viewer.goto(target);
  await expect(viewer.getByText("Read-only access",{exact:true})).toBeVisible();
  await expect(viewer.getByLabel("Your direction",{exact:true})).toBeDisabled();
  await expect(viewer.getByRole("button",{name:"Approve v1 & queue build",exact:true})).toBeDisabled();
  await viewer.goto("/dashboard/sales/factory");
  await expect(viewer.getByRole("button",{name:"Save research settings",exact:true})).toHaveCount(0);
  await viewerContext.close();
});
