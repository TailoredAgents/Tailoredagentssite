import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
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
  await page.getByRole("button",{name:"Create website mockup",exact:true}).click();
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

test("finds the builder from navigation, chooses a sparse lead and reopens the same project",async({page,request},info)=>{
  await signIn(page);
  await page.goto("/dashboard/sales/factory");
  await expect(page.locator('a[href="/dashboard/sales/factory"]').filter({hasText:"Website Builder"}).first()).toBeAttached();
  await page.getByRole("link",{name:"Create website mockup",exact:true}).first().click();
  await expect(page).toHaveURL(/\/factory\/new$/);
  await page.getByLabel("Find a lead",{exact:true}).fill("no-matching-lead");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.getByRole("heading",{name:"No leads found",exact:true})).toBeVisible();
  await page.getByLabel("Find a lead",{exact:true}).fill("");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  const start=page.getByRole("button",{name:"Create website mockup",exact:true});
  await expect(start).toHaveCount(1);
  expect((await control(request)).calls).toBe(0);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:dashboardPreviewPath(`factory-choose-lead-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important}"});
  await start.click();
  await expect(page).toHaveURL(/\/factory\/[0-9a-f-]+$/);
  const existing=page.url();
  await page.goto("/dashboard/sales/factory/new");
  await page.getByRole("link",{name:"Open website project",exact:true}).click();
  await expect(page).toHaveURL(existing);
  expect((await control(request)).jobs).toHaveLength(1);
  expect((await control(request)).builds).toHaveLength(0);
  expect((await control(request)).calls).toBe(0);
});

test("researches a sparse lead, refines through chat, and approves only the reviewed plan",async({page,request},info)=>{
  await signIn(page);
  await page.goto("/dashboard/sales/factory/settings");
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
  await expect(page.locator(".factory-plan-summary").getByText("Company name and service area are not confirmed.",{exact:true})).toBeVisible();
  await page.getByLabel("Your direction",{exact:true}).fill("They mostly do commercial roofing. Emphasize estimate requests.");
  await expect(page.getByRole("button",{name:"Approve plan & build website",exact:true})).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("They mostly do commercial roofing. Emphasize estimate requests.");
  await page.getByRole("button",{name:"Update the plan",exact:true}).click();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("");
  await expect(page.getByRole("button",{name:"Approve plan & build website",exact:true})).toBeDisabled();
  state=await generate(request);
  expect(state.plans).toHaveLength(2);
  expect(state.builds).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("button",{name:"Approve plan & build website",exact:true})).toBeEnabled();
  await expect(page.getByText("Changed the audience and service direction to commercial roofing.",{exact:true}).first()).toBeVisible();
  const versions=page.getByLabel("Plan version",{exact:true});
  await versions.selectOption(state.plans[0].id);
  await expect(page.getByRole("button",{name:"Approve plan & build website",exact:true})).toBeDisabled();
  await versions.selectOption(state.plans[1].id);
  await page.getByLabel("Your direction",{exact:true}).fill("No change please. Thanks for the explanation.");
  await page.getByRole("button",{name:"Update the plan",exact:true}).click();
  await expect(page.getByLabel("Your direction",{exact:true})).toHaveValue("");
  state=await generate(request);
  expect(state.plans).toHaveLength(2);
  await page.reload();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:dashboardPreviewPath(`factory-plan-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important}"});
  await page.getByRole("button",{name:"Approve plan & build website",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Approved and in the build queue",exact:true})).toBeVisible();
  state=await control(request);
  expect(state.builds).toEqual([{plan_id:state.plans[1].id,status:"awaiting_builder"}]);
  await page.reload();
  expect((await control(request)).builds).toHaveLength(1);
  await page.goto("/dashboard/sales/factory");
  await expect(page.getByRole("link",{name:"View progress",exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:dashboardPreviewPath(`factory-queue-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important}"});
});

test("keeps paused work and drafts, recovers provider failure, and restricts viewers",async({page,request,browser})=>{
  await signIn(page);
  await openLeadPlan(page,(await control(request)).leadId);
  await page.getByLabel("Your direction",{exact:true}).fill("No company name yet. Keep the plan general.");
  await page.getByRole("button",{name:"Update the plan",exact:true}).click();
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
  await expect(viewer.getByRole("button",{name:"Approve plan & build website",exact:true})).toBeDisabled();
  await viewer.goto("/dashboard/sales/factory");
  await expect(viewer.getByRole("button",{name:"Save research settings",exact:true})).toHaveCount(0);
  await viewerContext.close();
});


const buildDb = new Pool({ connectionString: "postgresql://ta_test@127.0.0.1:55433/ta_factory_browser_test", max: 1 });
test.afterAll(async () => { await buildDb.end(); });
async function approvedBuild(page: Page, request: APIRequestContext) {
  await signIn(page);
  await control(request, "enabled");
  await openLeadPlan(page, (await control(request)).leadId);
  await generate(request);
  await page.reload();
  await page.getByRole("button", { name: "Approve plan & build website", exact: true }).click();
  await expect(page.getByRole("heading",{name:"Approved and in the build queue",exact:true})).toBeVisible();
  const row = (await buildDb.query("SELECT * FROM factory_build_versions ORDER BY created_at DESC LIMIT 1")).rows[0];
  expect(row).toBeTruthy();
  return row;
}

test("updates build activity automatically without losing the salesperson's draft", async ({ page, request }, info) => {
  const version = await approvedBuild(page, request);
  const panel = page.getByRole("region", { name: "Website build", exact: true });
  await page.locator(".factory-planning-area > summary").filter({hasText:"Plan & project history"}).click();
  await page.getByLabel("Your direction", { exact: true }).fill("Keep this unsent direction while the site builds.");
  const progress = async (status: string, stage: string, step: string) => {
    await buildDb.query("UPDATE factory_build_versions SET status=$2,stage=$3,working_data=$4,updated_at=now() WHERE id=$1", [version.id,status,stage,{activity:{stage,step,startedAt:new Date().toISOString()}}]);
  };
  await progress("running", "generate", "generating");
  await expect(panel.getByText("Designing and writing the website pages", { exact: true })).toBeVisible({timeout:20000});
  await progress("running", "qa", "design_review");
  await expect(panel.getByText("Reviewing the design and content", { exact: true })).toBeVisible({timeout:20000});
  await expect(panel.locator('[aria-current="step"]')).toContainText("Quality checks");
  await expect(panel.locator(".is-complete")).toHaveCount(2);
  await progress("running", "qa", "repairing");
  await expect(panel.getByText("Applying corrections from the quality review", { exact: true })).toBeVisible({timeout:20000});
  await expect(page.getByLabel("Your direction", { exact: true })).toHaveValue("Keep this unsent direction while the site builds.");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect((await new AxeBuilder({page}).include('[aria-label="Website build"]').withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await panel.screenshot({path:dashboardPreviewPath(`factory-live-progress-${info.project.name}.png`)});
  await progress("queued", "publish", "saving");
  await expect(panel.getByRole("heading", {name:"Next: Publishing",exact:true})).toBeVisible({timeout:20000});
  await expect(panel.locator('[aria-current="step"]')).toContainText("Waiting");
  await progress("failed", "publish", "publishing");
  await expect(panel.getByRole("heading", {name:"This build needs attention",exact:true})).toBeVisible({timeout:20000});
  await expect(panel.locator('[aria-current="step"]')).toContainText("Stopped here");
  await expect(panel.getByText("Updates automatically", {exact:true})).toHaveCount(0);
});

test("shows build limits, paused and failed stages, and preserves upload errors", async ({ page, request }) => {
  const version = await approvedBuild(page, request);
  await expect(page.getByRole("heading", { name: "Approved and in the build queue", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open website", exact: true })).toHaveCount(0);
  await buildDb.query("UPDATE factory_build_versions SET status='failed',stage='images',error='Synthetic image provider interruption' WHERE id=$1", [version.id]);
  await page.reload();
  await page.getByText("Error details",{exact:true}).click();
  await expect(page.getByText("Synthetic image provider interruption", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry website build", exact: true })).toBeDisabled();
  await page.locator(".factory-planning-area > summary").filter({hasText:"Plan & project history"}).click();
  await page.getByText("Optional website image",{exact:true}).click();
  const file = page.getByLabel("Choose a hero image", { exact: true });
  await file.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(page.getByText("Choose a PNG, JPEG, or WebP image under 5 MB.", { exact: true })).toBeVisible();
  await page.route("**/api/dashboard/factory/projects/*/uploads", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic storage unavailable" }) }));
  await file.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("fixture-image") });
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(page.getByText("Synthetic storage unavailable", { exact: true })).toBeVisible();
  expect(await file.evaluate((element: HTMLInputElement) => element.files?.[0]?.name)).toBe("logo.png");
  await page.goto("/dashboard/sales/factory/settings#build-settings");
  await expect(page.getByLabel("Enable website building", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Monthly build limit (USD)", { exact: true })).toHaveValue("50");
  await expect(page.getByLabel("Per-website limit (USD)", { exact: true })).toHaveValue("5");
  await page.getByRole("button", { name: "Save builder settings", exact: true }).click();
  await expect(page.getByText("Website building settings saved.", { exact: true })).toBeVisible();
  expect((await buildDb.query("SELECT enabled FROM factory_build_settings")).rows[0].enabled).toBe(false);
});

test("reviews a completed preview, revokes and renews sharing, exports and uploads assets", async ({ page, request }, info) => {
  const version = await approvedBuild(page, request);
  const qa = { passed: true, checks: ["Desktop and phone pages checked", "Navigation and image checks passed"], warnings: ["Connect the real inquiry form before launch"], screenshots: { desktop: `${version.storage_prefix}desktop.png`, mobile: `${version.storage_prefix}mobile.png` } };
  await buildDb.query("UPDATE factory_build_versions SET status='ready',stage='verify',source_key=$2,qa_report=$3,ready_at=now() WHERE id=$1", [version.id, `${version.storage_prefix}source.zip`, qa]);
  await page.route("**/api/dashboard/factory/builds/*/screenshot?*", route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#eef2f6"/><rect width="800" height="70" fill="#10243b"/><rect x="40" y="120" width="430" height="35" fill="#315bb0"/><rect x="40" y="180" width="300" height="15" fill="#96a6bb"/><rect x="40" y="240" width="160" height="50" rx="8" fill="#315bb0"/><rect x="520" y="110" width="240" height="260" rx="12" fill="#c5d3e6"/></svg>' }));
  await page.route("**/api/dashboard/factory/builds/*/source", route => route.fulfill({ status: 200, contentType: "application/zip", headers: { "content-disposition": 'attachment; filename="website-v1.zip"' }, body: Buffer.from("Synthetic download transport; export contents are tested separately.") }));
  const preview = page.getByRole("link", { name: "Open website", exact: true });
  await expect(preview).toHaveAttribute("href", `https://www.tailoredagents.com/preview/${version.preview_slug}`, { timeout: 20000 });
  await expect(page.getByText("Website v1 · approved plan v1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button",{name:"Copy preview link",exact:true})).toBeVisible();
  await expect(page.locator(".factory-planning-area")).not.toHaveAttribute("open","");
  await expect(page.getByLabel("Your direction",{exact:true})).toBeHidden();
  await page.screenshot({path:dashboardPreviewPath(`factory-ready-${info.project.name}.png`),fullPage:true,style:"nextjs-portal{display:none!important}"});
  await page.getByText("Quality checks & handoff notes", { exact: true }).click();
  await expect(page.getByText("Connect the real inquiry form before launch", { exact: true })).toBeVisible();
  await page.getByText("Download source & sharing options",{exact:true}).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download source ZIP", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("website-v1.zip");
  await page.getByRole("button", { name: "Turn off preview sharing", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByText("Preview sharing is turned off.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Renew preview sharing", exact: true }).click();
  await expect(preview).toBeVisible();
  await page.route("**/api/dashboard/factory/projects/*/uploads", async route => {
    await buildDb.query("INSERT INTO factory_uploads(id,workspace_id,project_id,storage_key,filename,content_type,byte_size,sha256,status,created_by) VALUES($1,$2,$3,$4,'client-logo.png','image/png',1000,$5,'ready','factory-owner')", [randomUUID(), version.workspace_id, version.project_id, `fixture/${randomUUID()}.png`, "a".repeat(64)]);
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.locator(".factory-planning-area > summary").filter({hasText:"Plan & project history"}).click();
  await page.getByText("Optional website image",{exact:true}).click();
  await page.getByLabel("Choose a hero image", { exact: true }).setInputFiles({ name: "client-logo.png", mimeType: "image/png", buffer: Buffer.from("Synthetic image transport") });
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(page.getByText("client-logo.png", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: dashboardPreviewPath(`factory-build-${info.project.name}.png`), fullPage: true, style: "nextjs-portal{display:none!important}" });
  await page.locator(".factory-build-panel").screenshot({ path: dashboardPreviewPath(`factory-build-panel-${info.project.name}.png`) });
  await page.getByRole("button", { name: "Remove client-logo.png from future builds", exact: true }).click();
  await expect(page.getByText("client-logo.png", { exact: true })).toHaveCount(0);
  await page.goto("/dashboard/sales/factory");
  await page.getByRole("button", { name: "Ready to share", exact: true }).click();
  await expect(page.getByRole("link", {name:"View website",exact:true})).toBeVisible();
  await page.goto(`/dashboard/leads/${(await control(request)).leadId}`);
  await expect(page.getByRole("link", { name: "View website", exact: true })).toBeVisible();
});
