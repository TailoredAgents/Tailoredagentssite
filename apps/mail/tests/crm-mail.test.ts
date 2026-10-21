import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, insertTestUser } from "../src/lib/server/test-db";
import { hashToken } from "../src/lib/server/crypto";
import { handleCrmMail } from "../src/lib/server/crm-mail";
import {
  changeCrmGrant,
  requireCrmMailboxGrant,
} from "../src/lib/server/crm-mail-grants";
import { insertEmail } from "../src/lib/server/mail-store";
import { testStorage } from "./storage";
import {
  ProviderError,
  type EmailProvider,
} from "../src/lib/server/email-provider";
import { recoverOutgoing } from "../src/lib/server/outgoing-recovery";

const secret = "synthetic-crm-bridge-secret-2026-local-only";
const token = "a".repeat(48);
async function fixture() {
  const { db, sqlite } = createTestDb();
  const { bucket, objects } = testStorage();
  for (const user of ["owner", "devon", "austin", "outsider"])
    insertTestUser(sqlite, user);
  sqlite.exec(
    "UPDATE users SET dashboard_access=1; UPDATE users SET is_admin=1 WHERE id='owner';",
  );
  sqlite.exec(
    "INSERT INTO domains(id,name,status,sending_enabled,receiving_enabled) VALUES('domain','example.test','verified',1,1)",
  );
  for (const [id, user, address] of [
    ["sales", "owner", "sales@example.test"],
    ["private", "owner", "private@example.test"],
    ["other", "outsider", "other@example.test"],
  ]) {
    sqlite
      .query(
        "INSERT INTO addresses(id,user_id,domain_id,address,is_default) VALUES(?,?,'domain',?,1)",
      )
      .run(id, user, address);
  }
  await db
    .prepare(
      "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES('session','devon',?,datetime('now','+1 day'))",
    )
    .bind(await hashToken("mail-session-only"))
    .run();
  await db
    .prepare(
      "INSERT INTO dashboard_login_grants(token_hash,session_id) VALUES(?,'session')",
    )
    .bind(await hashToken(token))
    .run();
  const sent: unknown[] = [];
  const provider: EmailProvider = {
    kind: "resend",
    async send(message) {
      sent.push(message);
      return { providerId: "provider-" + sent.length };
    },
    async listDomains() {
      return [];
    },
    async getDomain() {
      throw new Error("unused");
    },
  };
  const env = {
    DB: db,
    ATTACHMENTS: bucket,
    CRM_MAIL_SECRET: secret,
    DASHBOARD_AUTH_SECRET: "a-different-identity-secret-at-least-32-characters",
  };
  const call = (body: Record<string, unknown>, auth = `Bearer ${secret}`) =>
    handleCrmMail(
      new Request("https://mail.example.test/api/crm-mail", {
        method: "POST",
        headers: { authorization: auth, "content-type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      }),
      env,
      () => provider,
    );
  const approve = (canSend = false, granteeId = "devon") =>
    changeCrmGrant(db, "owner", {
      mailboxId: "sales",
      granteeId,
      canRead: true,
      canSend,
    });
  const inbound = async (
    id: string,
    addressId = "sales",
    body = "Sales enquiry",
  ) => {
    const emailId = await insertEmail(db, {
      id,
      userId: "owner",
      direction: "inbound",
      from: "prospect@example.test",
      to: addressId + "@example.test",
      subject: "Website enquiry",
      bodyText: body,
      messageId: `${id}@sender.example.test`,
      domainId: "domain",
      addressId,
      subjectMatch: false,
    });
    return emailId;
  };
  return {
    db,
    sqlite,
    bucket,
    objects,
    sent,
    provider,
    env,
    call,
    approve,
    inbound,
  };
}

test("service secret, body limits and dashboard grant are independently required", async () => {
  const f = await fixture();
  assert.equal((await f.call({ action: "mailboxes" }, "")).status, 401);
  assert.equal(
    (await f.call({ action: "mailboxes", padding: "x".repeat(66000) })).status,
    413,
  );
  assert.equal(
    (await f.call({ action: "mailboxes", token: "b".repeat(48) })).status,
    401,
  );
  f.env.CRM_MAIL_SECRET = f.env.DASHBOARD_AUTH_SECRET;
  assert.equal(
    (await f.call({ action: "mailboxes" }, `Bearer ${f.env.CRM_MAIL_SECRET}`))
      .status,
    503,
  );
});

test("dashboard identity including owner implies no mail access; explicit address grant does", async () => {
  const f = await fixture();
  assert.deepEqual(await (await f.call({ action: "mailboxes" })).json(), {
    mailboxes: [],
  });
  await assert.rejects(
    requireCrmMailboxGrant(f.db, "owner", "sales"),
    /mailbox_not_approved/,
  );
  assert.equal(
    (await f.call({ action: "threads", mailboxId: "sales", view: "inbox" }))
      .status,
    403,
  );
  await f.approve();
  const data = await (await f.call({ action: "mailboxes" })).json();
  assert.deepEqual(data.mailboxes, [
    {
      id: "sales",
      name: "sales@example.test",
      email: "sales@example.test",
      canSend: false,
      addresses: [{ id: "sales", address: "sales@example.test" }],
    },
  ]);
  assert.equal(
    (await f.call({ action: "threads", mailboxId: "private", view: "inbox" }))
      .status,
    403,
  );
  assert.equal(
    (await f.call({ action: "threads", mailboxId: "other", view: "inbox" }))
      .status,
    403,
  );
});

test("only owner may approve eligible actors, and revocation/disabled account/owner take effect immediately", async () => {
  const f = await fixture();
  await assert.rejects(
    changeCrmGrant(f.db, "devon", {
      mailboxId: "sales",
      granteeId: "devon",
      canRead: true,
      canSend: true,
    }),
    /owner_required/,
  );
  await assert.rejects(
    changeCrmGrant(f.db, "owner", {
      mailboxId: "sales",
      granteeId: "devon",
      canRead: false,
      canSend: true,
    }),
    /read_required/,
  );
  await f.approve();
  await changeCrmGrant(f.db, "owner", {
    mailboxId: "sales",
    granteeId: "devon",
    canRead: false,
    canSend: false,
  });
  assert.equal(
    (await f.call({ action: "threads", mailboxId: "sales", view: "inbox" }))
      .status,
    403,
  );
  await f.approve();
  f.sqlite.exec(
    "UPDATE users SET disabled_at=datetime('now') WHERE id='owner'",
  );
  assert.deepEqual(
    (await (await f.call({ action: "mailboxes" })).json()).mailboxes,
    [],
  );
  f.sqlite.exec(
    "UPDATE users SET disabled_at=NULL WHERE id='owner'; UPDATE users SET dashboard_access=0 WHERE id='devon'",
  );
  assert.equal((await f.call({ action: "mailboxes" })).status, 401);
});

test("a mixed-alias conversation never leaks private messages, previews, participants, search matches or files", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("sales-msg");
  await f.inbound("private-msg", "private", "PRIVATE_UNRELATED_CONTENT");
  f.sqlite.exec(
    "UPDATE emails SET thread_id='sales-msg',from_addr='private-correspondent@example.test',created_at='2099-01-01' WHERE id='private-msg'",
  );
  f.sqlite.exec(
    "INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64) VALUES('private-file','private-msg','private.pdf','application/pdf',3,'YWJj')",
  );
  const page = await (
    await f.call({ action: "threads", mailboxId: "sales", view: "inbox" })
  ).json();
  assert.equal(page.total, 1);
  assert.equal(page.threads[0].message_count, 1);
  assert.equal(page.threads[0].latest_id, "sales-msg");
  assert.equal(JSON.stringify(page).includes("private"), false);
  assert.equal(
    (
      await (
        await f.call({
          action: "threads",
          mailboxId: "sales",
          view: "inbox",
          q: "PRIVATE_UNRELATED_CONTENT",
        })
      ).json()
    ).total,
    0,
  );
  const detail = await (
    await f.call({
      action: "thread",
      mailboxId: "sales",
      threadId: "sales-msg",
    })
  ).json();
  assert.deepEqual(
    detail.messages.map((message: { id: string }) => message.id),
    ["sales-msg"],
  );
  assert.equal(JSON.stringify(detail).includes("PRIVATE"), false);
  assert.equal(
    (
      await f.call({
        action: "attachment",
        mailboxId: "sales",
        messageId: "private-msg",
        attachmentId: "private-file",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.call({
        action: "thread",
        mailboxId: "sales",
        threadId: "private-msg",
      })
    ).status,
    404,
  );
});

test("safe thread uses plaintext for HTML-only messages, does not mark read and download stays scoped", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("html");
  f.sqlite
    .exec(`UPDATE emails SET body_text=NULL,body_html='<p>Hello <strong>Devon</strong></p><script>bad()</script>',bcc_addr='secret@example.test' WHERE id='html';
    INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64) VALUES('file','html','quote.html','text/html',3,'YWJj');`);
  const result = await f.call({
    action: "thread",
    mailboxId: "sales",
    threadId: "html",
  });
  const data = await result.json();
  assert.match(data.messages[0].body_text, /Hello Devon/);
  assert.equal("body_html" in data.messages[0], false);
  assert.equal(JSON.stringify(data).includes("secret@example.test"), false);
  assert.equal(
    f.sqlite.query("SELECT is_read FROM emails WHERE id='html'").all()[0]
      .is_read,
    0,
  );
  assert.match(result.headers.get("cache-control")!, /no-store/);
  const file = await f.call({
    action: "attachment",
    mailboxId: "sales",
    messageId: "html",
    attachmentId: "file",
  });
  assert.equal(await file.text(), "abc");
  assert.match(file.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(file.headers.get("content-type"), "application/octet-stream");
  f.sqlite.exec("UPDATE emails SET status='draft' WHERE id='html'");
  assert.equal(
    (
      await f.call({
        action: "attachment",
        mailboxId: "sales",
        messageId: "html",
        attachmentId: "file",
      })
    ).status,
    404,
  );
});

test("manual reassignment is not proof that a message was delivered to the shared address", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("reassigned");
  f.sqlite.exec(
    "UPDATE emails SET provider_id='reassigned-provider' WHERE id='reassigned'; INSERT INTO unassigned_mail(provider_id,content_key,recipient,sender,subject,assigned_user_id) VALUES('reassigned-provider','private-key','unknown@example.test','sender@example.test','Private','owner')",
  );
  assert.equal(
    (
      await (
        await f.call({ action: "threads", mailboxId: "sales", view: "inbox" })
      ).json()
    ).total,
    0,
  );
  assert.equal(
    (
      await f.call({
        action: "thread",
        mailboxId: "sales",
        threadId: "reassigned",
      })
    ).status,
    404,
  );
});

test("a proven additional envelope delivery includes a deduplicated BCC copy, never an unproven header guess", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("bcc-copy", "private");
  await f.inbound("header-only", "private");
  f.sqlite.exec(
    "UPDATE emails SET to_addr='sales@example.test' WHERE id='header-only'; INSERT INTO email_address_deliveries(email_id,address_id) VALUES('bcc-copy','sales')",
  );
  const page = await (
    await f.call({ action: "threads", mailboxId: "sales", view: "inbox" })
  ).json();
  assert.equal(page.total, 1);
  assert.equal(page.threads[0].latest_id, "bcc-copy");
  assert.equal(
    (
      await f.call({
        action: "thread",
        mailboxId: "sales",
        threadId: "header-only",
      })
    ).status,
    404,
  );
});

test("read-only grants cannot send; sending cannot forge another alias, thread or stale reply", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("parent");
  await f.inbound("private-parent", "private");
  const base = {
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    text: "Thanks, let’s talk.",
    idempotencyKey: crypto.randomUUID(),
  };
  assert.equal(
    (await f.call({ ...base, to: "prospect@example.test", subject: "Website" }))
      .status,
    403,
  );
  await f.approve(true);
  assert.equal(
    (
      await f.call({
        ...base,
        fromAddressId: "private",
        to: "prospect@example.test",
        subject: "Website",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call({
        ...base,
        threadId: "private-parent",
        replyToMessageId: "private-parent",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.call({
        ...base,
        threadId: "parent",
        replyToMessageId: "parent",
        to: "forged@example.test",
      })
    ).status,
    400,
  );
  await f.inbound("newer");
  f.sqlite.exec(
    "UPDATE emails SET thread_id='parent',created_at='2099-01-01' WHERE id='newer'",
  );
  assert.equal(
    (await f.call({ ...base, threadId: "parent", replyToMessageId: "parent" }))
      .status,
    409,
  );
  assert.equal(f.sent.length, 0);
});

test("compose and reply reuse the durable provider send and signatures, retry is at most once", async () => {
  const f = await fixture();
  await f.approve(true);
  await f.inbound("parent");
  const body = {
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    threadId: "parent",
    replyToMessageId: "parent",
    text: "Thank you for asking.",
    idempotencyKey: crypto.randomUUID(),
  };
  const first = await f.call(body);
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.status, "accepted");
  assert.equal(data.threadId, "parent");
  assert.deepEqual(await (await f.call(body)).json(), data);
  assert.equal(f.sent.length, 1);
  const sent = f.sent[0] as {
    from: { address: string };
    to: string[];
    subject: string;
    inReplyTo: string;
  };
  assert.equal(sent.from.address, "sales@example.test");
  assert.deepEqual(sent.to, ["prospect@example.test"]);
  assert.equal(sent.subject, "Re: Website enquiry");
  assert.match(sent.inReplyTo, /parent@sender/);
  assert.equal(
    (await f.call({ ...body, text: "Changed content" })).status,
    409,
  );
  assert.equal(f.sent.length, 1);
  const compose = await f.call({
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    text: "A new proposal",
    to: "new@example.test",
    subject: "New project",
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(compose.status, 200);
  assert.equal(f.sent.length, 2);
  assert.equal(
    f.sqlite
      .query("SELECT count(*) AS n FROM crm_mail_audit WHERE action='send'")
      .all()[0].n,
    2,
  );
  assert.equal(
    f.sqlite
      .query("SELECT count(*) AS n FROM crm_mail_send_authorizations")
      .all()[0].n,
    2,
  );
});

test("revocation during durable preparation prevents provider delivery", async () => {
  const f = await fixture();
  await f.approve(true);
  const original = f.bucket.put.bind(f.bucket);
  f.bucket.put = (async (key: string, value: unknown) => {
    const result = await original(key, value as string);
    if (key.startsWith("outgoing/")) {
      assert.equal(
        f.sqlite
          .query("SELECT count(*) AS n FROM crm_mail_send_authorizations")
          .all()[0].n,
        1,
      );
      await changeCrmGrant(f.db, "owner", {
        mailboxId: "sales",
        granteeId: "devon",
        canRead: false,
        canSend: false,
      });
    }
    return result;
  }) as typeof f.bucket.put;
  const result = await f.call({
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    text: "A proposal",
    to: "new@example.test",
    subject: "New project",
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(result.status, 403);
  assert.equal(f.sent.length, 0);
  assert.equal(
    f.sqlite.query("SELECT status FROM send_attempts").all()[0].status,
    "failed",
  );
});

test("an uncertain provider result returns pending and retries do not send a second copy", async () => {
  const f = await fixture();
  await f.approve(true);
  f.provider.send = async () => {
    f.sent.push("attempt");
    throw new Error("connection lost");
  };
  const body = {
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    text: "Proposal",
    to: "new@example.test",
    subject: "New project",
    idempotencyKey: crypto.randomUUID(),
  };
  const first = await f.call(body);
  assert.equal(first.status, 202);
  assert.equal((await first.json()).status, "pending");
  f.provider.send = async () => {
    throw new ProviderError(400, "validation_error", "Rejected");
  };
  assert.equal((await f.call(body)).status, 202);
  assert.equal(f.sent.length, 1);
  assert.equal(
    (await f.call({ ...body, text: "Changed proposal" })).status,
    409,
  );
  assert.equal(f.sent.length, 1);
});

test("a definite provider rejection remains rejected rather than becoming an uncertain send", async () => {
  const f = await fixture();
  await f.approve(true);
  f.provider.send = async () => {
    f.sent.push("rejected");
    throw new ProviderError(400, "validation_error", "Recipient refused");
  };
  const body = {
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    text: "Proposal",
    to: "new@example.test",
    subject: "New project",
    idempotencyKey: crypto.randomUUID(),
  };
  const result = await f.call(body);
  assert.equal(result.status, 422);
  assert.deepEqual(await result.json(), { error: "send_rejected" });
  assert.equal(
    f.sqlite.query("SELECT status FROM send_attempts").all()[0].status,
    "failed",
  );
  f.provider.send = async () => {
    f.sent.push("accepted");
    return { providerId: "accepted-provider" };
  };
  assert.equal((await f.call(body)).status, 200);
  assert.deepEqual(f.sent, ["rejected", "accepted"]);
});

test("background recovery never replays a CRM send after its mailbox approval is revoked", async () => {
  const f = await fixture();
  await f.approve(true);
  f.provider.send = async () => {
    throw new Error("connection lost");
  };
  await f.call({
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    text: "Proposal",
    to: "new@example.test",
    subject: "New project",
    idempotencyKey: crypto.randomUUID(),
  });
  f.sqlite.exec(
    "UPDATE send_attempts SET updated_at=datetime('now','-10 minutes')",
  );
  await changeCrmGrant(f.db, "owner", {
    mailboxId: "sales",
    granteeId: "devon",
    canRead: false,
    canSend: false,
  });
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error("No provider call is permitted");
  };
  try {
    await recoverOutgoing({
      ...f.env,
      MAIL_DOMAIN: "example.test",
      RESEND_API_KEY: "synthetic-not-a-provider-key",
    });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(requests, 0);
  assert.equal(
    f.sqlite.query("SELECT status FROM send_attempts").all()[0].status,
    "sending",
  );
});
