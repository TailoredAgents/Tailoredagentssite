import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { InboxAccessError, listInboxWorkspace } from "./data";
import {
  addInboxNote,
  InboxInputError,
  markInboxRead,
  saveConversation,
  saveDraft,
  sendInboxMessage,
} from "./service";
import type { MailThreadRecord } from "./types";
import { MailProviderError } from "./mail-provider";

vi.mock("server-only", () => ({}));
const gateway = vi.hoisted(() => ({
  mailboxes: vi.fn(),
  threads: vi.fn(),
  thread: vi.fn(),
  send: vi.fn(),
}));
vi.mock("./mail-provider", () => ({
  listMailboxes: gateway.mailboxes,
  listMailThreads: gateway.threads,
  getMailThread: gateway.thread,
  sendMail: gateway.send,
  MailProviderError: class extends Error {
    constructor(
      public state: string,
      message: string,
      public outcome = "rejected",
    ) {
      super(message);
    }
  },
}));
const databaseUrl = process.env.TEST_INBOX_DATABASE_URL;
const workspace = "00000000-0000-4000-8000-000000000001",
  otherWorkspace = "00000000-0000-4000-8000-000000009002";
const ownerId = "inbox-owner",
  memberId = "inbox-member",
  viewerId = "inbox-viewer",
  otherId = "inbox-other";
const mailbox = {
  id: "sales-address",
  name: "Sales",
  email: "sales@tailoredagents.com",
  canSend: true,
  addresses: [{ id: "sales-address", address: "sales@tailoredagents.com" }],
};
function context(
  userId = ownerId,
  activeWorkspace = workspace,
  role: DashboardContext["role"] = "owner",
): DashboardContext {
  return {
    user: { id: userId, name: userId, email: `${userId}@example.test` },
    workspace: { id: activeWorkspace, name: "Fixture", slug: "fixture" },
    role,
  };
}
const owner = context(),
  member = context(memberId, workspace, "member"),
  viewer = context(viewerId, workspace, "viewer");
const thread: MailThreadRecord = {
  threadId: "thread-1",
  subject: "Website enquiry",
  messages: [
    {
      id: "message-1",
      direction: "inbound",
      from: "prospect@example.test",
      fromName: "Prospect",
      to: "sales@tailoredagents.com",
      cc: null,
      subject: "Website enquiry",
      text: "Live provider body",
      deliveryStatus: "received",
      deliveryDetail: null,
      createdAt: "2026-10-21T12:00:00.000Z",
      replyTargets: ["prospect@example.test"],
      attachments: [],
    },
  ],
};
const envelope = { mailboxId: mailbox.id, threadId: thread.threadId };
function compose(overrides: Record<string, unknown> = {}) {
  return {
    mailboxId: mailbox.id,
    to: "prospect@example.test",
    subject: "Website follow-up",
    text: "A synthetic test message",
    requestId: randomUUID(),
    ...overrides,
  };
}
let pool: Pool;
describe.skipIf(!databaseUrl)(
  "Inbox metadata and outbound intents in isolated PostgreSQL",
  () => {
    it("refuses a stale teammate recipient and sends a reviewed team-copy reply only to its customer", async () => {
      const copied = structuredClone(thread);
      Object.assign(copied.messages[0], { direction: "outbound", teamOutreach: true,
        from: "devon@tailoredagents.com", to: "prospect@example.test", cc: mailbox.email, deliveryStatus: "sent" });
      gateway.thread.mockResolvedValue(copied);
      const input = compose({ ...envelope, replyToMessageId: "message-1", to: "devon@tailoredagents.com" });
      await expect(sendInboxMessage(owner, input)).rejects.toThrow("reply recipients have changed");
      expect(gateway.send).not.toHaveBeenCalled();
      expect((await pool.query("SELECT 1 FROM inbox_outbound_intents")).rowCount).toBe(0);
      expect((await sendInboxMessage(owner, { ...input, to: "prospect@example.test" })).sendState).toBe("accepted");
      expect(gateway.send).toHaveBeenCalledWith(owner, expect.objectContaining({ expectedReplyTargets: ["prospect@example.test"] }));
    });
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.port !== "55433" ||
        url.pathname !== "/ta_inbox_test" ||
        url.search ||
        url.hash
      )
        throw new Error(
          "Inbox tests require exact local ta_inbox_test on port 55433.",
        );
      vi.stubEnv("DATABASE_URL", databaseUrl!);
      pool = getDatabasePool();
      if (
        (await pool.query("SELECT current_database() AS name")).rows[0].name !==
        "ta_inbox_test"
      )
        throw new Error("Unexpected fixture database.");
      await pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
      );
      for (const name of (await readdir("db/migrations"))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        if (
          (
            await pool.query(
              "SELECT 1 FROM schema_migrations WHERE filename=$1",
              [name],
            )
          ).rowCount
        )
          continue;
        const db = await pool.connect();
        try {
          await db.query("BEGIN");
          await db.query(await readFile(`db/migrations/${name}`, "utf8"));
          await db.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
            name,
          ]);
          await db.query("COMMIT");
        } catch (error) {
          await db.query("ROLLBACK");
          throw error;
        } finally {
          db.release();
        }
      }
    }, 30000);
    beforeEach(async () => {
      await pool.query(
        'TRUNCATE inbox_conversations,inbox_drafts,inbox_outbound_intents,crm_businesses,leads,audit_logs,"user" CASCADE',
      );
      await pool.query("DELETE FROM workspaces WHERE id=$1", [otherWorkspace]);
      await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [
        workspace,
      ]);
      await pool.query(
        "INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'inbox-other','Other','internal','active')",
        [otherWorkspace],
      );
      for (const [id, role, workspaceId] of [
        [ownerId, "owner", workspace],
        [memberId, "member", workspace],
        [viewerId, "viewer", workspace],
        [otherId, "owner", otherWorkspace],
      ]) {
        await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2)', [
          id,
          `${id}@example.test`,
        ]);
        await pool.query(
          "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
          [randomUUID(), workspaceId, id, role],
        );
      }
      vi.resetAllMocks();
      gateway.mailboxes.mockResolvedValue([mailbox]);
      gateway.thread.mockResolvedValue(structuredClone(thread));
      gateway.threads.mockResolvedValue({
        items: [
          {
            id: thread.threadId,
            latestMessageId: "message-1",
            subject: thread.subject,
            preview: "Live preview",
            participants: ["prospect@example.test"],
            messageCount: 1,
            isRead: true,
            hasAttachments: false,
            deliveryStatus: "received",
            updatedAt: "2026-10-21T12:00:00.000Z",
          },
        ],
        total: 41,
        page: 2,
        pages: 3,
      });
      gateway.send.mockResolvedValue({
        messageId: "message-out",
        threadId: "thread-out",
        status: "accepted",
      });
    });
    afterAll(async () => {
      await pool?.end();
      delete (globalThis as { tailoredAgentsDatabasePool?: Pool })
        .tailoredAgentsDatabasePool;
      vi.unstubAllEnvs();
    });

    it("keeps provider paging/search authoritative and creates no metadata on read", async () => {
      const view = await listInboxWorkspace(owner, {
        q: "website",
        view: "sent",
        page: "2",
        thread: thread.threadId,
      });
      expect(view.total).toBe(41);
      expect(view.pages).toBe(3);
      expect(view.selected?.messages[0].text).toBe("Live provider body");
      expect(gateway.threads).toHaveBeenCalledWith(owner, mailbox.id, {
        view: "sent",
        q: "website",
        page: 2,
        unreadOnly: false,
      });
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM inbox_conversations"))
          .rows[0].n,
      ).toBe(0);
      expect(view.items[0].isRead).toBe(false);
    });
    it("rejects forged editor roles, inactive memberships and a different workspace", async () => {
      await expect(
        addInboxNote(
          { ...viewer, role: "owner" },
          { ...envelope, body: "Blocked" },
        ),
      ).rejects.toBeInstanceOf(InboxAccessError);
      await expect(
        saveDraft(context(otherId), { mailboxId: mailbox.id, text: "Blocked" }),
      ).rejects.toBeInstanceOf(InboxAccessError);
      await pool.query(
        "UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",
        [ownerId],
      );
      await expect(sendInboxMessage(owner, compose())).rejects.toBeInstanceOf(
        InboxAccessError,
      );
      expect(gateway.send).not.toHaveBeenCalled();
    });
    it("hides notes and private drafts after a live Mail grant is revoked", async () => {
      await addInboxNote(owner, { ...envelope, body: "Internal note" });
      await saveDraft(owner, { ...envelope, text: "Private draft" });
      gateway.mailboxes.mockResolvedValue([]);
      const result = await listInboxWorkspace(owner, {
        thread: thread.threadId,
      });
      expect(result.connection.state).toBe("grant_required");
      expect(result.selected).toBeNull();
      expect(result.members).toEqual([]);
      expect(result.links.businesses).toEqual([]);
      await expect(
        addInboxNote(owner, { ...envelope, body: "Cannot add" }),
      ).rejects.toBeInstanceOf(InboxAccessError);
    });
    it("rechecks Mail access after local metadata is loaded", async () => {
      await addInboxNote(owner, { ...envelope, body: "Private team note" });
      gateway.mailboxes
        .mockResolvedValueOnce([mailbox])
        .mockResolvedValueOnce([]);
      const result = await listInboxWorkspace(owner, {
        thread: thread.threadId,
      });
      expect(result.selected).toBeNull();
      expect(result.connection.state).toBe("grant_required");
    });
    it("shares internal notes but isolates draft ownership and never sends on draft save", async () => {
      await addInboxNote(owner, { ...envelope, body: "For the sales team" });
      await saveDraft(owner, {
        ...envelope,
        text: "Owner private draft",
        to: "prospect@example.test",
        subject: "Draft",
      });
      await saveDraft(member, { ...envelope, text: "Member private draft" });
      expect(
        (await listInboxWorkspace(owner, { thread: thread.threadId })).selected
          ?.draft?.text,
      ).toBe("Owner private draft");
      const memberView = await listInboxWorkspace(member, {
        thread: thread.threadId,
      });
      expect(memberView.selected?.draft?.text).toBe("Member private draft");
      expect(memberView.selected?.notes[0].body).toBe("For the sales team");
      expect(gateway.send).not.toHaveBeenCalled();
    });
    it("records read state per actor and invalidates it when a new message arrives", async () => {
      await markInboxRead(viewer, envelope);
      expect((await listInboxWorkspace(viewer)).items[0].isRead).toBe(true);
      expect((await listInboxWorkspace(owner)).items[0].isRead).toBe(false);
      gateway.threads.mockResolvedValue({
        ...(await gateway.threads()),
        items: [
          {
            ...(await gateway.threads()).items[0],
            latestMessageId: "message-2",
          },
        ],
      });
      expect((await listInboxWorkspace(viewer)).items[0].isRead).toBe(false);
    });
    it("rejects cross-workspace links and assigning a viewer, then saves explicit local links", async () => {
      const business = randomUUID(),
        foreign = randomUUID(),
        lead = randomUUID();
      await pool.query(
        "INSERT INTO crm_businesses(id,workspace_id,name) VALUES($1,$2,'Local'),($3,$4,'Other')",
        [business, workspace, foreign, otherWorkspace],
      );
      await pool.query(
        "INSERT INTO leads(id,workspace_id,name,organization) VALUES($1,$2,'Contact','Local')",
        [lead, workspace],
      );
      await expect(
        saveConversation(owner, {
          ...envelope,
          status: "waiting",
          businessId: foreign,
        }),
      ).rejects.toBeInstanceOf(InboxInputError);
      await expect(
        saveConversation(owner, {
          ...envelope,
          status: "waiting",
          ownerId: viewerId,
        }),
      ).rejects.toBeInstanceOf(InboxInputError);
      await saveConversation(owner, {
        ...envelope,
        status: "waiting",
        ownerId: memberId,
        businessId: business,
        leadId: lead,
      });
      const result = await listInboxWorkspace(owner, {
        thread: thread.threadId,
      });
      expect(result.selected?.conversation).toMatchObject({
        status: "waiting",
        ownerId: memberId,
        businessId: business,
        leadId: lead,
      });
    });
    it("requires Mail send permission even for a dashboard owner", async () => {
      gateway.mailboxes.mockResolvedValue([{ ...mailbox, canSend: false }]);
      await expect(sendInboxMessage(owner, compose())).rejects.toBeInstanceOf(
        InboxAccessError,
      );
      expect(gateway.send).not.toHaveBeenCalled();
    });
    it("rejects messages above the Mail limit before reserving or sending", async () => {
      await expect(
        sendInboxMessage(owner, compose({ text: "x".repeat(12001) })),
      ).rejects.toThrow("12,000 characters");
      expect(gateway.send).not.toHaveBeenCalled();
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM inbox_outbound_intents",
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("blocks email suppression for compose and derives reply recipients from the live message", async () => {
      await pool.query(
        "INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status) VALUES($1,'email','prospect@example.test','blocked')",
        [workspace],
      );
      await expect(sendInboxMessage(owner, compose())).rejects.toBeInstanceOf(
        InboxInputError,
      );
      await expect(
        sendInboxMessage(
          owner,
          compose({
            ...envelope,
            replyToMessageId: "message-1",
            to: "different@example.test",
          }),
        ),
      ).rejects.toBeInstanceOf(InboxInputError);
      expect(gateway.send).not.toHaveBeenCalled();
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM inbox_outbound_intents",
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("validates reply thread membership and uses the scoped sales sender", async () => {
      await expect(
        sendInboxMessage(
          owner,
          compose({ ...envelope, replyToMessageId: "not-in-thread" }),
        ),
      ).rejects.toBeInstanceOf(InboxInputError);
      const input = compose({
        ...envelope,
        replyToMessageId: "message-1",
        to: "ignored@example.test",
      });
      const result = await sendInboxMessage(owner, input);
      expect(result.sendState).toBe("accepted");
      expect(gateway.send).toHaveBeenCalledWith(
        owner,
        expect.objectContaining({
          fromAddressId: mailbox.id,
          replyToMessageId: "message-1",
          to: undefined,
          idempotencyKey: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
        }),
      );
    });
    it("reserves a durable content-free receipt before send and reuses accepted results", async () => {
      const input = compose();
      gateway.send.mockImplementationOnce(async () => {
        const receipt = (
          await pool.query(
            "SELECT * FROM inbox_outbound_intents WHERE request_id=$1",
            [input.requestId],
          )
        ).rows[0];
        expect(receipt.state).toBe("pending");
        expect(JSON.stringify(receipt)).not.toContain("prospect@example.test");
        expect(JSON.stringify(receipt)).not.toContain(input.text);
        return {
          messageId: "outbound-id",
          threadId: "outbound-thread",
          status: "accepted",
        };
      });
      const first = await sendInboxMessage(owner, input),
        second = await sendInboxMessage(owner, input);
      expect(first).toEqual(second);
      expect(first.message).toContain("Delivery is not yet confirmed");
      expect(gateway.send).toHaveBeenCalledTimes(1);
      await expect(
        sendInboxMessage(owner, { ...input, text: "Changed message" }),
      ).rejects.toBeInstanceOf(InboxInputError);
      await expect(sendInboxMessage(member, input)).rejects.toBeInstanceOf(
        InboxInputError,
      );
    });
    it("retries uncertain sends using the same provider key and preserves the private draft until accepted", async () => {
      const input = compose();
      await saveDraft(owner, {
        mailboxId: mailbox.id,
        text: input.text,
        to: input.to,
        subject: input.subject,
      });
      gateway.send.mockRejectedValueOnce(
        new MailProviderError("unavailable", "Network interrupted", "unknown"),
      );
      const first = await sendInboxMessage(owner, input);
      expect(first.sendState).toBe("unknown");
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM inbox_drafts"))
          .rows[0].n,
      ).toBe(1);
      const second = await sendInboxMessage(owner, input);
      expect(second.sendState).toBe("accepted");
      expect(gateway.send.mock.calls[0][1].idempotencyKey).toBe(
        gateway.send.mock.calls[1][1].idempotencyKey,
      );
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM inbox_drafts"))
          .rows[0].n,
      ).toBe(0);
    });
    it("prevents parallel duplicate sends while a request is pending", async () => {
      const input = compose();
      let finish!: (value: unknown) => void;
      gateway.send.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const initial = sendInboxMessage(owner, input);
      await vi.waitFor(() => expect(gateway.send).toHaveBeenCalledTimes(1));
      const duplicate = await sendInboxMessage(owner, input);
      expect(duplicate.sendState).toBe("pending");
      expect(gateway.send).toHaveBeenCalledTimes(1);
      finish({
        messageId: "parallel-out",
        threadId: "parallel-thread",
        status: "pending",
      });
      expect((await initial).sendState).toBe("accepted");
    });
    it("preserves a newer private draft saved in another tab while a send is in flight", async () => {
      const input = compose();
      await saveDraft(owner, {
        mailboxId: mailbox.id,
        text: input.text,
        to: input.to,
        subject: input.subject,
      });
      gateway.send.mockImplementationOnce(async () => {
        await saveDraft(owner, {
          mailboxId: mailbox.id,
          text: "Another unsent message",
          to: input.to,
          subject: "Newer draft",
        });
        return {
          messageId: "new-tab-out",
          threadId: "new-tab-thread",
          status: "accepted",
        };
      });
      expect((await sendInboxMessage(owner, input)).sendState).toBe("accepted");
      expect(
        (await pool.query("SELECT body FROM inbox_drafts")).rows[0].body,
      ).toBe("Another unsent message");
    });
    it("clears the exact saved draft after sending text with leading whitespace and a trailing newline", async () => {
      const input = compose({
        text: "  A synthetic message with editor whitespace.\n",
      });
      await saveDraft(owner, {
        mailboxId: mailbox.id,
        text: input.text,
        to: input.to,
        subject: input.subject,
      });
      expect(
        (await pool.query("SELECT body FROM inbox_drafts")).rows[0].body,
      ).toBe(input.text);
      expect((await sendInboxMessage(owner, input)).sendState).toBe("accepted");
      expect(gateway.send).toHaveBeenCalledWith(
        owner,
        expect.objectContaining({
          text: "A synthetic message with editor whitespace.",
        }),
      );
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM inbox_drafts"))
          .rows[0].n,
      ).toBe(0);
    });
    it("distinguishes definite rejection from uncertain acceptance and allows unchanged retry", async () => {
      const input = compose();
      gateway.send.mockRejectedValueOnce(
        new MailProviderError("unavailable", "Recipient rejected", "rejected"),
      );
      const first = await sendInboxMessage(owner, input);
      expect(first.sendState).toBe("rejected");
      expect(
        (await pool.query("SELECT state FROM inbox_outbound_intents")).rows[0]
          .state,
      ).toBe("failed");
      expect((await sendInboxMessage(owner, input)).sendState).toBe("accepted");
    });
    it("keeps uncertain sends locked after a later definite rejection cannot disprove the original acceptance", async () => {
      const input = compose();
      gateway.send.mockRejectedValueOnce(
        new MailProviderError("unavailable", "Timeout", "unknown"),
      );
      expect((await sendInboxMessage(owner, input)).sendState).toBe("unknown");
      gateway.send.mockRejectedValueOnce(
        new MailProviderError("grant_required", "Grant revoked", "rejected"),
      );
      expect((await sendInboxMessage(owner, input)).sendState).toBe("unknown");
      expect(
        (await pool.query("SELECT state FROM inbox_outbound_intents")).rows[0]
          .state,
      ).toBe("unknown");
      expect((await sendInboxMessage(owner, input)).sendState).toBe("accepted");
      expect(
        new Set(gateway.send.mock.calls.map((call) => call[1].idempotencyKey))
          .size,
      ).toBe(1);
    });
    it("expires old drafts and notes through existing maintenance without deleting idempotency tombstones", async () => {
      await addInboxNote(owner, { ...envelope, body: "Old note" });
      await saveDraft(owner, { ...envelope, text: "Old draft" });
      await sendInboxMessage(owner, compose());
      await pool.query(
        "UPDATE inbox_notes SET created_at=now()-interval '25 months'",
      );
      await pool.query(
        "UPDATE inbox_drafts SET updated_at=now()-interval '91 days'",
      );
      await pool.query(
        "UPDATE inbox_outbound_intents SET updated_at=now()-interval '25 months'",
      );
      await pool.query("SELECT perform_reporting_retention()");
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM inbox_notes")).rows[0]
          .n,
      ).toBe(0);
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM inbox_drafts"))
          .rows[0].n,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM inbox_outbound_intents",
          )
        ).rows[0].n,
      ).toBe(1);
    });
  },
);
