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
import { listSmsSettings, listSmsWorkspace, SmsAccessError } from "./data";
import {
  addSmsNote,
  checkSmsSend,
  connectSmsNumber,
  markSmsRead,
  receiveSmsStatus,
  receiveSmsWebhook,
  saveSmsConversation,
  saveSmsDraft,
  saveSmsGrant,
  sendSmsMessage,
  setSmsNumberStatus,
  SmsInputError,
} from "./service";
import { TwilioProviderError } from "@/lib/twilio/provider";

vi.mock("server-only", () => ({}));
const gateway = vi.hoisted(() => ({
  lookup: vi.fn(),
  create: vi.fn(),
  fetch: vi.fn(),
  enabled: true,
  ready: true,
  webhookReady: true,
  account: "AC" + "1".repeat(32),
  phone: "+16785417725",
}));
vi.mock("@/lib/twilio/config", () => ({
  getTwilioConfiguration: () => ({
    ready: gateway.ready,
    webhookReady: gateway.webhookReady,
    enabled: gateway.enabled,
    accountSid: gateway.account,
    phoneNumber: gateway.phone,
  }),
  getTwilioPublicConfiguration: () => ({
    ready: gateway.ready,
    enabled: gateway.enabled,
    phoneNumber: gateway.phone,
    incomingUrl: "https://example.test/incoming",
    statusUrlTemplate: "https://example.test/status?attempt={attempt-id}",
  }),
}));
vi.mock("@/lib/twilio/provider", () => ({
  lookupOwnedNumber: gateway.lookup,
  createSms: gateway.create,
  fetchSms: gateway.fetch,
  TwilioProviderError: class extends Error {
    constructor(
      public outcome: string,
      message: string,
      public providerCode?: number,
    ) {
      super(message);
    }
  },
}));
const databaseUrl = process.env.TEST_SMS_DATABASE_URL;
const workspace = "00000000-0000-4000-8000-000000000001",
  otherWorkspace = "00000000-0000-4000-8000-000000009502";
const ownerId = "sms-owner",
  memberId = "sms-member",
  viewerId = "sms-viewer",
  otherId = "sms-other",
  unapprovedId = "sms-unapproved";
const account = "AC" + "1".repeat(32),
  businessPhone = "+16785417725",
  remote = "+12125550123";
function context(
  userId = ownerId,
  workspaceId = workspace,
  role: DashboardContext["role"] = "owner",
): DashboardContext {
  return {
    user: { id: userId, name: userId, email: `${userId}@example.test` },
    workspace: { id: workspaceId, name: "Fixture", slug: "fixture" },
    role,
  };
}
const owner = context(),
  member = context(memberId, workspace, "member"),
  viewer = context(viewerId, workspace, "viewer");
let pool: Pool,
  numberId: string,
  sequence = 0;
const sid = (sequence: number) =>
  "SM" + sequence.toString(16).padStart(32, "0");
function incoming(
  body = "Synthetic inbound",
  overrides: Record<string, string> = {},
) {
  return {
    AccountSid: account,
    MessageSid: sid(++sequence),
    From: remote,
    To: businessPhone,
    Body: body,
    NumMedia: "0",
    ...overrides,
  };
}
function compose(overrides: Record<string, unknown> = {}) {
  return {
    numberId,
    to: remote,
    text: "A synthetic SMS",
    requestId: randomUUID(),
    ...overrides,
  };
}
async function count(table: string) {
  return Number(
    (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,
  );
}
async function selected(conversationId: string, activeContext = owner) {
  return (
    await listSmsWorkspace(activeContext, {
      number: numberId,
      thread: conversationId,
    })
  ).selected!;
}
describe.skipIf(!databaseUrl)(
  "SMS inbox using a guarded isolated PostgreSQL database",
  () => {
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.port !== "55433" ||
        url.pathname !== "/ta_sms_test" ||
        url.search ||
        url.hash
      )
        throw new Error(
          "SMS tests require exact local ta_sms_test on port 55433.",
        );
      vi.stubEnv("DATABASE_URL", databaseUrl!);
      pool = getDatabasePool();
      if (
        (await pool.query("SELECT current_database() AS name")).rows[0].name !==
        "ta_sms_test"
      )
        throw new Error("Unexpected database.");
      await pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
      );
      for (const file of (await readdir("db/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        if (
          (
            await pool.query(
              "SELECT 1 FROM schema_migrations WHERE filename=$1",
              [file],
            )
          ).rowCount
        )
          continue;
        const db = await pool.connect();
        try {
          await db.query("BEGIN");
          await db.query(await readFile(`db/migrations/${file}`, "utf8"));
          await db.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
            file,
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
        'TRUNCATE sms_numbers,crm_channel_preferences,crm_businesses,leads,audit_logs,"user" CASCADE',
      );
      await pool.query("DELETE FROM workspaces WHERE id=$1", [otherWorkspace]);
      await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [
        workspace,
      ]);
      await pool.query(
        "INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'sms-other','Other','internal','active')",
        [otherWorkspace],
      );
      for (const [id, role, ws] of [
        [ownerId, "owner", workspace],
        [memberId, "member", workspace],
        [viewerId, "viewer", workspace],
        [unapprovedId, "member", workspace],
        [otherId, "owner", otherWorkspace],
      ]) {
        await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2)', [
          id,
          `${id}@example.test`,
        ]);
        await pool.query(
          "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
          [randomUUID(), ws, id, role],
        );
      }
      vi.resetAllMocks();
      gateway.enabled = true;
      gateway.ready = true;
      gateway.webhookReady = true;
      gateway.account = account;
      gateway.phone = businessPhone;
      sequence = 0;
      gateway.lookup.mockResolvedValue({
        accountSid: account,
        phone: businessPhone,
        providerSid: "PN" + "2".repeat(32),
        smsEnabled: true,
      });
      gateway.create.mockImplementation(
        async (input: { from: string; to: string }) => ({
          sid: sid(++sequence),
          status: "queued",
          accountSid: account,
          from: input.from,
          to: input.to,
        }),
      );
      gateway.fetch.mockImplementation(async (messageSid: string) => ({
        sid: messageSid,
        status: "delivered",
        accountSid: account,
        from: businessPhone,
        to: remote,
      }));
      numberId = await connectSmsNumber(owner, { phone: businessPhone });
      await saveSmsGrant(owner, {
        numberId,
        userId: memberId,
        canRead: true,
        canSend: true,
      });
      await saveSmsGrant(owner, {
        numberId,
        userId: viewerId,
        canRead: true,
        canSend: true,
      });
    });
    afterAll(async () => {
      await pool?.end();
      delete (globalThis as { tailoredAgentsDatabasePool?: Pool })
        .tailoredAgentsDatabasePool;
      vi.unstubAllEnvs();
    });
    it("verifies configured account ownership and capability, granting only the connector", async () => {
      expect(await count("sms_numbers")).toBe(1);
      expect(
        (await listSmsWorkspace(context(unapprovedId))).connection.state,
      ).toBe("grant_required");
      await expect(
        connectSmsNumber(member, { phone: businessPhone }),
      ).rejects.toBeInstanceOf(SmsAccessError);
      await expect(
        connectSmsNumber(owner, { phone: "+12125550000" }),
      ).rejects.toBeInstanceOf(SmsInputError);
      gateway.lookup.mockResolvedValueOnce({
        accountSid: account,
        phone: businessPhone,
        providerSid: "PN" + "2".repeat(32),
        smsEnabled: false,
      });
      await expect(
        connectSmsNumber(owner, { phone: businessPhone }),
      ).rejects.toBeInstanceOf(SmsInputError);
      const settings = await listSmsSettings(owner);
      expect(settings.numbers[0].grants).toHaveLength(3);
      expect((await listSmsSettings(member)).canManage).toBe(false);
    });
    it("cannot rebind a verified number from another workspace", async () => {
      await expect(
        connectSmsNumber(context(otherId, otherWorkspace), {
          phone: businessPhone,
        }),
      ).rejects.toBeInstanceOf(SmsInputError);
      expect(await count("sms_numbers")).toBe(1);
    });
    it("denies forged viewer roles, suspended membership, unapproved numbers and another workspace", async () => {
      await expect(
        sendSmsMessage({ ...viewer, role: "owner" }, compose()),
      ).rejects.toBeInstanceOf(SmsAccessError);
      await expect(
        saveSmsDraft(context(unapprovedId), { numberId, text: "Private" }),
      ).rejects.toBeInstanceOf(SmsAccessError);
      await expect(
        sendSmsMessage(context(otherId, otherWorkspace), compose()),
      ).rejects.toBeInstanceOf(SmsAccessError);
      await pool.query(
        "UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",
        [memberId],
      );
      await expect(sendSmsMessage(member, compose())).rejects.toBeInstanceOf(
        SmsAccessError,
      );
      expect(gateway.create).not.toHaveBeenCalled();
    });
    it("requires explicit grants, hides notes on revocation and rejects sends under a read-only grant", async () => {
      const record = await receiveSmsWebhook(incoming());
      await addSmsNote(owner, {
        numberId,
        conversationId: record.conversationId,
        body: "Team note",
      });
      await saveSmsGrant(owner, {
        numberId,
        userId: memberId,
        canRead: true,
        canSend: false,
      });
      await expect(sendSmsMessage(member, compose())).rejects.toBeInstanceOf(
        SmsAccessError,
      );
      await saveSmsGrant(owner, {
        numberId,
        userId: memberId,
        canRead: false,
        canSend: false,
      });
      const view = await listSmsWorkspace(member, {
        thread: record.conversationId,
      });
      expect(view.selected).toBeNull();
      expect(view.items).toEqual([]);
      expect(view.members).toEqual([]);
      await expect(
        saveSmsGrant(owner, {
          numberId,
          userId: memberId,
          canRead: false,
          canSend: true,
        }),
      ).rejects.toBeInstanceOf(SmsInputError);
    });
    it("binds every read to the current configured account and number", async () => {
      const record = await receiveSmsWebhook(incoming());
      await addSmsNote(owner, {
        numberId,
        conversationId: record.conversationId,
        body: "Should be hidden",
      });
      gateway.account = "AC" + "9".repeat(32);
      const view = await listSmsWorkspace(owner, {
        thread: record.conversationId,
      });
      expect(view.selected).toBeNull();
      expect(view.connection.state).toBe("grant_required");
      await expect(sendSmsMessage(owner, compose())).rejects.toBeInstanceOf(
        SmsAccessError,
      );
    });
    it("creates canonical number-scoped threads, deduplicates delivery and does not guess CRM identities", async () => {
      const payload = incoming("First SMS", {
          NumMedia: "2",
          MediaUrl0: "https://untrusted.example/file",
        }),
        first = await receiveSmsWebhook(payload),
        duplicate = await receiveSmsWebhook(payload),
        second = await receiveSmsWebhook(incoming("Second SMS"));
      expect(duplicate.duplicate).toBe(true);
      expect(second.conversationId).toBe(first.conversationId);
      expect(await count("sms_messages")).toBe(2);
      expect(await count("crm_businesses")).toBe(0);
      const record = await selected(first.conversationId);
      expect(record.messages[0].mediaCount).toBe(2);
      expect(JSON.stringify(record)).not.toContain("untrusted.example");
      expect(record.conversation.blocked).toBe(false);
    });
    it("records STOP for unknown contacts and keeps START blocked pending deliberate review", async () => {
      const first = await receiveSmsWebhook(incoming("STOPALL"));
      expect((await selected(first.conversationId)).conversation.blocked).toBe(
        true,
      );
      await receiveSmsWebhook(incoming("START", { OptOutType: "START" }));
      expect(
        (await selected(first.conversationId)).conversation.blocked,
      ).toBe(true);
      await expect(
        sendSmsMessage(
          owner,
          compose(),
        ),
      ).rejects.toBeInstanceOf(SmsInputError);
      expect(gateway.create).not.toHaveBeenCalled();
      expect(await count("crm_businesses")).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM audit_logs WHERE action='sms.resubscription_review_requested'",
          )
        ).rows[0].n,
      ).toBe(1);
    });
    it("rejects a reused inbound SID whose immutable sender identity changed", async () => {
      const payload = incoming("Original sender");
      await receiveSmsWebhook(payload);
      await expect(
        receiveSmsWebhook({ ...payload, From: "+12125559999", Body: "STOP" }),
      ).rejects.toBeInstanceOf(SmsInputError);
      expect(await count("sms_messages")).toBe(1);
      expect(await count("crm_channel_preferences")).toBe(0);
    });
    it("sends a new text without permission fields or manufacturing an allowed preference", async () => {
      const first = await sendSmsMessage(owner, compose());
      expect(first.sendState).toBe("accepted");
      expect((await selected(first.conversationId!)).conversation.blocked).toBe(false);
      expect((await sendSmsMessage(member, compose())).sendState).toBe("accepted");
      expect(gateway.create).toHaveBeenCalledTimes(2);
      expect(await count("crm_channel_preferences")).toBe(0);
    });
    it("replies to an incoming text without permission fields", async () => {
      const incomingText = await receiveSmsWebhook(incoming());
      const reply = await sendSmsMessage(owner, compose({ conversationId: incomingText.conversationId }));
      expect(reply.sendState).toBe("accepted");
      expect(reply.conversationId).toBe(incomingText.conversationId);
      expect(gateway.create).toHaveBeenCalledTimes(1);
      expect(await count("crm_channel_preferences")).toBe(0);
    });
    it("rejects SMS extensions and oversized/blank text before making a provider request", async () => {
      await expect(
        sendSmsMessage(owner, compose({ to: "+12125550123 ext 99" })),
      ).rejects.toThrow("extension");
      await expect(
        sendSmsMessage(owner, compose({ text: "x".repeat(1601) })),
      ).rejects.toThrow("1,600");
      await expect(
        sendSmsMessage(owner, compose({ text: "   " })),
      ).rejects.toThrow("Write");
      expect(gateway.create).not.toHaveBeenCalled();
    });
    it("reserves a content-free intent before its one provider POST and replays accepted results", async () => {
      const input = compose();
      gateway.create.mockImplementationOnce(async (args) => {
        const receipt = (await pool.query("SELECT * FROM sms_outbound_intents"))
          .rows[0];
        expect(receipt.state).toBe("sending");
        expect(JSON.stringify(receipt)).not.toContain(input.text);
        expect(JSON.stringify(receipt)).not.toContain(remote);
        return {
          sid: sid(++sequence),
          status: "queued",
          accountSid: account,
          from: args.from,
          to: args.to,
        };
      });
      const first = await sendSmsMessage(owner, input),
        second = await sendSmsMessage(owner, input);
      expect(first).toEqual(second);
      expect(gateway.create).toHaveBeenCalledTimes(1);
      await expect(
        sendSmsMessage(owner, { ...input, text: "Changed contents" }),
      ).rejects.toBeInstanceOf(SmsInputError);
      await expect(sendSmsMessage(member, input)).rejects.toBeInstanceOf(
        SmsInputError,
      );
    });
    it("never creates another message after timeout; unknown status checks wait for verified SID evidence", async () => {
      const input = compose();
      gateway.create.mockRejectedValueOnce(
        new TwilioProviderError("unknown", "Timed out"),
      );
      const first = await sendSmsMessage(owner, input);
      expect(first.sendState).toBe("unknown");
      expect((await sendSmsMessage(owner, input)).sendState).toBe("unknown");
      expect(
        (await checkSmsSend(owner, { numberId, requestId: input.requestId }))
          .sendState,
      ).toBe("unknown");
      expect(gateway.create).toHaveBeenCalledTimes(1);
      expect(gateway.fetch).not.toHaveBeenCalled();
      const messageSid = sid(++sequence);
      await receiveSmsStatus(input.requestId, {
        AccountSid: account,
        MessageSid: messageSid,
        From: businessPhone,
        To: remote,
        MessageStatus: "sent",
      });
      const checked = await checkSmsSend(owner, {
        numberId,
        requestId: input.requestId,
      });
      expect(checked.sendState).toBe("accepted");
      expect((await selected(first.conversationId!)).messages[0].status).toBe(
        "delivered",
      );
      expect(gateway.create).toHaveBeenCalledTimes(1);
    });
    it("caps new sends per teammate without charging replays or status checks another slot", async () => {
      const input = compose();
      await sendSmsMessage(owner, input);
      await pool.query(
        "INSERT INTO sms_outbound_intents(request_id,workspace_id,number_id,message_id,actor_user_id,request_hash,state) SELECT gen_random_uuid(),workspace_id,number_id,message_id,actor_user_id,request_hash,'accepted' FROM sms_outbound_intents CROSS JOIN generate_series(1,29) WHERE request_id=$1",
        [input.requestId],
      );
      await expect(sendSmsMessage(owner, compose())).rejects.toThrow(
        "hourly SMS limit",
      );
      expect((await sendSmsMessage(owner, input)).sendState).toBe("accepted");
      expect(
        (await checkSmsSend(owner, { numberId, requestId: input.requestId }))
          .sendState,
      ).toBe("accepted");
      expect(gateway.create).toHaveBeenCalledTimes(1);
    });
    it("caps new sends for the shared number across teammates", async () => {
      const input = compose();
      await sendSmsMessage(owner, input);
      await pool.query(
        "INSERT INTO sms_outbound_intents(request_id,workspace_id,number_id,message_id,actor_user_id,request_hash,state) SELECT gen_random_uuid(),workspace_id,number_id,message_id,NULL,request_hash,'accepted' FROM sms_outbound_intents CROSS JOIN generate_series(1,99) WHERE request_id=$1",
        [input.requestId],
      );
      await expect(sendSmsMessage(member, compose())).rejects.toThrow(
        "hourly SMS limit",
      );
      expect(gateway.create).toHaveBeenCalledTimes(1);
    });
    it("supports status callbacks without optional participants using known SID or a verified read lookup", async () => {
      const accepted = await sendSmsMessage(owner, compose()),
        known = (await selected(accepted.conversationId!)).messages[0]
          .providerId!;
      await receiveSmsStatus(accepted.requestId!, {
        AccountSid: account,
        MessageSid: known,
        MessageStatus: "delivered",
      });
      expect(gateway.fetch).not.toHaveBeenCalled();
      const unknown = compose();
      gateway.create.mockRejectedValueOnce(
        new TwilioProviderError("unknown", "Timeout"),
      );
      await sendSmsMessage(owner, unknown);
      const unknownSid = sid(++sequence);
      await receiveSmsStatus(unknown.requestId, {
        AccountSid: account,
        MessageSid: unknownSid,
        MessageStatus: "sent",
      });
      expect(gateway.fetch).toHaveBeenCalledWith(unknownSid);
      expect(
        (await checkSmsSend(owner, { numberId, requestId: unknown.requestId }))
          .sendState,
      ).toBe("accepted");
    });
    it("preserves delivered status against stale failures and rejects mismatched callback identities", async () => {
      const input = compose(),
        sent = await sendSmsMessage(owner, input),
        providerSid = (await selected(sent.conversationId!)).messages[0]
          .providerId!;
      const callback = {
        AccountSid: account,
        MessageSid: providerSid,
        From: businessPhone,
        To: remote,
        MessageStatus: "delivered",
      };
      await receiveSmsStatus(input.requestId, callback);
      await receiveSmsStatus(input.requestId, {
        ...callback,
        MessageStatus: "failed",
        ErrorCode: "30003",
      });
      await receiveSmsStatus(input.requestId, {
        ...callback,
        MessageStatus: "sent",
      });
      expect((await selected(sent.conversationId!)).messages[0]).toMatchObject({
        status: "delivered",
        errorCode: null,
      });
      await expect(
        receiveSmsStatus(input.requestId, { ...callback, To: "+12125550000" }),
      ).rejects.toBeInstanceOf(SmsAccessError);
      await expect(
        receiveSmsStatus(input.requestId, {
          ...callback,
          MessageSid: sid(++sequence),
        }),
      ).rejects.toBeInstanceOf(SmsInputError);
      await expect(
        receiveSmsWebhook(incoming("Bad", { To: "+12125550000" })),
      ).rejects.toBeInstanceOf(SmsAccessError);
    });
    it("reconciles a callback arriving before a lost create response", async () => {
      const input = compose(),
        messageSid = sid(++sequence);
      gateway.create.mockImplementationOnce(async () => {
        await receiveSmsStatus(input.requestId, {
          AccountSid: account,
          MessageSid: messageSid,
          From: businessPhone,
          To: remote,
          MessageStatus: "delivered",
        });
        throw new TwilioProviderError("unknown", "Lost response");
      });
      const sent = await sendSmsMessage(owner, input);
      expect(sent.sendState).toBe("accepted");
      expect((await selected(sent.conversationId!)).messages[0].status).toBe(
        "delivered",
      );
    });
    it("persists provider-reported opt-out and never retries a rejected attempt with the same key", async () => {
      const input = compose();
      gateway.create.mockRejectedValueOnce(
        new TwilioProviderError("rejected", "Recipient opted out", 21610),
      );
      expect((await sendSmsMessage(owner, input)).sendState).toBe("rejected");
      expect((await sendSmsMessage(owner, input)).sendState).toBe("rejected");
      expect(gateway.create).toHaveBeenCalledTimes(1);
      expect(
        (
          await pool.query(
            "SELECT status FROM crm_channel_preferences WHERE channel='sms'",
          )
        ).rows[0].status,
      ).toBe("blocked");
    });
    it("pauses outbound requests while preserving signed inbound/callback processing", async () => {
      await setSmsNumberStatus(owner, { numberId, status: "paused" });
      await expect(sendSmsMessage(owner, compose())).rejects.toBeInstanceOf(
        SmsAccessError,
      );
      const inbound = await receiveSmsWebhook(incoming("While paused"));
      expect((await selected(inbound.conversationId)).messages).toHaveLength(1);
      await setSmsNumberStatus(owner, { numberId, status: "active" });
      gateway.enabled = false;
      await expect(sendSmsMessage(owner, compose())).rejects.toBeInstanceOf(
        SmsAccessError,
      );
      expect(gateway.create).not.toHaveBeenCalled();
    });
    it("retains inbound opt-outs when REST keys are unavailable but webhook credentials remain valid", async () => {
      gateway.ready = false;
      gateway.enabled = false;
      const record = await receiveSmsWebhook(incoming("STOP"));
      expect(record.duplicate).toBe(false);
      expect(
        (
          await pool.query(
            "SELECT status FROM crm_channel_preferences WHERE channel='sms'",
          )
        ).rows[0].status,
      ).toBe("blocked");
    });
    it("shares notes but isolates drafts and personal read receipts", async () => {
      const inbound = await receiveSmsWebhook(incoming()),
        envelope = { numberId, conversationId: inbound.conversationId };
      await addSmsNote(owner, { ...envelope, body: "Team context" });
      await saveSmsDraft(owner, {
        ...envelope,
        to: remote,
        text: "Owner draft",
      });
      await saveSmsDraft(member, {
        ...envelope,
        to: remote,
        text: "Member draft",
      });
      await markSmsRead(viewer, envelope);
      expect((await selected(inbound.conversationId)).draft?.text).toBe(
        "Owner draft",
      );
      const memberRecord = await selected(inbound.conversationId, member);
      expect(memberRecord.draft?.text).toBe("Member draft");
      expect(memberRecord.notes[0].body).toBe("Team context");
      expect(memberRecord.conversation.isRead).toBe(false);
      expect(
        (await selected(inbound.conversationId, viewer)).conversation.isRead,
      ).toBe(true);
      await receiveSmsWebhook(incoming("New message"));
      expect(
        (await selected(inbound.conversationId, viewer)).conversation.isRead,
      ).toBe(false);
      expect(gateway.create).not.toHaveBeenCalled();
    });
    it("clears only the exact sent draft and preserves a newer draft from another tab", async () => {
      const input = compose({ text: "  Draft with whitespace\n" });
      await saveSmsDraft(owner, input);
      const sent = await sendSmsMessage(owner, input);
      expect(sent.sendState).toBe("accepted");
      expect(await count("sms_drafts")).toBe(0);
      const next = compose({ text: "Another message" });
      await saveSmsDraft(owner, next);
      gateway.create.mockImplementationOnce(async (args) => {
        await saveSmsDraft(owner, {
          numberId,
          to: remote,
          text: "New unsent draft",
        });
        return {
          sid: sid(++sequence),
          status: "queued",
          accountSid: account,
          from: args.from,
          to: args.to,
        };
      });
      await sendSmsMessage(owner, next);
      expect(
        (await pool.query("SELECT body FROM sms_drafts")).rows[0].body,
      ).toBe("New unsent draft");
    });
    it("checks explicit links and assignees within the workspace and number grant", async () => {
      const inbound = await receiveSmsWebhook(incoming()),
        business = randomUUID(),
        foreign = randomUUID();
      await pool.query(
        "INSERT INTO crm_businesses(id,workspace_id,name) VALUES($1,$2,'Local business'),($3,$4,'Other business')",
        [business, workspace, foreign, otherWorkspace],
      );
      await expect(
        saveSmsConversation(owner, {
          numberId,
          conversationId: inbound.conversationId,
          status: "waiting",
          businessId: foreign,
        }),
      ).rejects.toBeInstanceOf(SmsInputError);
      await expect(
        saveSmsConversation(owner, {
          numberId,
          conversationId: inbound.conversationId,
          status: "waiting",
          ownerId: unapprovedId,
        }),
      ).rejects.toBeInstanceOf(SmsInputError);
      await saveSmsConversation(owner, {
        numberId,
        conversationId: inbound.conversationId,
        status: "waiting",
        ownerId: memberId,
        businessId: business,
      });
      expect(
        (await selected(inbound.conversationId)).conversation,
      ).toMatchObject({
        status: "waiting",
        ownerId: memberId,
        businessId: business,
      });
    });
    it("hides expired body text from previews, detail and search before maintenance scrubs storage", async () => {
      const record = await receiveSmsWebhook(
        incoming("expired-private-search-token"),
      );
      await pool.query(
        "UPDATE sms_messages SET body_expires_at=now()-interval '1 minute' WHERE conversation_id=$1",
        [record.conversationId],
      );
      const view = await listSmsWorkspace(owner, {
        thread: record.conversationId,
      });
      expect(view.items[0].preview).toBe("[Expired message content removed]");
      expect(view.selected?.messages[0].text).toBe(
        "[Expired message content removed]",
      );
      expect(
        (await listSmsWorkspace(owner, { q: "expired-private-search-token" }))
          .total,
      ).toBe(0);
      expect(
        (await pool.query("SELECT body_removed_at FROM sms_messages")).rows[0]
          .body_removed_at,
      ).toBeNull();
    });
    it("expires message bodies, drafts and notes while retaining receipt/SID tombstones", async () => {
      const sent = await sendSmsMessage(owner, compose()),
        envelope = { numberId, conversationId: sent.conversationId };
      await addSmsNote(owner, { ...envelope, body: "Old note" });
      await saveSmsDraft(owner, { ...envelope, to: remote, text: "Old draft" });
      await pool.query(
        "UPDATE sms_messages SET body_expires_at=now()-interval '1 day'",
      );
      await pool.query(
        "UPDATE sms_notes SET created_at=now()-interval '25 months'",
      );
      await pool.query(
        "UPDATE sms_drafts SET updated_at=now()-interval '91 days'",
      );
      expect((await selected(sent.conversationId!)).messages[0].text).toContain(
        "Expired message",
      );
      await pool.query("SELECT perform_reporting_retention()");
      expect(
        (await pool.query("SELECT body,body_removed_at FROM sms_messages"))
          .rows[0],
      ).toMatchObject({ body: "" });
      expect(await count("sms_drafts")).toBe(0);
      expect(await count("sms_notes")).toBe(0);
      expect(await count("sms_outbound_intents")).toBe(1);
    });
  },
);
