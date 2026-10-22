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

test("discovery returns only address-scoped metadata, including archive, never bodies/BCC/private aliases", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("thread-a");
  await f.inbound("thread-b");
  await f.inbound("thread-private", "private", "PRIVATE_BODY");
  f.sqlite
    .exec(`UPDATE emails SET thread_id='thread-a',created_at='2099-01-01' WHERE id='thread-private';
    UPDATE emails SET archived_at=datetime('now'),created_at='2026-10-21 09:00:00' WHERE id='thread-b';
    UPDATE emails SET created_at='2026-10-21 10:00:00',cc_addr='Helper <helper@example.test>, private@example.test',reply_to_addr='reply@example.test',body_text='DO_NOT_INDEX_BODY',subject='DO_NOT_INDEX_SUBJECT' WHERE id='thread-a';
    INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64) VALUES('private-attachment','thread-private','PRIVATE_FILE.pdf','application/pdf',3,'YWJj');`);
  await insertEmail(f.db, {
    id: "reply-a",
    userId: "owner",
    direction: "outbound",
    from: "sales@example.test",
    to: "prospect@example.test",
    bcc: "secret@example.test",
    subject: "DO_NOT_INDEX_SUBJECT",
    bodyText: "DO_NOT_INDEX_BODY",
    addressId: "sales",
    domainId: "domain",
    replyToEmailId: "thread-a",
  });
  f.sqlite.exec(
    "UPDATE emails SET created_at='2026-10-21 11:00:00',status='sent',provider_id='accepted-reply-a' WHERE id='reply-a'",
  );
  f.bucket.get = async () => {
    throw new Error("Discovery must never hydrate email content");
  };
  const data = await (
    await f.call({
      action: "conversationIndex",
      mailboxId: "sales",
      limit: 100,
    })
  ).json();
  assert.equal(data.complete, true);
  assert.equal(data.cursor, null);
  assert.deepEqual(
    data.items.map((row: { threadId: string }) => row.threadId),
    ["thread-a", "thread-b"],
  );
  assert.deepEqual(data.items[0], {
    threadId: "thread-a",
    latestMessageId: "reply-a",
    lastMessageAt: "2026-10-21T11:00:00.000Z",
    lastInboundAt: "2026-10-21T10:00:00.000Z",
    lastOutboundAt: "2026-10-21T11:00:00.000Z",
    externalAddresses: [
      "helper@example.test",
      "prospect@example.test",
      "reply@example.test",
    ],
    hasAttachments: false,
  });
  assert.equal(JSON.stringify(data).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(data).includes("DO_NOT_INDEX"), false);
  assert.equal(JSON.stringify(data).includes("secret@example.test"), false);
  assert.equal(JSON.stringify(data).includes("private@example.test"), false);
});

test("discovery response timestamps exclude unknown and unsuccessful outbound delivery", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("incoming");
  f.sqlite.exec(
    "UPDATE emails SET created_at='2026-10-21 10:00:00' WHERE id='incoming'",
  );
  for (const [hour, status] of [
    [11, "queued"],
    [12, "failed"],
    [13, "bounced"],
    [14, "complained"],
  ] as const) {
    await insertEmail(f.db, {
      id: "out-" + status,
      userId: "owner",
      direction: "outbound",
      from: "sales@example.test",
      to: "prospect@example.test",
      subject: "Reply attempt",
      bodyText: "Attempt content",
      addressId: "sales",
      domainId: "domain",
      replyToEmailId: "incoming",
    });
    f.sqlite
      .query("UPDATE emails SET created_at=?,status=?,provider_id=? WHERE id=?")
      .run(
        `2026-10-21 ${hour}:00:00`,
        status,
        status === "queued" ? null : "provider-" + status,
        "out-" + status,
      );
  }
  const index = async () =>
    (
      await (
        await f.call({ action: "conversationIndex", mailboxId: "sales" })
      ).json()
    ).items[0];
  const pending = await index();
  assert.equal(pending.latestMessageId, "out-complained");
  assert.equal(pending.lastMessageAt, "2026-10-21T14:00:00.000Z");
  assert.equal(pending.lastInboundAt, "2026-10-21T10:00:00.000Z");
  assert.equal(pending.lastOutboundAt, null);
  for (const status of ["sent", "delivered", "delayed"]) {
    f.sqlite
      .query(
        "UPDATE emails SET status=?,provider_id='accepted' WHERE id='out-queued'",
      )
      .run(status);
    assert.equal((await index()).lastOutboundAt, "2026-10-21T11:00:00.000Z");
  }
  f.sqlite.exec("UPDATE emails SET status='failed' WHERE id='out-queued'");
  assert.equal((await index()).lastOutboundAt, null);
});

test("discovery keyset pages cover every eligible thread exactly once despite later activity in an earlier thread", async () => {
  const f = await fixture();
  await f.approve();
  for (let i = 0; i < 7; i++) await f.inbound("thread-" + i);
  for (const [id, change] of [
    ["draft", "status='draft'"],
    ["trash", "deleted_at=datetime('now')"],
    ["spam", "spam_at=datetime('now')"],
  ]) {
    await f.inbound(id);
    f.sqlite.exec(`UPDATE emails SET ${change} WHERE id='${id}'`);
  }
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 4; page++) {
    const response = await f.call({
      action: "conversationIndex",
      mailboxId: "sales",
      limit: 2,
      ...(cursor ? { cursor } : {}),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    seen.push(...data.items.map((item: { threadId: string }) => item.threadId));
    assert.equal(data.complete, page === 3);
    assert.equal(data.cursor === null, page === 3);
    cursor = data.cursor ?? undefined;
    if (page === 0)
      f.sqlite.exec(
        "UPDATE emails SET created_at='2099-01-01' WHERE id='thread-0'",
      );
  }
  assert.deepEqual(
    seen,
    Array.from({ length: 7 }, (_, i) => "thread-" + i),
  );
  const refreshed = await (
    await f.call({ action: "conversationIndex", mailboxId: "sales", limit: 1 })
  ).json();
  assert.equal(refreshed.items[0].lastMessageAt, "2099-01-01T00:00:00.000Z");
});

test("discovery obeys the invocation query budget while finishing a larger requested page without omissions", async () => {
  const f = await fixture();
  await f.approve();
  for (let i = 0; i < 30; i++)
    await f.inbound("budget-" + String(i).padStart(2, "0"));
  let queries = 0;
  const prepare = f.db.prepare.bind(f.db);
  f.db.prepare = (sql: string) => {
    queries++;
    return prepare(sql);
  };
  const first = await (
    await f.call({
      action: "conversationIndex",
      mailboxId: "sales",
      limit: 100,
    })
  ).json();
  assert.equal(first.items.length, 25);
  assert.equal(first.complete, false);
  assert.ok(
    queries < 50,
    `discovery exceeded the D1 invocation query budget: ${queries}`,
  );
  queries = 0;
  const second = await (
    await f.call({
      action: "conversationIndex",
      mailboxId: "sales",
      limit: 100,
      cursor: first.cursor,
    })
  ).json();
  assert.equal(second.items.length, 5);
  assert.equal(second.complete, true);
  assert.equal(second.cursor, null);
  assert.ok(queries < 50);
  assert.equal(
    new Set(
      [...first.items, ...second.items].map(
        (item: { threadId: string }) => item.threadId,
      ),
    ).size,
    30,
  );
});

test("discovery cursors are validated, signed, address-bound and complete empty sweeps stay explicit", async () => {
  const f = await fixture();
  await f.approve();
  assert.deepEqual(
    await (
      await f.call({ action: "conversationIndex", mailboxId: "sales" })
    ).json(),
    { items: [], cursor: null, complete: true },
  );
  await f.inbound("a");
  await f.inbound("b");
  const page = await (
    await f.call({ action: "conversationIndex", mailboxId: "sales", limit: 1 })
  ).json();
  for (const cursor of [
    "garbage",
    page.cursor.slice(0, -1) + (page.cursor.endsWith("a") ? "b" : "a"),
    "",
    123,
  ])
    assert.equal(
      (
        await f.call({
          action: "conversationIndex",
          mailboxId: "sales",
          cursor,
        })
      ).status,
      400,
    );
  await changeCrmGrant(f.db, "owner", {
    mailboxId: "private",
    granteeId: "devon",
    canRead: true,
    canSend: false,
  });
  assert.equal(
    (
      await f.call({
        action: "conversationIndex",
        mailboxId: "private",
        cursor: page.cursor,
      })
    ).status,
    400,
  );
  for (const limit of [0, 101, -1, 1.5, "2"])
    assert.equal(
      (await f.call({ action: "conversationIndex", mailboxId: "sales", limit }))
        .status,
      400,
    );
  await changeCrmGrant(f.db, "owner", {
    mailboxId: "sales",
    granteeId: "devon",
    canRead: false,
    canSend: false,
  });
  assert.equal(
    (
      await f.call({
        action: "conversationIndex",
        mailboxId: "sales",
        cursor: page.cursor,
      })
    ).status,
    403,
  );
});

test("history pages are exact and deterministic through tied timestamps and scoped attachments", async () => {
  const f = await fixture();
  await f.approve();
  for (let i = 0; i < 7; i++) {
    await f.inbound("message-" + i);
    f.sqlite.exec(
      `UPDATE emails SET thread_id='thread',created_at='2026-10-21 12:00:00' WHERE id='message-${i}'`,
    );
  }
  await f.inbound("private-message", "private", "PRIVATE_BODY");
  f.sqlite.exec(
    "UPDATE emails SET thread_id='thread',created_at='2099-01-01' WHERE id='private-message'; INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64) VALUES('old-file','message-0','old.txt','text/plain',3,'YWJj'),('private-file','private-message','PRIVATE_FILE','text/plain',3,'YWJj')",
  );
  const seen: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < 3; page++) {
    const response = await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "thread",
      limit: 3,
      ...(before ? { before } : {}),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(
      data.messages.map((m: { id: string }) => m.id),
      page === 0
        ? ["message-4", "message-5", "message-6"]
        : page === 1
          ? ["message-1", "message-2", "message-3"]
          : ["message-0"],
    );
    assert.equal(data.hasOlder, page < 2);
    assert.equal(data.before === null, page === 2);
    assert.equal(JSON.stringify(data).includes("PRIVATE"), false);
    if (page === 2)
      assert.equal(data.messages[0].attachments[0].id, "old-file");
    else
      assert.equal(
        data.messages.flatMap((m: { attachments: unknown[] }) => m.attachments)
          .length,
        0,
      );
    assert.equal(data.messages[0].created_at, "2026-10-21T12:00:00.000Z");
    seen.push(...data.messages.map((m: { id: string }) => m.id));
    before = data.before ?? undefined;
  }
  assert.equal(new Set(seen).size, 7);
  assert.equal(
    f.sqlite.query("SELECT sum(is_read) AS n FROM emails").all()[0].n,
    0,
  );
});

test("history cursor preserves fractional source precision across one-message pages", async () => {
  const f = await fixture();
  await f.approve();
  for (const [id, at] of [
    ["fraction-a", "2026-10-21 12:00:00.1231"],
    ["fraction-b", "2026-10-21 12:00:00.1234"],
    ["fraction-c", "2026-10-21 12:00:00.1239"],
  ]) {
    await f.inbound(id);
    f.sqlite
      .query("UPDATE emails SET thread_id='fractions',created_at=? WHERE id=?")
      .run(at, id);
  }
  let before: string | undefined;
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    const response = await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "fractions",
      limit: 1,
      ...(before ? { before } : {}),
    });
    assert.equal(response.status, 200);
    const page = await response.json();
    seen.push(page.messages[0].id);
    assert.equal(page.hasOlder, i < 2);
    before = page.before ?? undefined;
  }
  assert.deepEqual(seen, ["fraction-c", "fraction-b", "fraction-a"]);
});

test("history supports threads larger than the legacy 200-message response and preserves safe DTOs", async () => {
  const f = await fixture();
  await f.approve();
  for (let i = 0; i < 205; i++) {
    const id = "long-" + String(i).padStart(3, "0");
    await f.inbound(id);
    f.sqlite
      .query(
        "UPDATE emails SET thread_id='long-thread',created_at='2026-10-21 12:00:00' WHERE id=?",
      )
      .run(id);
  }
  assert.equal(
    (
      await f.call({
        action: "thread",
        mailboxId: "sales",
        threadId: "long-thread",
      })
    ).status,
    422,
  );
  const first = await (
    await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "long-thread",
      limit: 100,
    })
  ).json();
  assert.equal(first.messages.length, 100);
  assert.equal(first.messages[0].id, "long-105");
  assert.equal(first.messages.at(-1).id, "long-204");
  const second = await (
    await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "long-thread",
      limit: 100,
      before: first.before,
    })
  ).json();
  assert.equal(second.messages[0].id, "long-005");
  assert.equal(second.messages.at(-1).id, "long-104");
  const third = await (
    await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "long-thread",
      limit: 100,
      before: second.before,
    })
  ).json();
  assert.equal(third.messages.length, 5);
  assert.equal(third.hasOlder, false);
  assert.equal(third.before, null);
  for (const message of first.messages)
    for (const key of [
      "content_key",
      "body_html",
      "bcc_addr",
      "references_header",
      "user_id",
    ])
      assert.equal(key in message, false);
  const index = await (
    await f.call({ action: "conversationIndex", mailboxId: "sales" })
  ).json();
  assert.equal(index.items.length, 1);
  assert.equal(index.items[0].latestMessageId, "long-204");
  await f.approve(true);
  const reply = {
    action: "send",
    mailboxId: "sales",
    fromAddressId: "sales",
    threadId: "long-thread",
    replyToMessageId: "long-204",
    text: "Replying to the latest message after reviewing paginated history.",
    idempotencyKey: crypto.randomUUID(),
  };
  assert.equal((await f.call(reply)).status, 200);
  assert.equal((await f.call(reply)).status, 200);
  assert.equal(f.sent.length, 1);
});

test("history cursors cannot cross threads, sources or the discovery API", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("a");
  await f.inbound("b");
  f.sqlite.exec("UPDATE emails SET thread_id='shared' WHERE id IN ('a','b')");
  await f.inbound("other");
  const history = await (
    await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "shared",
      limit: 1,
    })
  ).json();
  for (const before of ["invalid", history.before + "x"])
    assert.equal(
      (
        await f.call({
          action: "threadHistory",
          mailboxId: "sales",
          threadId: "shared",
          before,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await f.call({
        action: "threadHistory",
        mailboxId: "sales",
        threadId: "other",
        before: history.before,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call({
        action: "conversationIndex",
        mailboxId: "sales",
        cursor: history.before,
      })
    ).status,
    400,
  );
  await changeCrmGrant(f.db, "owner", {
    mailboxId: "private",
    granteeId: "devon",
    canRead: true,
    canSend: false,
  });
  assert.equal(
    (
      await f.call({
        action: "threadHistory",
        mailboxId: "private",
        threadId: "shared",
        before: history.before,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call({
        action: "threadHistory",
        mailboxId: "sales",
        threadId: "other",
        limit: 101,
      })
    ).status,
    400,
  );
});

test("bounded history resumes without skipping messages when content reaches the response byte budget", async () => {
  const f = await fixture();
  await f.approve();
  for (let i = 0; i < 20; i++) {
    const id = "large-" + String(i).padStart(2, "0"),
      key = "private-large/" + id;
    await f.inbound(id);
    await f.bucket.put(
      key,
      JSON.stringify({ text: "x".repeat(200000), html: null }),
    );
    f.sqlite
      .query(
        "UPDATE emails SET thread_id='large-thread',created_at='2026-10-21 12:00:00',content_key=? WHERE id=?",
      )
      .run(key, id);
  }
  const first = await (
    await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "large-thread",
      limit: 100,
    })
  ).json();
  assert.equal(first.hasOlder, true);
  assert.ok(first.messages.length < 20);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(first)).length < 4 * 1024 * 1024,
  );
  const second = await (
    await f.call({
      action: "threadHistory",
      mailboxId: "sales",
      threadId: "large-thread",
      limit: 100,
      before: first.before,
    })
  ).json();
  assert.equal(second.hasOlder, false);
  const ids = [...first.messages, ...second.messages].map(
    (m: { id: string }) => m.id,
  );
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
});

test("ambiguous participant overflow never returns a silently complete or truncated discovery page", async () => {
  const f = await fixture();
  await f.approve();
  await f.inbound("large-audience");
  f.sqlite
    .query("UPDATE emails SET cc_addr=? WHERE id='large-audience'")
    .run(
      Array.from({ length: 201 }, (_, i) => "p" + i + "@example.test").join(
        ", ",
      ),
    );
  const response = await f.call({
    action: "conversationIndex",
    mailboxId: "sales",
  });
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: "participant_review_required",
  });
});
