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
import {
  listConversationWorkspace,
  loadConversationSourceHistory,
} from "./data";
import {
  addConversationNote,
  linkConversationContext,
  markConversationRead,
  mergeConversations,
  saveConversationWork,
  ConversationInputError,
} from "./service";
import { ConversationAccessError } from "./access";
import { bindSentRecipient } from "./service";
import { getConversationRecipient, listConversationRecipients } from "./recipients";
import type { InboxMailbox, InboxMessage } from "@/lib/inbox/types";
vi.mock("server-only", () => ({}));
vi.mock('@/lib/voice-provider/config',()=>({getVoiceConfiguration:()=>({ready:false,webhookReady:false,enabled:false,missing:['TWILIO_VOICE_APP_SID'],phoneNumber:''})}));
const gateway = vi.hoisted(() => ({
  smsEnabled: true,
  mailboxes: vi.fn(),
  index: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/inbox/mail-provider", () => ({
  listMailboxes: gateway.mailboxes,
  listMailConversationIndex: gateway.index,
  getMailThreadHistory: gateway.history,
  MailProviderError: class extends Error {
    constructor(
      public state: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/twilio/config", () => ({
  getTwilioConfiguration: () => ({
    ready: true,
    enabled: gateway.smsEnabled,
    accountSid: "AC" + "1".repeat(32),
    phoneNumber: "+16785417725",
  }),
  getTwilioPublicConfiguration: () => ({
    ready: true,
    enabled: gateway.smsEnabled,
    phoneNumber: "+16785417725",
    incomingUrl: "",
    statusUrlTemplate: "",
  }),
}));
const databaseUrl = process.env.TEST_CONVERSATIONS_DATABASE_URL,
  workspace = "00000000-0000-4000-8000-000000000001",
  otherWorkspace = "00000000-0000-4000-8000-000000009852";
const ownerId = "conversation-owner",
  memberId = "conversation-member",
  smsOnlyId = "conversation-sms-only",
  viewerId = "conversation-viewer",
  otherId = "conversation-other";
function context(
  id = ownerId,
  ws = workspace,
  role: DashboardContext["role"] = "owner",
): DashboardContext {
  return {
    user: { id, name: id, email: `${id}@example.test` },
    workspace: { id: ws, name: "Fixture", slug: "fixture" },
    role,
  };
}
const owner = context(),
  member = context(memberId, workspace, "member"),
  smsOnly = context(smsOnlyId, workspace, "member"),
  viewer = context(viewerId, workspace, "viewer");
const mailbox: InboxMailbox = {
  id: "sales-address",
  name: "Sales",
  email: "sales@example.test",
  canSend: true,
  addresses: [{ id: "sales-address", address: "sales@example.test" }],
};
let pool: Pool,
  numberId: string,
  smsId: string,
  businessId: string,
  contactId: string,
  secondContactId: string;
let mailMessages: InboxMessage[] = [];
const base = new Date(Date.now() - 3600000).toISOString();
function message(
  id: string,
  text = "Provider body",
  at = base,
  direction: InboxMessage["direction"] = "inbound",
): InboxMessage {
  return {
    id,
    direction,
    from: direction === "inbound" ? "alice@example.test" : "sales@example.test",
    fromName: null,
    to: direction === "inbound" ? "sales@example.test" : "alice@example.test",
    cc: null,
    subject: "Website enquiry",
    text,
    deliveryStatus: direction === "inbound" ? "received" : "sent",
    deliveryDetail: null,
    createdAt: at,
    replyTargets: ["alice@example.test"],
    attachments: [],
  };
}
async function workspaceView(
  active = owner,
  extra: Record<string, string> = {},
) {
  return listConversationWorkspace(active, { view: "team", ...extra });
}
async function identities() {
  const view = await workspaceView();
  return {
    email: view.items.find((c) => c.channels.includes("email"))!,
    sms: view.items.find((c) => c.channels.includes("sms"))!,
  };
}
async function expireCheckpoint() {
  await pool.query(
    "UPDATE crm_conversation_sync SET last_completed_at=now()-interval '1 minute'",
  );
}
describe.skipIf(!databaseUrl)(
  "Unified conversations with guarded PostgreSQL and live-adapter fixtures",
  () => {
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.port !== "55433" ||
        url.pathname !== "/ta_conversations_test" ||
        url.search ||
        url.hash
      )
        throw new Error("Use exact isolated ta_conversations_test on55433.");
      vi.stubEnv("DATABASE_URL", databaseUrl!);
      pool = getDatabasePool();
      if (
        (await pool.query("SELECT current_database() AS name")).rows[0].name !==
        "ta_conversations_test"
      )
        throw new Error("Wrong database");
      await pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
      );
      for (const filename of (await readdir("db/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        if (
          (
            await pool.query(
              "SELECT 1 FROM schema_migrations WHERE filename=$1",
              [filename],
            )
          ).rowCount
        )
          continue;
        const db = await pool.connect();
        try {
          await db.query("BEGIN");
          await db.query(await readFile(`db/migrations/${filename}`, "utf8"));
          await db.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
            filename,
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
      gateway.smsEnabled = true;
      await pool.query(
        'TRUNCATE crm_conversations,crm_conversation_sync,sms_numbers,inbox_conversations,inbox_drafts,crm_channel_preferences,contacts,projects,clients,crm_businesses,leads,audit_logs,"user" CASCADE',
      );
      await pool.query("DELETE FROM workspaces WHERE id=$1", [otherWorkspace]);
      await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [
        workspace,
      ]);
      await pool.query(
        "INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'unified-other','Other','internal','active')",
        [otherWorkspace],
      );
      for (const [id, role, ws] of [
        [ownerId, "owner", workspace],
        [memberId, "member", workspace],
        [smsOnlyId, "member", workspace],
        [viewerId, "viewer", workspace],
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
      numberId = randomUUID();
      smsId = randomUUID();
      businessId = randomUUID();
      contactId = randomUUID();
      secondContactId = randomUUID();
      await pool.query(
        "INSERT INTO crm_businesses(id,workspace_id,name) VALUES($1,$2,'Shared company')",
        [businessId, workspace],
      );
      await pool.query(
        "INSERT INTO contacts(id,workspace_id,business_id,name,email,phone) VALUES($1,$2,$3,'Alice','alice@example.test','+12125550123'),($4,$2,$3,'Bob','bob@example.test','+12125550124')",
        [contactId, workspace, businessId, secondContactId],
      );
      await pool.query(
        "INSERT INTO sms_numbers(id,workspace_id,account_sid,provider_sid,phone) VALUES($1,$2,$3,$4,'+16785417725')",
        [numberId, workspace, "AC" + "1".repeat(32), "PN" + "2".repeat(32)],
      );
      for (const userId of [ownerId, memberId, smsOnlyId, viewerId])
        await pool.query(
          "INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send) VALUES($1,$2,$3,true)",
          [workspace, numberId, userId],
        );
      await pool.query(
        "INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone,business_id,owner_user_id) VALUES($1,$2,$3,'+12125550123',$4,$5)",
        [smsId, workspace, numberId, businessId, ownerId],
      );
      await pool.query(
        "INSERT INTO sms_messages(id,workspace_id,conversation_id,direction,body,status,status_rank,created_at) VALUES($1,$2,$3,'inbound','SMS from Alice','received',50,$4)",
        [randomUUID(), workspace, smsId, base],
      );
      vi.resetAllMocks();
      mailMessages = [message("mail-1")];
      gateway.mailboxes.mockImplementation(async (ctx: DashboardContext) =>
        ctx.user.id === smsOnlyId ? [] : [mailbox],
      );
      gateway.index.mockImplementation(async () => ({
        items: [
          {
            threadId: "mail-thread",
            latestMessageId: mailMessages.at(-1)!.id,
            lastMessageAt: mailMessages.at(-1)!.createdAt,
            lastInboundAt:
              [...mailMessages].reverse().find((m) => m.direction === "inbound")
                ?.createdAt ?? null,
            lastOutboundAt:
              [...mailMessages]
                .reverse()
                .find((m) => m.direction === "outbound")?.createdAt ?? null,
            externalAddresses: ["alice@example.test"],
            hasAttachments: false,
          },
        ],
        cursor: null,
        complete: true,
      }));
      gateway.history.mockImplementation(async () => ({
        threadId: "mail-thread",
        subject: "Website enquiry",
        messages: mailMessages,
        before: null,
        hasOlder: false,
      }));
    });

    it("finds contacts by name and formatted phone, without crossing workspaces", async () => {
      expect((await listConversationRecipients(owner, "Alice")).map(p=>p.id)).toEqual([contactId]);
      expect((await listConversationRecipients(owner, "(212) 555-0123")).map(p=>p.id)).toEqual([contactId]);
      expect(await getConversationRecipient(context(otherId, otherWorkspace), "contact", contactId)).toBeNull();
      expect(await getConversationRecipient(owner, "contact", "invalid")).toBeNull();
      await pool.query("UPDATE crm_businesses SET anonymized_at=now() WHERE id=$1",[businessId]);
      expect(await listConversationRecipients(owner, "Alice")).toEqual([]);
    });

    it("opens authorized existing history for a person and offers a fresh composer when none exists", async () => {
      const view = await workspaceView(smsOnly, {contact:contactId});
      expect(view.recipient?.name).toBe("Alice");
      expect(view.selected?.sources.map(s=>s.channel)).toEqual(["sms"]);
      expect(view.recipientConversations).toHaveLength(1);
      const fresh = await workspaceView(owner, {contact:secondContactId});
      expect(fresh.selected).toBeNull();
      expect(fresh.recipient?.email).toBe("bob@example.test");
      expect(fresh.recipientConversations).toEqual([]);
    });

    it("opens a lead with no business name and reuses its phone history", async () => {
      const leadId = randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,business_id,name,organization,email,phone,description) VALUES($1,$2,$3,'Alice Lead','','alice@example.test','(212) 555-0123','')",[leadId,workspace,businessId]);
      const view = await workspaceView(smsOnly, {lead:leadId});
      expect(view.recipient?.name).toBe("Alice Lead");
      expect(view.selected?.sources[0].smsConversationId).toBe(smsId);
      expect(view.links.leads.find(l=>l.id===leadId)?.name).toBe("Alice Lead");
    });

    it("binds accepted SMS to the selected CRM person and is idempotent", async () => {
      const form = new FormData();
      form.set("recipientKind","contact");form.set("recipientId",contactId);form.set("numberId",numberId);
      const id = await bindSentRecipient(owner,form,{channel:"sms",id:smsId});
      expect(await bindSentRecipient(owner,form,{channel:"sms",id:smsId})).toBe(id);
      const view = await workspaceView(owner,{contact:contactId});
      expect(view.selected?.conversation.contactId).toBe(contactId);
      expect(view.selected?.conversation.id).toBe(id);
      expect((await pool.query("SELECT count(*)::int n FROM crm_conversation_sources WHERE sms_conversation_id=$1",[smsId])).rows[0].n).toBe(1);
    });

    it("adds a new email source to the selected person's existing conversation", async () => {
      const smsForm = new FormData();smsForm.set("recipientKind","contact");smsForm.set("recipientId",contactId);smsForm.set("numberId",numberId);
      const id = await bindSentRecipient(owner,smsForm,{channel:"sms",id:smsId});
      const form = new FormData();form.set("recipientKind","contact");form.set("recipientId",contactId);form.set("mailboxId",mailbox.id);form.set("crmConversationId",id);
      mailMessages = [message("outgoing", "Hello", new Date().toISOString(), "outbound")];
      expect(await bindSentRecipient(owner,form,{channel:"email",id:"new-person-thread"})).toBe(id);
      expect((await pool.query("SELECT contact_id FROM crm_conversations WHERE id=$1",[id])).rows[0].contact_id).toBe(contactId);
      expect((await pool.query("SELECT channel FROM crm_conversation_sources WHERE conversation_id=$1 ORDER BY channel",[id])).rows.map(r=>r.channel)).toEqual(["email","sms"]);
    });

    it("rejects mismatched destinations, conflicting identities, viewers and revoked access", async () => {
      const form = new FormData();form.set("recipientKind","contact");form.set("recipientId",secondContactId);form.set("numberId",numberId);
      await expect(bindSentRecipient(owner,form,{channel:"sms",id:smsId})).rejects.toThrow(/destination/);
      form.set("recipientId",contactId);
      await expect(bindSentRecipient(viewer,form,{channel:"sms",id:smsId})).rejects.toThrow();
      const id = await bindSentRecipient(owner,form,{channel:"sms",id:smsId});
      await pool.query("UPDATE crm_conversations SET contact_id=$2 WHERE id=$1",[id,secondContactId]);
      await expect(bindSentRecipient(owner,form,{channel:"sms",id:smsId})).rejects.toThrow(/another CRM record/);
      const view = await workspaceView(smsOnly,{contact:contactId});
      expect(view.selected).toBeNull();
      await pool.query("DELETE FROM sms_number_grants WHERE user_id=$1",[ownerId]);
      await expect(bindSentRecipient(owner,form,{channel:"sms",id:smsId})).rejects.toThrow(/access/);
    });
    afterAll(async () => {
      await pool?.end();
      delete (globalThis as { tailoredAgentsDatabasePool?: Pool })
        .tailoredAgentsDatabasePool;
      vi.unstubAllEnvs();
    });
    it("explains a disabled SMS switch without misreporting an existing send grant", async () => {
      const ids = await identities();
      gateway.smsEnabled = false;
      const view = await workspaceView(owner, { conversation: ids.sms.id });
      const source = view.selected!.sources.find((s) => s.channel === "sms")!;
      expect(source.canSend).toBe(false);
      expect(source.number?.sendUnavailableReason).toContain("Outbound SMS is turned off");
      gateway.smsEnabled = true;
      const enabled = await workspaceView(owner, { conversation: ids.sms.id });
      expect(enabled.selected!.sources.find((s) => s.channel === "sms")!.number).toMatchObject({
        canSend: true, sendUnavailableReason: null,
      });
    });
    it("discovers independent channel histories without business-wide or guessed identity merges", async () => {
      const view = await listConversationWorkspace(owner);
      expect(view.view).toBe("team");
      expect(view.total).toBe(2);
      expect(view.items.every((c) => c.contactId === null)).toBe(true);
      expect(view.items.every((c) => c.sourceCount === 1)).toBe(true);
      expect(
        await pool
          .query("SELECT count(*)::int AS n FROM contacts")
          .then((r) => r.rows[0].n),
      ).toBe(2);
    });
    it("merges explicitly linked histories and orders live email, SMS and scoped notes together", async () => {
      const ids = await identities();
      await linkConversationContext(owner, {
        conversationId: ids.email.id,
        contactId,
        businessId,
      });
      await linkConversationContext(owner, {
        conversationId: ids.sms.id,
        contactId,
        businessId,
      });
      await mergeConversations(owner, {
        conversationId: ids.sms.id,
        targetConversationId: ids.email.id,
        confirmConflict: true,
      });
      let view = await workspaceView(owner, { conversation: ids.email.id });
      expect(view.total).toBe(1);
      expect(view.selected?.conversation.title).toBe("Alice");
      expect(view.selected?.sources).toHaveLength(2);
      expect(view.selected?.timeline.map((i) => i.channel).sort()).toEqual([
        "email",
        "sms",
      ]);
      const source = view.selected!.sources.find((s) => s.channel === "email")!;
      await addConversationNote(owner, {
        conversationId: ids.email.id,
        audienceSourceId: source.id,
        body: "Email readers only",
      });
      view = await workspaceView(owner, { conversation: ids.email.id });
      expect(view.selected?.timeline.at(-1)?.channel).toBe("note");
    });
    it("requires conflict confirmation and preserves destination context rather than silently picking an owner", async () => {
      const ids = await identities();
      await saveConversationWork(owner, {
        conversationId: ids.email.id,
        ownerId: memberId,
        status: "waiting",
      });
      await expect(
        mergeConversations(owner, {
          conversationId: ids.sms.id,
          targetConversationId: ids.email.id,
          confirmConflict: false,
        }),
      ).rejects.toBeInstanceOf(ConversationInputError);
      await mergeConversations(owner, {
        conversationId: ids.sms.id,
        targetConversationId: ids.email.id,
        confirmConflict: true,
      });
      expect(
        await mergeConversations(owner, {
          conversationId: ids.sms.id,
          targetConversationId: ids.email.id,
          confirmConflict: true,
        }),
      ).toBe(ids.email.id);
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.ownerId,
      ).toBe(memberId);
    });
    it("never widens legacy or new email notes to SMS-only readers after merge", async () => {
      const legacy = randomUUID();
      await pool.query(
        "INSERT INTO inbox_conversations(id,workspace_id,mailbox_id,thread_id) VALUES($1,$2,'sales-address','mail-thread')",
        [legacy, workspace],
      );
      await pool.query(
        "INSERT INTO inbox_notes(id,workspace_id,conversation_id,body) VALUES($1,$2,$3,$4)",
        [randomUUID(), workspace, legacy, "Private legacy email note"],
      );
      const ids = await identities();
      const initial = await workspaceView(owner, {
        conversation: ids.email.id,
      });
      const emailSource = initial.selected!.sources[0].id;
      await addConversationNote(owner, {
        conversationId: ids.email.id,
        audienceSourceId: emailSource,
        body: "Private new email note",
      });
      await mergeConversations(owner, {
        conversationId: ids.sms.id,
        targetConversationId: ids.email.id,
        confirmConflict: true,
      });
      const ownerView = await workspaceView(owner, {
        conversation: ids.email.id,
      });
      expect(JSON.stringify(ownerView.selected)).toContain(
        "Private legacy email note",
      );
      const limited = await workspaceView(smsOnly, {
        conversation: ids.email.id,
      });
      expect(limited.total).toBe(1);
      expect(limited.selected?.sources).toHaveLength(1);
      expect(JSON.stringify(limited)).not.toContain("Private legacy");
      expect(JSON.stringify(limited)).not.toContain("Private new");
      expect(limited.selected?.conversation.channels).toEqual(["sms"]);
    });
    it("filters hidden-source timestamps, search matches and unread state out of the shared queue", async () => {
      const ids = await identities();
      await mergeConversations(owner, {
        conversationId: ids.sms.id,
        targetConversationId: ids.email.id,
        confirmConflict: true,
      });
      await markConversationRead(smsOnly, { conversationId: ids.email.id });
      mailMessages.push(
        message(
          "mail-hidden",
          "Hidden latest content",
          new Date(Date.now() + 10000).toISOString(),
        ),
      );
      await expireCheckpoint();
      await workspaceView(owner, { conversation: ids.email.id });
      const limited = await workspaceView(smsOnly, {
        conversation: ids.email.id,
      });
      expect(limited.selected?.conversation.lastActivityAt).toBe(base);
      expect(limited.selected?.conversation.unread).toBe(false);
      expect(limited.selected?.conversation.preview).toBe("SMS from Alice");
      expect(
        (await workspaceView(smsOnly, { q: "alice@example.test" })).total,
      ).toBe(0);
    });
    it("denies forged viewers, suspended membership, cross-workspace IDs and unavailable-source mutations", async () => {
      const ids = await identities();
      await expect(
        addConversationNote(
          { ...viewer, role: "owner" },
          {
            conversationId: ids.email.id,
            audienceSourceId: (
              await workspaceView(owner, { conversation: ids.email.id })
            ).selected!.sources[0].id,
            body: "Blocked",
          },
        ),
      ).rejects.toThrow();
      await expect(
        saveConversationWork(context(otherId, otherWorkspace), {
          conversationId: ids.email.id,
          status: "done",
        }),
      ).rejects.toThrow();
      await mergeConversations(owner, {
        conversationId: ids.sms.id,
        targetConversationId: ids.email.id,
        confirmConflict: true,
      });
      await expect(
        saveConversationWork(smsOnly, {
          conversationId: ids.email.id,
          status: "done",
        }),
      ).rejects.toBeInstanceOf(ConversationAccessError);
      await pool.query(
        "UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",
        [memberId],
      );
      await expect(listConversationWorkspace(member)).rejects.toThrow();
    });
    it("keeps reads personal and does not treat a note as a customer response", async () => {
      const ids = await identities();
      const view = await workspaceView(owner, { conversation: ids.email.id });
      await markConversationRead(owner, { conversationId: ids.email.id });
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.unread,
      ).toBe(false);
      expect(
        (await workspaceView(member, { conversation: ids.email.id })).selected
          ?.conversation.unread,
      ).toBe(true);
      await addConversationNote(owner, {
        conversationId: ids.email.id,
        audienceSourceId: view.selected!.sources[0].id,
        body: "Internal work, no customer reply",
      });
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("needs_reply");
    });
    it("reopens done only for permitted customer activity and resolves an actual outbound reply to waiting immediately", async () => {
      const ids = await identities();
      await saveConversationWork(owner, {
        conversationId: ids.email.id,
        status: "done",
      });
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("done");
      mailMessages.push(
        message(
          "new-inbound",
          "Customer replied",
          new Date(Date.now() + 1000).toISOString(),
        ),
      );
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("needs_reply");
      mailMessages.push(
        message(
          "new-outbound",
          "Actual reply",
          new Date(Date.now() + 2000).toISOString(),
          "outbound",
        ),
      );
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("waiting");
    });
    it("surfaces only deliberate due reminders and clears them when work is done", async () => {
      const ids = await identities();
      expect((await workspaceView(owner, { view: "due" })).total).toBe(0);
      await saveConversationWork(owner, {
        conversationId: ids.email.id,
        status: "needs_reply",
        remindAt: new Date(Date.now() + 3600000).toISOString(),
      });
      expect((await workspaceView(owner, { view: "reminders" })).total).toBe(1);
      expect((await workspaceView(owner, { view: "due" })).total).toBe(0);
      await pool.query(
        "UPDATE crm_conversations SET remind_at=now()-interval '1 minute' WHERE id=$1",
        [ids.email.id],
      );
      expect((await workspaceView(owner, { view: "due" })).total).toBe(1);
      await saveConversationWork(owner, {
        conversationId: ids.email.id,
        status: "done",
      });
      expect((await workspaceView(owner, { view: "due" })).total).toBe(0);
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.remindAt,
      ).toBeNull();
    });
    it("does not resolve reply work for a failed or uncertain outbound email", async () => {
      const ids = await identities();
      const failed = message(
        "failed-outbound",
        "Failed response",
        new Date(Date.now() + 1000).toISOString(),
        "outbound",
      );
      failed.deliveryStatus = "failed";
      mailMessages.push(failed);
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("needs_reply");
      mailMessages[mailMessages.length - 1] = {
        ...failed,
        deliveryStatus: "unknown",
      };
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("needs_reply");
    });
    it("keeps sources during incomplete sweeps and tombstones unseen threads only on completed sweeps", async () => {
      await identities();
      await expireCheckpoint();
      gateway.index.mockResolvedValueOnce({
        items: [],
        cursor: "opaque-next",
        complete: false,
      });
      const partial = await workspaceView();
      expect(partial.total).toBe(2);
      expect(partial.sync.some((s) => s.state === "syncing")).toBe(true);
      gateway.index.mockResolvedValueOnce({
        items: [],
        cursor: null,
        complete: true,
      });
      expect((await workspaceView()).total).toBe(1);
    });
    it("hides stale Mail metadata during provider failure instead of claiming a complete empty inbox", async () => {
      const ids = await identities();
      await expireCheckpoint();
      gateway.index.mockRejectedValueOnce(new Error("Provider unavailable"));
      const view = await workspaceView(owner, { conversation: ids.email.id });
      expect(view.total).toBe(1);
      expect(view.selected).toBeNull();
      expect(view.sync.some((s) => s.state === "unavailable")).toBe(true);
    });
    it("paginates the complete indexed queue beyond one provider page and scopes metadata search", async () => {
      const items = Array.from({ length: 60 }, (_, i) => ({
        threadId: `thread-${i}`,
        latestMessageId: `message-${i}`,
        lastMessageAt: new Date(Date.parse(base) + i * 1000).toISOString(),
        lastInboundAt: base,
        lastOutboundAt: null,
        externalAddresses: [`person${i}@example.test`],
        hasAttachments: false,
      }));
      gateway.index.mockResolvedValueOnce({
        items: items.slice(0, 30),
        cursor: "next-page",
        complete: false,
      });
      let view = await workspaceView();
      expect(view.total).toBe(31);
      gateway.index.mockResolvedValueOnce({
        items: items.slice(30),
        cursor: null,
        complete: true,
      });
      view = await workspaceView(owner, { page: "3" });
      expect(view.total).toBe(61);
      expect(view.items).toHaveLength(11);
      expect(
        (await workspaceView(owner, { q: "person59@example.test" })).total,
      ).toBe(1);
    });
    it("supports authorized older history and denies a revoked source even with its opaque cursor", async () => {
      const ids = await identities();
      const source = (
        await workspaceView(owner, { conversation: ids.email.id })
      ).selected!.sources[0];
      gateway.history.mockResolvedValueOnce({
        threadId: "mail-thread",
        subject: "Old",
        messages: [message("old", "Earlier message")],
        hasOlder: false,
        before: null,
      });
      expect(
        (
          await loadConversationSourceHistory(owner, {
            sourceId: source.id,
            before: "opaque",
          })
        ).items[0].text,
      ).toBe("Earlier message");
      await expect(
        loadConversationSourceHistory(smsOnly, {
          sourceId: source.id,
          before: "opaque",
        }),
      ).rejects.toBeInstanceOf(ConversationAccessError);
    });
    it("never assigns another contact at the same business implicitly and validates selected context", async () => {
      const ids = await identities();
      await linkConversationContext(owner, {
        conversationId: ids.email.id,
        contactId: secondContactId,
        businessId,
      });
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.title,
      ).toBe("Bob");
      expect(
        (await workspaceView(owner, { conversation: ids.sms.id })).selected
          ?.conversation.contactId,
      ).toBeNull();
      await expect(
        linkConversationContext(owner, {
          conversationId: ids.email.id,
          contactId,
          businessId: randomUUID(),
        }),
      ).rejects.toBeInstanceOf(ConversationInputError);
    });
    it("recomputes an indexed successful email when its delivery later fails", async () => {
      const ids = await identities();
      mailMessages.push(
        message(
          "outbound-later-failed",
          "Actual send",
          new Date(Date.now() + 1000).toISOString(),
          "outbound",
        ),
      );
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("waiting");
      mailMessages[mailMessages.length - 1].deliveryStatus = "failed";
      expect(
        (await workspaceView(owner, { conversation: ids.email.id })).selected
          ?.conversation.status,
      ).toBe("needs_reply");
    });
    it("rotates bounded discovery across more than three approved addresses", async () => {
      const mailboxes = Array.from({ length: 5 }, (_, i) => ({
        ...mailbox,
        id: `address-${i}`,
        email: `address${i}@example.test`,
      }));
      gateway.mailboxes.mockResolvedValue(mailboxes);
      await workspaceView();
      expect(gateway.index).toHaveBeenCalledTimes(3);
      await workspaceView();
      expect(
        new Set(gateway.index.mock.calls.map((args) => args[1])).size,
      ).toBe(5);
      expect((await workspaceView()).total).toBe(6);
    });
    it("allows a real relationship beyond twenty provider threads and pages its authorized histories", async () => {
      gateway.index.mockResolvedValue({
        items: Array.from({ length: 20 }, (_, i) => ({
          threadId: `history-${i}`,
          latestMessageId: `latest-${i}`,
          lastMessageAt: base,
          lastInboundAt: base,
          lastOutboundAt: null,
          externalAddresses: ["alice@example.test"],
          hasAttachments: false,
        })),
        cursor: null,
        complete: true,
      });
      const view = await workspaceView(),
        target = view.items.find((c) => c.channels.includes("email"))!,
        sms = view.items.find((c) => c.channels.includes("sms"))!;
      await pool.query(
        "UPDATE crm_conversation_sources SET conversation_id=$2 WHERE workspace_id=$1 AND channel='email'",
        [workspace, target.id],
      );
      await mergeConversations(owner, {
        conversationId: sms.id,
        targetConversationId: target.id,
        confirmConflict: true,
      });
      const first = (await workspaceView(owner, { conversation: target.id }))
          .selected!,
        second = (
          await listConversationWorkspace(owner, {
            view: "team",
            conversation: target.id,
            sourcePage: "2",
          })
        ).selected!;
      expect(first.historyTotal).toBe(21);
      expect(first.historyPages).toBe(2);
      expect(first.sources).toHaveLength(20);
      expect(second.historyPage).toBe(2);
      expect(second.sources).toHaveLength(1);
      expect(
        new Set([...first.sources, ...second.sources].map((s) => s.id)).size,
      ).toBe(21);
    });
    it("rechecks all-source authority after waiting for the mutation lock", async () => {
      const ids = await identities(),
        lock = await pool.connect();
      await lock.query("BEGIN");
      await lock.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `unified-work:${workspace}`,
      ]);
      const queued = saveConversationWork(smsOnly, {
        conversationId: ids.sms.id,
        status: "done",
      });
      try {
        await vi.waitFor(async () =>
          expect(
            (
              await pool.query(
                "SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database() AND l.locktype='advisory' AND NOT l.granted",
              )
            ).rowCount,
          ).toBeGreaterThan(0),
        );
        await lock.query(
          "UPDATE crm_conversation_sources SET conversation_id=$3 WHERE workspace_id=$1 AND conversation_id=$2",
          [workspace, ids.email.id, ids.sms.id],
        );
        await lock.query(
          "UPDATE crm_conversations SET merged_into_id=$3 WHERE workspace_id=$1 AND id=$2",
          [workspace, ids.email.id, ids.sms.id],
        );
        await lock.query("COMMIT");
        await expect(queued).rejects.toBeInstanceOf(ConversationAccessError);
        expect(
          (
            await pool.query(
              "SELECT status FROM crm_conversations WHERE id=$1",
              [ids.sms.id],
            )
          ).rows[0].status,
        ).not.toBe("done");
      } finally {
        await lock.query("ROLLBACK");
        lock.release();
      }
    });
    it("reports a final grant-check outage while hiding previously loaded Mail content", async () => {
      const ids = await identities();
      gateway.mailboxes
        .mockResolvedValueOnce([mailbox])
        .mockRejectedValueOnce(
          new Error("Mail unavailable during final check"),
        );
      const view = await workspaceView(owner, { conversation: ids.email.id });
      expect(view.selected).toBeNull();
      expect(view.total).toBe(1);
      expect(
        view.sync.some(
          (s) => s.channel === "email" && s.state === "unavailable",
        ),
      ).toBe(true);
      expect(
        view.sync.some((s) => s.channel === "email" && s.state === "ready"),
      ).toBe(false);
    });
    it("stops later Mail hydration batches after an address fails while preserving SMS history", async () => {
      gateway.index.mockResolvedValue({
        items: Array.from({ length: 20 }, (_, i) => ({
          threadId: `bounded-${i}`,
          latestMessageId: `bounded-message-${i}`,
          lastMessageAt: base,
          lastInboundAt: base,
          lastOutboundAt: null,
          externalAddresses: ["alice@example.test"],
          hasAttachments: false,
        })),
        cursor: null,
        complete: true,
      });
      const initial = await workspaceView(),
        target = initial.items.find((c) => c.channels.includes("sms"))!;
      await pool.query(
        "UPDATE crm_conversation_sources SET conversation_id=$2 WHERE workspace_id=$1 AND channel='email'",
        [workspace, target.id],
      );
      await pool.query(
        "UPDATE sms_messages SET created_at=now() WHERE workspace_id=$1 AND conversation_id=$2",
        [workspace, smsId],
      );
      gateway.history.mockClear();
      gateway.history.mockRejectedValue(
        new Error("Address temporarily unavailable"),
      );
      const view = await workspaceView(owner, { conversation: target.id });
      expect(gateway.history.mock.calls.length).toBeGreaterThan(0);
      expect(gateway.history.mock.calls.length).toBeLessThanOrEqual(3);
      expect(view.selected?.conversation.channels).toEqual(["sms"]);
      expect(
        view.selected?.timeline.some(
          (item) => item.channel === "sms" && item.text === "SMS from Alice",
        ),
      ).toBe(true);
      expect(
        view.sync.some(
          (item) => item.channel === "email" && item.state === "unavailable",
        ),
      ).toBe(true);
    });
    it("expires source-scoped notes before display and deletes them through existing retention", async () => {
      const ids = await identities();
      const source = (
        await workspaceView(owner, { conversation: ids.email.id })
      ).selected!.sources[0];
      await addConversationNote(owner, {
        conversationId: ids.email.id,
        audienceSourceId: source.id,
        body: "Expired scoped note",
      });
      await pool.query(
        "UPDATE crm_conversation_notes SET created_at=now()-interval '25 months'",
      );
      expect(
        JSON.stringify(
          (await workspaceView(owner, { conversation: ids.email.id })).selected,
        ),
      ).not.toContain("Expired scoped note");
      await pool.query("SELECT perform_reporting_retention()");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM crm_conversation_notes",
          )
        ).rows[0].n,
      ).toBe(0);
    });
  },
);
