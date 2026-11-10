import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { businessDateKey } from "../../lib/time";
import { shiftDay } from "../../lib/booking/display";

// Device timezone must not change the team calendar's Eastern times.
test.use({ timezoneId: "America/Los_Angeles" });

async function login(
  page: import("@playwright/test").Page,
  email = "owner@example.test",
) {
  await page.goto("/sign-in");
  await page.getByLabel("Team email").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Reporting-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}
test("calendar creates, overlays, edits and removes busy events and full days", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const day = shiftDay(
      businessDateKey(),
      info.project.name === "phone" ? 14 : 7,
    ),
    name = `Synthetic ${info.project.name}`;
  await login(page);
  await page.goto(`/dashboard/calendar?date=${day}&view=day`);
  async function create(person: string, title: string, allDay = false) {
    await page
      .getByRole("button", { name: "New appointment", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Event title").fill(title);
    await dialog
      .getByRole("combobox", { name: "Team member", exact: true })
      .selectOption(person);
    await dialog
      .getByLabel("Event type")
      .selectOption(allDay ? "time_off" : "meeting");
    if (allDay) await dialog.getByLabel("All day", { exact: true }).check();
    else {
      await dialog.getByLabel("Starts", { exact: true }).fill(day + "T10:00");
      await dialog.getByLabel("Ends", { exact: true }).fill(day + "T11:00");
    }
    await dialog.getByText("Location & notes", { exact: false }).click();
    await dialog
      .getByLabel("Location or meeting link")
      .fill("Synthetic meeting room");
    await dialog
      .getByLabel("Notes", { exact: true })
      .fill("Local calendar test. No invitations.");
    await dialog
      .getByRole("button", { name: "Save event", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await create("austin", name + " Austin");
  await create("jeffrey", name + " Jeffrey");
  await create("devon", name + " Devon day off", true);
  const a = page
      .locator(".tc-timed-event")
      .filter({ hasText: name + " Austin" }),
    j = page.locator(".tc-timed-event").filter({ hasText: name + " Jeffrey" });
  await expect(a).toBeVisible();
  await expect(j).toBeVisible();
  if (info.project.name !== "phone") {
    const ab = await a.boundingBox(),
      jb = await j.boundingBox();
    expect(
      ab!.x + ab!.width <= jb!.x + 1 || jb!.x + jb!.width <= ab!.x + 1,
    ).toBe(true);
  }
  await expect(
    page
      .locator(".tc-all-day-event")
      .filter({ hasText: name + " Devon day off" }),
  ).toBeVisible();
  await a.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Location or meeting link")).toHaveValue(
    "Synthetic meeting room",
  );
  await dialog.getByLabel("Event title").fill(name + " Updated");
  await dialog.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.locator(".tc-timed-event").filter({ hasText: name + " Updated" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Austin", exact: true }).click();
  await expect(
    page.locator(".tc-event").filter({ hasText: name + " Jeffrey" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Everyone", exact: true }).click();
  await expect(
    page.locator(".tc-event").filter({ hasText: name + " Jeffrey" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "New appointment", exact: true })
    .click();
  await dialog.getByLabel("Event title").fill("Conflicting block");
  await dialog
    .getByRole("combobox", { name: "Team member", exact: true })
    .selectOption("austin");
  await dialog.getByLabel("Starts", { exact: true }).fill(day + "T10:15");
  await dialog.getByLabel("Ends", { exact: true }).fill(day + "T10:45");
  await dialog.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("already has");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.screenshot({
    path: info.outputPath("team-calendar-day.png"),
    fullPage: true,
  });
  await page.getByLabel("Calendar view").selectOption("week");
  await expect(page.locator(".tc-grid-day")).toHaveCount(7);
  await page.screenshot({
    path: info.outputPath("team-calendar-week.png"),
    fullPage: true,
  });
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 2550, height: 1345 });
    await page.screenshot({
      path: info.outputPath("team-calendar-wide-populated.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByLabel("Calendar view").selectOption("month");
  await expect(page.locator(".tc-grid-cell")).toHaveCount(42);
  await page.screenshot({
    path: info.outputPath("team-calendar-month.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.locator(".tc-event").filter({ hasText: name + " Updated" }),
  ).toHaveCount(0);
  await page.goto(`/dashboard/calendar?date=${day}&view=day`);
  await page
    .locator(".tc-timed-event")
    .filter({ hasText: name + " Updated" })
    .click();
  await page.screenshot({ path: info.outputPath("team-calendar-editor.png") });
  const editorA11y = await new AxeBuilder({ page })
    .include(".tc-dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(editorA11y.violations.map((v) => v.id)).toEqual([]);
  await dialog
    .getByRole("button", { name: "Remove event…", exact: true })
    .click();
  await dialog
    .getByLabel("Remove this event and reopen the time for bookings.")
    .check();
  await dialog
    .getByRole("button", { name: "Remove event", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".tc-event").filter({ hasText: name + " Updated" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show calendar options" }).click();
  await page.getByText("Booking hours & details", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Add an extra consultation opening",
      exact: true,
    })
    .click();
  await dialog.getByLabel("Starts", { exact: true }).fill(day + "T20:00");
  await dialog
    .getByRole("button", { name: "Add opening", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .locator(".tc-timed-event")
    .filter({ hasText: "Extra availability" })
    .click();
  await dialog.getByText(/^Remove extra opening/).click();
  await dialog
    .getByRole("button", { name: "Remove opening", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("viewer can browse but cannot create an event", async ({ page }) => {
  await login(page, "viewer@example.test");
  await page.goto("/dashboard/calendar");
  await expect(
    page.getByRole("button", { name: "New appointment", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Calendar view").selectOption("month");
  await expect(page.locator(".tc-grid-cell")).toHaveCount(42);
});

test("wide calendar opens at business hours and selection prefills the editor", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "phone",
    "Pointer range selection is a desktop interaction.",
  );
  await page.setViewportSize({ width: 2550, height: 1345 });
  await login(page);
  const day = shiftDay(businessDateKey(), 21);
  await page.goto(`/dashboard/calendar?date=${day}&view=week`);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const surface = page.locator(".tc-main");
  expect((await surface.boundingBox())!.width).toBeGreaterThan(2000);
  // Check first load and reload: business hours must be in the actual visible scroll pane.
  for (let i = 0; i < 2; i++) {
    await expect
      .poll(() =>
        page
          .locator(".tc-calendar-surface")
          .evaluate((el) =>
            Array.from(el.querySelectorAll("*")).some(
              (n) => n.scrollHeight > n.clientHeight + 100 && n.scrollTop > 300,
            ),
          ),
      )
      .toBe(true);
    if (!i) await page.reload();
  }
  await page.screenshot({
    path: info.outputPath("team-calendar-wide-empty.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Austin", exact: true }).click();
  await page.getByRole("button", { name: "Block time", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Event title")).toHaveValue("Busy");
  await expect(dialog.getByLabel("Event type")).toHaveValue("busy");
  await expect(dialog.getByLabel("Team member")).toHaveValue("austin");
  await page.screenshot({
    path: info.outputPath("team-calendar-new-block.png"),
  });
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Calendar view").selectOption("day");
  await expect(page.locator(".tc-grid-day")).toHaveCount(1);
  // The FullCalendar row hit area spans the event column (the hour label is separate).
  await expect
    .poll(() =>
      page
        .locator(".tc-calendar-surface")
        .evaluate((el) =>
          Array.from(el.querySelectorAll("*")).some(
            (n) => n.scrollHeight > n.clientHeight + 100 && n.scrollTop > 300,
          ),
        ),
    )
    .toBe(true);
  const hit = await page
    .locator('.tc-grid-slot[data-time="10:00:00"]')
    .boundingBox();
  expect(hit).toBeTruthy();
  await page.mouse.move(hit!.x + hit!.width / 2, hit!.y + 5);
  await page.mouse.down();
  await page.mouse.move(hit!.x + hit!.width / 2, hit!.y + 55, { steps: 8 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Starts", { exact: true })).toHaveValue(
    day + "T10:00",
  );
  await expect(dialog.getByLabel("Ends", { exact: true })).toHaveValue(
    day + "T11:00",
  );
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  // A single click uses the same visible Eastern time, without saving anything.
  await page.mouse.click(hit!.x + hit!.width / 2, hit!.y + 5);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Starts", { exact: true })).toHaveValue(
    day + "T10:00",
  );
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
