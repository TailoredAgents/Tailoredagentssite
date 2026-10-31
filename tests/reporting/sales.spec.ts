import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Pool, type QueryResultRow } from "pg";

// These checks only inspect the isolated browser-test database. Every mutation is
// performed through the same reviewed forms the team uses.
const databaseUrl = process.env.REPORTING_TEST_DATABASE_URL || "postgresql://ta_test@127.0.0.1:55432/ta_reporting_browser_test";
const parsedDatabase = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsedDatabase.hostname) || parsedDatabase.pathname !== "/ta_reporting_browser_test") throw new Error("Sales browser tests require the isolated local test database.");
async function rows<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try { return (await pool.query<T>(sql, values)).rows; } finally { await pool.end(); }
}
async function signIn(page: Page, viewer = false) {
  page.setDefaultTimeout(15000);
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(viewer ? "viewer@example.test" : "owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const run = Date.now().toString(36);
function fixture(project: string) {
  const phone = project === "phone";
  const first = `Cedar Website QA ${project} ${run}`;
  const second = `Maple Website QA ${project} ${run}`;
  const firstPhone = phone ? "+17705550138" : "+17705550137";
  const secondPhone = phone ? "+17705550140" : "+17705550139";
  const csv = [
    "Business Name,Contact Name,Phone,Email,Industry,State,Website Status,Score,Research URL,Notes",
    `${first},Casey Cedar,${firstPhone},cedar-${project}-${run}@example.test,Home services,GA,No website,88,https://example.test/research/cedar,Synthetic research evidence for browser verification`,
    `${second},Morgan Maple,${secondPhone},maple-${project}-${run}@example.test,Landscaping,GA,Needs redesign,76,https://example.test/research/maple,Synthetic second prospect for dialer result verification`,
  ].join("\n");
  return { first, second, firstPhone, secondPhone, csv, list: `QA calling list ${project} ${run}` };
}

async function upload(page: Page, csv: string, mode: "prospects" | "dialer" = "prospects", filename = "reviewed-sales-qa.csv") {
  await page.goto("/dashboard/sales/imports");
  await page.getByLabel("What are you importing?").selectOption(mode);
  await page.getByLabel("Choose CSV to review").setInputFiles({ name: filename, mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await expect(page.getByRole("heading", { name: "Review the detected columns", exact: true })).toBeVisible();
  await expect(page.locator(".sales-import-error")).toHaveCount(0);
}

async function recordId(name: string) {
  const found = await rows<{ id: string }>("SELECT o.id FROM crm_opportunities o JOIN crm_businesses b ON b.id=o.business_id WHERE b.name=$1", [name]);
  expect(found).toHaveLength(1);
  return found[0].id;
}

test.describe.configure({ mode: "serial" });
test.use({ timezoneId: "America/Los_Angeles" }); // CRM scheduling must still use Eastern.

test("reviewed prospect import, scheduled sales and mockup handoff convert into a connected client project", async ({ page }, info) => {
  test.setTimeout(180000);
  const f = fixture(info.project.name);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signIn(page);
  await upload(page, f.csv);
  await expect(page.locator(".sales-mapping-chips")).toContainText("Research score");
  await expect(page.locator(".sales-review-scroll")).toContainText(f.first);
  const importer = page.getByRole("form", { name: "Import 2 reviewed prospects", exact: true });
  await importer.getByLabel("Calling list name *", { exact: true }).fill(f.list);
  await importer.getByRole("button", { name: "Import 2 reviewed prospects", exact: true }).click();
  await expect(importer.getByRole("checkbox")).not.toBeChecked();
  expect(await importer.getByRole("checkbox").evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  expect(await rows("SELECT id FROM crm_businesses WHERE name=ANY($1::text[])", [[f.first, f.second]])).toHaveLength(0);
  await importer.getByRole("checkbox").check();
  await importer.getByRole("button", { name: "Import 2 reviewed prospects", exact: true }).click();
  await expect(importer.getByRole("status")).toContainText("2 new businesses");
  const preserved = await rows("SELECT industry,state,website_status,score,research_url FROM crm_businesses WHERE name=$1", [f.first]);
  expect(preserved[0]).toMatchObject({ industry: "Home services", state: "GA", website_status: "none", research_url: "https://example.test/research/cedar" });
  expect(Number(preserved[0].score)).toBe(88);

  await page.goto("/dashboard/sales?view=table");
  await page.getByRole("searchbox", { name: "Search sales opportunities" }).fill(f.first);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("link", { name: f.first, exact: true }).click();
  await expect(page.getByRole("heading", { name: f.first, exact: true })).toBeVisible();
  const id = await recordId(f.first);
  const opportunity = page.getByRole("form", { name: "Save opportunity", exact: true });
  await opportunity.getByRole("combobox", { name: "Stage", exact: true }).selectOption("interested");
  await opportunity.getByRole("combobox", { name: "Offer type", exact: true }).selectOption("promotion");
  await opportunity.getByLabel("Value (USD)", { exact: true }).fill("800");
  await opportunity.getByRole("button", { name: "Save opportunity", exact: true }).click();
  await expect(opportunity.getByRole("status")).toHaveText("Opportunity saved.");
  await expect(opportunity.getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("interested");
  await expect(opportunity.getByRole("combobox", { name: "Offer type", exact: true })).toHaveValue("promotion");
  await expect(opportunity.getByLabel("Value (USD)", { exact: true })).toHaveValue("800");
  await page.reload();
  await expect(opportunity.getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("interested");
  await expect(opportunity.getByRole("combobox", { name: "Offer type", exact: true })).toHaveValue("promotion");
  await expect(opportunity.getByLabel("Value (USD)", { exact: true })).toHaveValue("800");
  await expect(page.getByText(/Calls and messages in this phase are logged from BatchDialer/)).toBeVisible();
  expect(await page.getByRole("button", { name: /^(Send email|Send text|Start call|Call now)$/i }).count()).toBe(0);

  const log = page.getByRole("form", { name: "Log activity", exact: true });
  await log.getByRole("combobox", { name: "Activity type", exact: true }).selectOption("call");
  await log.getByLabel("Outcome", { exact: true }).fill("Interested after BatchDialer call");
  await log.getByLabel("What happened? *", { exact: true }).fill(`Manual call history ${info.project.name}: prospect asked for a personalized website preview.`);
  await log.getByRole("button", { name: "Log activity", exact: true }).click();
  await expect(log.getByRole("status")).toHaveText("Activity recorded. No message or call was sent.");
  await expect(page.locator(".sales-activity-list")).toContainText(`Manual call history ${info.project.name}`);

  const appointment = page.getByRole("form", { name: "Schedule next step", exact: true });
  await appointment.getByLabel("Title *", { exact: true }).fill(`Preview appointment ${info.project.name}`);
  await appointment.getByRole("combobox", { name: "Type", exact: true }).selectOption("appointment");
  const dateInput = appointment.locator('input[name="dueAtLocal"]');
  await dateInput.fill("2030-03-10T02:30");
  expect(await dateInput.evaluate(input => (input as HTMLInputElement).validity.customError)).toBe(true);
  await expect(appointment.locator('input[name="dueAt"]')).toHaveValue("");
  await dateInput.fill("2030-11-03T01:30");
  await appointment.getByLabel("Daylight saving time occurrence").selectOption("2030-11-03T06:30:00.000Z");
  await expect(appointment.locator('input[name="dueAt"]')).toHaveValue("2030-11-03T06:30:00.000Z");
  const localDate = "2030-04-08T14:30";
  await dateInput.fill(localDate);
  const expectedIso = "2030-04-08T18:30:00.000Z"; // 2:30 PM Eastern, regardless of browser zone.
  await expect(appointment.locator('input[name="dueAt"]')).toHaveValue(expectedIso);
  await expect(appointment).toContainText("Time zone: US Eastern (America/New_York)");
  await appointment.getByLabel("Location / meeting link", { exact: true }).fill("https://example.test/meet/website-preview");
  await appointment.getByRole("button", { name: "Schedule next step", exact: true }).click();
  await expect(appointment.getByRole("status")).toHaveText("Scheduled work saved.");
  const persistedTask = (await rows<{ due_at: Date; kind: string }>("SELECT due_at,kind FROM crm_tasks WHERE opportunity_id=$1", [id]))[0];
  expect(persistedTask.kind).toBe("appointment");
  expect(persistedTask.due_at.toISOString()).toBe(expectedIso);
  await expect(page.locator(`.sales-task-full time[datetime="${expectedIso}"]`)).toBeVisible();
  await expect(page.locator(".sales-task-full")).toContainText("2:30");

  await page.getByText("Manual mockup tracking", {exact:true}).click();
  const request = page.getByRole("form", { name: "Request manual mockup", exact: true });
  await request.getByLabel("Brief *", { exact: true }).fill("Build a refined home services homepage with a clear appointment request and local service areas.");
  await request.getByRole("button", { name: "Request manual mockup", exact: true }).click();
  const mockup = page.getByRole("form", { name: "Update mockup", exact: true });
  await expect(mockup).toBeVisible();
  await expect(page.getByRole("form", { name: "Request manual mockup", exact: true })).toHaveCount(0);
  await page.reload();
  expect(await rows("SELECT id FROM crm_mockups WHERE opportunity_id=$1", [id])).toHaveLength(1);
  await page.getByText("Manual mockup tracking", {exact:true}).click();
  await mockup.getByRole("combobox", { name: "Status", exact: true }).selectOption("ready");
  const previewUrl = `https://example.test/previews/${info.project.name}-${run}`;
  await mockup.getByLabel("Preview URL", { exact: true }).fill(previewUrl);
  await mockup.getByLabel("Factory project path / reference", { exact: true }).fill(`Website Factory / ${f.first}`);
  await mockup.getByLabel("QA / review notes", { exact: true }).fill("Responsive layout and discovery CTA checked. Ready for owner review.");
  await mockup.getByRole("button", { name: "Update mockup", exact: true }).click();
  await expect(mockup.getByRole("status")).toHaveText("Mockup progress saved.");
  await expect(page.getByRole("link", { name: "Open website preview", exact: true })).toHaveAttribute("href", previewUrl);
  await expect(mockup.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("ready");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `test-results/sales-record-active-${info.project.name}.png`, fullPage: true });

  const sale = page.getByRole("form", { name: "Mark won & create project", exact: true });
  const projectName = `${f.first} — Website delivery`;
  await sale.getByLabel("Project name *", { exact: true }).fill(projectName);
  await sale.getByLabel("Project summary", { exact: true }).fill("Agreed acquisition website engagement. Synthetic browser QA sale.");
  await sale.getByRole("button", { name: "Mark won & create project", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name: projectName, exact: true })).toBeVisible();
  const converted = (await rows("SELECT o.stage,o.value_cents,o.offer_type,o.client_id,o.project_id,b.client_id AS business_client_id FROM crm_opportunities o JOIN crm_businesses b ON b.id=o.business_id WHERE o.id=$1", [id]))[0];
  expect(converted).toMatchObject({ stage: "won", value_cents: "80000", offer_type: "promotion" });
  expect(converted.client_id).toBeTruthy();
  expect(converted.client_id).toBe(converted.business_client_id);
  expect(await rows("SELECT id FROM contacts WHERE client_id=$1", [converted.client_id])).toHaveLength(1);
  await page.goto(`/dashboard/sales/${id}`);
  await expect(page.getByRole("heading", { name: "Client records connected", exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Mark won & create project", exact: true })).toHaveCount(0);
  expect(await rows("SELECT id FROM projects WHERE client_id=$1", [converted.client_id])).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("BatchDialer results reuse prospects, preserve opt-outs and deduplicate repeat imports", async ({ page }, info) => {
  test.setTimeout(120000);
  const f = fixture(info.project.name);
  await signIn(page);
  const id = await recordId(f.second);
  const dialer = [
    "Phone Number 1,Disposition,Call ID,Call Date,Comments",
    `${f.secondPhone},Interested,interested-${info.project.name}-${run},2026-10-21T14:30:00-04:00,Asked for a website preview`,
    `${f.secondPhone},Do Not Call,dnc-${info.project.name}-${run},2026-10-21T15:30:00-04:00,Requested no further calls`,
    "+17705550999,No Answer,unmatched-qa,2026-10-21T16:00:00-04:00,Unmatched result must never create a business",
  ].join("\n");
  await upload(page, dialer, "dialer", "batchdialer-qa.csv");
  let importer = page.getByRole("form", { name: "Import 3 reviewed results", exact: true });
  await importer.getByLabel("Results batch name *", { exact: true }).fill(`BatchDialer QA ${info.project.name} ${run}`);
  await importer.getByRole("checkbox").check();
  await importer.getByRole("button", { name: "Import 3 reviewed results", exact: true }).click();
  await expect(importer.getByRole("status")).toContainText("2 call results recorded, 0 matched or already imported, 1 skipped");
  await page.goto(`/dashboard/sales/${id}`);
  await expect(page.locator(".sales-activity-list")).toContainText("BatchDialer import");
  await expect(page.locator(".sales-preferences")).toContainText("Do not contact");
  await expect(page.getByRole("form", { name: "Save opportunity" }).getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("interested");
  expect(await rows("SELECT id FROM crm_activities WHERE opportunity_id=$1 AND source='batchdialer'", [id])).toHaveLength(2);
  expect((await rows("SELECT status FROM crm_channel_preferences WHERE channel='call' AND normalized_address=$1", [f.secondPhone]))[0]?.status).toBe("blocked");
  expect(await rows("SELECT id FROM crm_businesses WHERE normalized_phone='+17705550999'")).toHaveLength(0);

  await upload(page, dialer, "dialer", "batchdialer-qa-repeat.csv");
  importer = page.getByRole("form", { name: "Import 3 reviewed results", exact: true });
  await importer.getByRole("checkbox").check();
  await importer.getByRole("button", { name: "Import 3 reviewed results", exact: true }).click();
  await expect(importer.getByRole("status")).toContainText("0 call results recorded, 2 matched or already imported, 1 skipped");
  expect(await rows("SELECT id FROM crm_activities WHERE opportunity_id=$1 AND source='batchdialer'", [id])).toHaveLength(2);
  await upload(page, f.csv);
  const prospectImport = page.getByRole("form", { name: "Import 2 reviewed prospects", exact: true });
  await prospectImport.getByRole("checkbox").check();
  await prospectImport.getByRole("button", { name: "Import 2 reviewed prospects", exact: true }).click();
  await expect(prospectImport.getByRole("status")).toContainText("This exact file was already imported; no records changed.");
  expect(await rows("SELECT id FROM crm_businesses WHERE name=ANY($1::text[])", [[f.first, f.second]])).toHaveLength(2);
  expect(await rows("SELECT c.id FROM contacts c JOIN crm_businesses b ON b.id=c.business_id WHERE b.name=ANY($1::text[])", [[f.first, f.second]])).toHaveLength(2);
  const listRow = page.getByRole("row").filter({ has: page.getByRole("link", { name: f.list, exact: true }) });
  await expect(listRow).toContainText("$800");
  await expect(listRow).toContainText("1 won");
});

test("view-only teammates can inspect sales records while mutation and import controls stay disabled", async ({ page }, info) => {
  test.setTimeout(90000);
  const f = fixture(info.project.name);
  const id = await recordId(f.second);
  await signIn(page, true);
  for (const path of ["/dashboard/sales", "/dashboard/sales/today", "/dashboard/sales/mockups", "/dashboard/sales/imports", `/dashboard/sales/${id}`]) {
    await page.goto(path);
    await expect(page.getByText(/You have view-only access/)).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    for (const form of await page.locator(".sales-workspace form[aria-busy]").all()) {
      await expect(form.locator("fieldset.dashboard-operation-fields")).toHaveAttribute("disabled", "");
      for (const control of await form.locator('fieldset.dashboard-operation-fields input:not([type="hidden"]), fieldset.dashboard-operation-fields select, fieldset.dashboard-operation-fields textarea').all()) {
        await expect(control).toBeDisabled();
      }
      await expect(form.locator('button[type="submit"]').last()).toBeDisabled();
    }
    if (path.endsWith("/imports")) await expect(page.getByLabel("Choose CSV to review")).toBeDisabled();
    await expect(page.getByRole("button", { name: /^(Send email|Send text|Start call|Call now)$/i })).toHaveCount(0);
  }
});

test("sales routes stay readable, accessible and inside the viewport on desktop, tablet and small phones", async ({ page }, info) => {
  test.setTimeout(240000);
  const f = fixture(info.project.name);
  const id = await recordId(f.first);
  const routes = [
    ["pipeline", "/dashboard/sales"], ["table", "/dashboard/sales?view=table"], ["record", `/dashboard/sales/${id}`],
    ["today", "/dashboard/sales/today"], ["mockups", "/dashboard/sales/mockups"], ["lists", "/dashboard/sales/imports"],
  ];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signIn(page);
  for (const width of info.project.name === "desktop" ? [1440, 768, 320] : [390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of routes) {
      await test.step(`${name} at ${width}px`, async () => {
        expect((await page.goto(path))?.status()).toBe(200);
        await expect(page.locator("h1")).toBeVisible();
        expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} page overflow at ${width}px`).toBe(true);
        const tinyText = await page.locator(".sales-workspace").evaluate(shell => {
          const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT), bad: string[] = [];
          while (walker.nextNode()) {
            const node = walker.currentNode, parent = node.parentElement;
            if (!node.textContent?.trim() || !parent || parent.closest(".sr-only, script, style, svg")) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            const rect = range.getBoundingClientRect(), style = getComputedStyle(parent);
            if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number.parseFloat(style.fontSize) < 14) bad.push(`${node.textContent.trim().slice(0, 40)}: ${style.fontSize}`);
          }
          return bad;
        });
        expect.soft(tinyText, `${name} readable text at ${width}px`).toEqual([]);
        const smallFields = await page.locator('.sales-workspace input:not([type="hidden"]), .sales-workspace select, .sales-workspace textarea').evaluateAll(fields => fields.filter(field => field.getBoundingClientRect().width > 0 && Number.parseFloat(getComputedStyle(field).fontSize) < 16).map(field => field.getAttribute("name")));
        expect.soft(smallFields, `${name} form sizes at ${width}px`).toEqual([]);
        if (width === 1440 || width === 390) {
          const a11y = await new AxeBuilder({ page }).include(".sales-workspace").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          expect.soft(a11y.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), `${name} accessibility at ${width}px`).toEqual([]);
          if (["pipeline", "record", "lists"].includes(name)) {
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            await page.screenshot({ path: `test-results/sales-${name}-${info.project.name}.png`, fullPage: true });
          }
        }
      });
    }
  }
  expect(errors).toEqual([]);
});
