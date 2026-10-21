import { test, expect, type Page } from "@playwright/test";
async function signIn(page: Page, email = "local-owner@tailoredagents.com") {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local browser test password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/inbox/);
}
test("owner shares one explicit address, toggles send access and revokes; other accounts cannot approve", async ({
  page,
  browser,
}) => {
  // Separate synthetic owner avoids consuming the existing Mail suite's
  // account login budget; production rate limits stay unchanged.
  await signIn(page, "local-crm-owner@tailoredagents.com");
  const otherContext = await browser.newContext(),
    other = await otherContext.newPage();
  await signIn(other, "local-teammate@tailoredagents.com");
  const headers = { Origin: "http://localhost:8787" };
  const { users, addresses } = await (
    await page.request.get("/api/admin/users")
  ).json();
  const teammate = users.find(
    (u: { email: string }) => u.email === "local-teammate@tailoredagents.com",
  );
  const address = addresses.find(
    (a: { address: string }) => a.address === "local-crm-owner@tailoredagents.com",
  );
  const body = {
    mailboxId: address.id,
    granteeId: teammate.id,
    canRead: true,
    canSend: false,
  };
  expect(
    (
      await other.request.patch("/api/admin/crm-grants", {
        headers,
        data: body,
      })
    ).status(),
  ).toBe(403);
  expect((await other.request.get("/api/admin/crm-grants")).status()).toBe(403);
  await page.request.patch(`/api/admin/users/${teammate.id}`, {
    headers,
    data: { dashboardAccess: true },
  });
  await page.request.patch("/api/admin/crm-grants", {
    headers,
    data: { ...body, canRead: false },
  });
  await page.goto("/admin");
  const card = page
    .locator(".ta-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Website CRM inbox access",
        exact: true,
      }),
    });
  await expect(card.getByText(/Other addresses stay private/)).toBeVisible();
  await card
    .getByRole("combobox", { name: "Mailbox", exact: true })
    .selectOption(address.id);
  await card
    .getByRole("combobox", {
      name: "Teammate with dashboard access",
      exact: true,
    })
    .selectOption(teammate.id);
  await card
    .getByRole("button", { name: "Save mailbox approval", exact: true })
    .click();
  const row = card.locator(".ta-team-row").filter({ hasText: address.address });
  await expect(row.getByText("Read only", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Allow sending", exact: true }).click();
  await expect(row.getByText("Read and send", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await row
    .getByRole("button", { name: "Revoke CRM access", exact: true })
    .click();
  await expect(
    card.getByText("No mailboxes are shared with the website CRM.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/admin/crm-grants")).json()).grants,
  ).toEqual([]);
  await page.request.patch(`/api/admin/users/${teammate.id}`, {
    headers,
    data: { dashboardAccess: false },
  });
  await otherContext.close();
});
