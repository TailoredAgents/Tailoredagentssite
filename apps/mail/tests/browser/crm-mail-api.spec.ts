import { test, expect } from "@playwright/test";
const identitySecret = "local-browser-identity-bridge-secret-2026";
const crmSecret = "local-browser-crm-bridge-secret-2026-distinct";
test("Workers discovery/history enforce grants and execute native signed pagination without content metadata", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email address")
    .fill("local-crm-owner@tailoredagents.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local browser test password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/inbox/);
  const { users, addresses } = await (
    await page.request.get("/api/admin/users")
  ).json();
  const actor = users.find(
    (user: { email: string }) =>
      user.email === "local-crm-owner@tailoredagents.com",
  );
  const address = addresses.find(
    (item: { address: string }) =>
      item.address === "local-owner@tailoredagents.com",
  );
  const mailboxId = address.id,
    grant = { mailboxId, granteeId: actor.id, canRead: true, canSend: false },
    headers = { Origin: "http://localhost:8787" };
  expect(
    (
      await page.request.patch("/api/admin/crm-grants", {
        headers,
        data: grant,
      })
    ).status(),
  ).toBe(200);
  const signedIn = await request.post("/api/dashboard-auth", {
    headers: { authorization: `Bearer ${identitySecret}` },
    data: {
      action: "login",
      email: actor.email,
      password: "Local browser test password",
    },
  });
  expect(signedIn.status()).toBe(200);
  const { token } = await signedIn.json();
  const call = (data: Record<string, unknown>) =>
    request.post("/api/crm-mail", {
      headers: { authorization: `Bearer ${crmSecret}` },
      data: { token, mailboxId, ...data },
    });
  try {
    const first = await call({ action: "conversationIndex", limit: 1 });
    expect(first.status()).toBe(200);
    const data = await first.json();
    expect(data.complete).toBe(false);
    expect(data.items).toHaveLength(1);
    expect(typeof data.cursor).toBe("string");
    expect(Object.keys(data.items[0]).sort()).toEqual(
      [
        "externalAddresses",
        "hasAttachments",
        "lastInboundAt",
        "lastMessageAt",
        "lastOutboundAt",
        "latestMessageId",
        "threadId",
      ].sort(),
    );
    const next = await call({
      action: "conversationIndex",
      limit: 1,
      cursor: data.cursor,
    });
    expect(next.status()).toBe(200);
    expect((await next.json()).items[0].threadId).not.toBe(
      data.items[0].threadId,
    );
    expect(
      (
        await call({ action: "conversationIndex", cursor: data.cursor + "x" })
      ).status(),
    ).toBe(400);
    const history = await call({
      action: "threadHistory",
      threadId: "local-message-1",
      limit: 1,
    });
    expect(history.status()).toBe(200);
    const detail = await history.json();
    expect(detail.messages).toHaveLength(1);
    expect(detail.hasOlder).toBe(false);
    expect(detail.before).toBeNull();
    expect(JSON.stringify(detail)).not.toMatch(
      /body_html|content_key|storage_key|bcc_addr/,
    );
    expect(
      (
        await call({
          action: "conversationIndex",
          mailboxId: "local-teammate-address",
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.patch("/api/admin/crm-grants", {
          headers,
          data: { ...grant, canRead: false },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await call({ action: "threadHistory", threadId: "local-message-1" })
      ).status(),
    ).toBe(403);
  } finally {
    await page.request.patch("/api/admin/crm-grants", {
      headers,
      data: { ...grant, canRead: false },
    });
    await request.post("/api/dashboard-auth", {
      headers: { authorization: `Bearer ${identitySecret}` },
      data: { action: "revoke", token },
    });
  }
});
