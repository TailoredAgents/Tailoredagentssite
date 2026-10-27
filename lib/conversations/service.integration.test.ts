import { savePhoneNumber } from "./phone-numbers";
import { recipientMatchesAddress } from "./recipients";
import { linkInquiry, convertOpportunity } from "@/lib/sales/service";
import { saveSmsDraft } from "@/lib/sms/service";
import { deleteLead } from "@/lib/operations/delete-lead";
import { loadClientMemory, saveClientMemory, rememberSuggestions, memoryEvidence } from "./memory";
import { generateClientDraft } from "./draft-service";
import { reserveDraftRequest } from "./draft-rate-limit";
import { writeSuggestedDraft } from "./draft-provider";
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
vi.mock("./draft-provider", async importOriginal => ({ ...await importOriginal<typeof import("./draft-provider")>(), writeSuggestedDraft: vi.fn() }));
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
function indexedEmail(threadId: string, addresses: string[]) {
  return {threadId,latestMessageId:`${threadId}-message`,lastMessageAt:base,lastInboundAt:base,lastOutboundAt:null,externalAddresses:addresses,hasAttachments:false};
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
      vi.stubEnv("OPENAI_API_KEY", "synthetic-drafts-only");
      vi.stubEnv("CRM_AI_DRAFTS_ENABLED", "true");
      await pool.query("DELETE FROM request_rate_limits WHERE scope LIKE 'crm-ai-draft-%'");
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
      vi.mocked(writeSuggestedDraft).mockResolvedValue({ memories: [], subject: "Your website", text: "Hi Alice, what would you like your website to do?" });
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

    it("indexes only exact CRM email matches and leaves general Mail out of every queue", async () => {
      const lead=randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email) VALUES($1,$2,'New Lead','','  LEAD@example.test  ')",[lead,workspace]);
      await pool.query("UPDATE crm_businesses SET normalized_email='office@customer.test' WHERE id=$1",[businessId]);
      gateway.index.mockResolvedValue({items:[
        indexedEmail("contact-mail",["ALICE@example.test"]),
        indexedEmail("lead-mail",["lead@example.test"]),
        indexedEmail("business-mail",["office@customer.test"]),
        indexedEmail("newsletter",["news@example.test"]),
        indexedEmail("same-domain",["sales@customer.test"]),
        indexedEmail("internal",[]),
      ],cursor:null,complete:true});
      const view=await workspaceView();
      expect(view.total).toBe(4); // three customer emails and the existing SMS
      expect(view.counts.unread).toBe(4);expect(view.counts.needs_reply).toBe(4);
      expect((await pool.query("SELECT thread_id FROM crm_conversation_sources WHERE channel='email' ORDER BY thread_id")).rows.map(r=>r.thread_id)).toEqual(["business-mail","contact-mail","lead-mail"]);
      expect((await workspaceView(owner,{q:"news@example.test"})).total).toBe(0);
      expect(gateway.history).not.toHaveBeenCalled();
    });
    it("hides previously indexed general mail immediately, including direct history access, without deleting data", async () => {
      const ids=await identities(),source=(await workspaceView(owner,{conversation:ids.email.id})).selected!.sources[0];
      await pool.query("UPDATE contacts SET email='changed@example.test' WHERE id=$1",[contactId]);
      gateway.history.mockClear();
      for(const view of ["team","mine","unassigned","needs_reply","unread","archived"]){
        const result=await listConversationWorkspace(owner,{view,conversation:ids.email.id});
        expect(result.items.some(c=>c.id===ids.email.id)).toBe(false);expect(result.selected).toBeNull();
      }
      expect((await workspaceView()).total).toBe(1);
      await expect(loadConversationSourceHistory(owner,{sourceId:source.id})).rejects.toBeInstanceOf(ConversationAccessError);
      expect(gateway.history).not.toHaveBeenCalled();
      expect((await pool.query("SELECT id FROM crm_conversation_sources WHERE id=$1",[source.id])).rowCount).toBe(1);
      // A later saved CRM address makes existing metadata eligible without a new sweep.
      await pool.query("UPDATE contacts SET email='alice@example.test' WHERE id=$1",[contactId]);
      expect((await workspaceView()).items.some(c=>c.id===ids.email.id)).toBe(true);
    });
    it("discovers previously skipped email after its sender becomes a lead and never infers a duplicate identity", async () => {
      gateway.index.mockResolvedValue({items:[indexedEmail("new-sender",["new@example.test"])],cursor:null,complete:true});
      expect((await workspaceView()).total).toBe(1);
      for(const name of ["First candidate","Second candidate"])await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email) VALUES($1,$2,$3,'','new@example.test')",[randomUUID(),workspace,name]);
      await expireCheckpoint();
      const mail=(await workspaceView()).items.find(c=>c.channels.includes("email"))!;
      expect(mail).toBeDefined();expect(mail.leadId).toBeNull();expect(mail.contactId).toBeNull();
      expect(mail.personName).toBe("new@example.test");
    });
    it("keeps explicit CRM and legacy links even when the sender uses another email", async () => {
      const ids=await identities();
      await linkConversationContext(owner,{conversationId:ids.email.id,contactId,businessId});
      await pool.query("UPDATE contacts SET email='new-address@example.test' WHERE id=$1",[contactId]);
      expect((await workspaceView()).items.some(c=>c.id===ids.email.id)).toBe(true);
      await pool.query("INSERT INTO inbox_conversations(id,workspace_id,mailbox_id,thread_id,business_id) VALUES($1,$2,$3,'legacy-linked',$4)",[randomUUID(),workspace,mailbox.id,businessId]);
      await expireCheckpoint();
      gateway.index.mockResolvedValue({items:[indexedEmail("legacy-linked",["alternate@unknown.test"])],cursor:null,complete:true});
      const view=await workspaceView();
      expect(view.items.some(c=>c.channels.includes("email")&&c.businessId===businessId)).toBe(true);
      await pool.query("UPDATE crm_businesses SET anonymized_at=now() WHERE id=$1",[businessId]);
      expect((await workspaceView()).items.some(c=>c.channels.includes("email"))).toBe(false);
    });
    it("does not match another workspace or a deleted lead, and continues past pages of general mail", async () => {
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email) VALUES($1,$2,'Other workspace','','foreign@example.test')",[randomUUID(),otherWorkspace]);
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email,anonymized_at) VALUES($1,$2,'Removed','','removed@example.test',now())",[randomUUID(),workspace]);
      gateway.index.mockResolvedValueOnce({items:[indexedEmail("foreign",["foreign@example.test"]),indexedEmail("removed",["removed@example.test"]),indexedEmail("news",["news@example.test"])],cursor:"next-customer-page",complete:false});
      expect((await workspaceView()).total).toBe(1);
      gateway.index.mockResolvedValueOnce({items:[indexedEmail("real-customer",["alice@example.test"])],cursor:null,complete:true});
      expect((await workspaceView()).total).toBe(2);
      expect(gateway.index.mock.calls.at(-1)![2].cursor).toBe("next-customer-page");
      expect((await pool.query("SELECT thread_id FROM crm_conversation_sources WHERE channel='email'")).rows.map(r=>r.thread_id)).toEqual(["real-customer"]);
    });
    it("rechecks the CRM relationship after loading email history", async () => {
      const ids=await identities();
      gateway.history.mockImplementationOnce(async()=>{
        await pool.query("UPDATE contacts SET email='changed@example.test' WHERE id=$1",[contactId]);
        return {threadId:"mail-thread",subject:"Website enquiry",messages:mailMessages,before:null,hasOlder:false};
      });
      const view=await workspaceView(owner,{conversation:ids.email.id});
      expect(view.selected).toBeNull();expect(view.total).toBe(1);
    });
    it("saves labeled alternate numbers, keeps primary, normalizes duplicates and enforces current access", async () => {
      const input={kind:"contact",id:contactId,operation:"save",phone:"4045550199",label:"Website",source:"Contact page"};
      await savePhoneNumber(owner,input);
      await savePhoneNumber(owner,{...input,phone:"(404) 555-0199",label:"Office"});
      const recipient=(await getConversationRecipient(owner,"contact",contactId))!;
      expect(recipient.phone).toBe("+12125550123");
      expect(recipient.alternatePhones).toEqual([{phone:"+14045550199",label:"Office",source:"Contact page"}]);
      expect(recipientMatchesAddress(recipient,"4045550199")).toBe(true);
      expect((await listConversationRecipients(owner,"(404) 555-0199")).map(p=>p.id)).toEqual([contactId]);
      await expect(savePhoneNumber(viewer,input)).rejects.toThrow("access");
      await expect(savePhoneNumber(context(otherId,otherWorkspace),input)).rejects.toThrow("workspace");
      await expect(savePhoneNumber(owner,{...input,phone:"2125550123"})).rejects.toThrow("primary");
      await expect(savePhoneNumber(owner,{...input,phone:"4045550199 ext 3"})).rejects.toThrow();
      await pool.query("UPDATE workspace_memberships SET role='viewer' WHERE workspace_id=$1 AND user_id=$2",[workspace,ownerId]);
      await expect(savePhoneNumber(owner,input)).rejects.toThrow("access");
    });
    it("connects new texts from a saved alternate only when the person is unambiguous", async () => {
      const {email}=await identities();
      await linkConversationContext(owner,{conversationId:email.id,contactId,businessId});
      const input={kind:"contact",id:contactId,operation:"save",phone:"4045550199",label:"Website"};
      await savePhoneNumber(owner,input);
      const suggested=await generateClientDraft(owner,{channel:"sms",accountId:numberId,to:"4045550199",conversationId:email.id,recipient:{kind:"contact",id:contactId},direction:"Try their website number"});
      expect(suggested.draft.text).toContain("Alice");
      const altId=randomUUID();
      await pool.query("INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone) VALUES($1,$2,$3,'+14045550199')",[altId,workspace,numberId]);
      await workspaceView();
      expect((await pool.query("SELECT conversation_id FROM crm_conversation_sources WHERE sms_conversation_id=$1",[altId])).rows[0].conversation_id).toBe(email.id);
      await savePhoneNumber(owner,{...input,id:secondContactId,phone:"4045550198"});
      await savePhoneNumber(owner,{...input,phone:"4045550198"});
      const shared=randomUUID();
      await pool.query("INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone) VALUES($1,$2,$3,'+14045550198')",[shared,workspace,numberId]);
      await workspaceView();
      const row=(await pool.query("SELECT c.* FROM crm_conversations c JOIN crm_conversation_sources s ON s.conversation_id=c.id WHERE s.sms_conversation_id=$1",[shared])).rows[0];
      expect(row.contact_id).toBeNull();expect(row.id).not.toBe(email.id);
      await savePhoneNumber(owner,{...input,operation:"remove"});
      expect((await pool.query("SELECT conversation_id FROM crm_conversation_sources WHERE sms_conversation_id=$1",[altId])).rows[0].conversation_id).toBe(email.id);
    });
    it("keeps per-number drafts separate and carries alternate numbers through lead conversion", async () => {
      const lead=randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,submission_id,source,name,organization,phone,email) VALUES($1,$2,$1::uuid::text,'manual','New Person','New Company','+14045550110','new@example.test')",[lead,workspace]);
      const input={kind:"lead",id:lead,operation:"save",phone:"4045550111",label:"Website",source:"Website contact page"};
      await savePhoneNumber(owner,input);
      const key=`lead:${lead}`;
      await saveSmsDraft(owner,{numberId,composeKey:key,to:"+14045550110",text:"Original draft"});
      await saveSmsDraft(owner,{numberId,composeKey:`${key}:+14045550111`,to:"+14045550111",text:"Website draft"});
      const data=await listConversationWorkspace(owner,{lead});
      expect(data.recipientDrafts.sms[numberId].text).toBe("Original draft");
      expect(data.recipientDrafts.sms[`${numberId}:+14045550111`].text).toBe("Website draft");
      const opportunityId=await linkInquiry(owner,lead);
      await savePhoneNumber(owner,{...input,phone:"4045550112",label:"Office"});
      await convertOpportunity(owner,{opportunityId,projectName:"New project",createSite:false});
      const contact=(await pool.query("SELECT c.* FROM contacts c JOIN crm_opportunities o ON o.primary_contact_id=c.id WHERE o.id=$1",[opportunityId])).rows[0];
      expect(contact.alternate_phones).toHaveLength(2);expect(contact.phone).toBe("+14045550110");
      await deleteLead(owner,{leadId:lead,confirmed:"yes"});
      expect((await pool.query("SELECT 1 FROM sms_drafts WHERE starts_with(thread_key,$1)",[key])).rowCount).toBe(0);
      expect((await pool.query("SELECT alternate_phones FROM contacts WHERE id=$1",[contact.id])).rows[0].alternate_phones).toHaveLength(2);
    });
    it("erases alternate numbers on anonymization",async()=>{
      await savePhoneNumber(owner,{kind:"contact",id:contactId,operation:"save",phone:"4045550199",label:"Website"});
      await pool.query("UPDATE crm_businesses SET anonymized_at=now() WHERE id=$1",[businessId]);
      expect((await pool.query("SELECT alternate_phones FROM contacts WHERE id=$1",[contactId])).rows[0].alternate_phones).toEqual([]);
    });

    it("opens text-alert links only into an authorized live SMS conversation",async()=>{
      const opened=await listConversationWorkspace(owner,{text:smsId});
      expect(opened.selected?.sources.some(s=>s.smsConversationId===smsId)).toBe(true);
      await pool.query("DELETE FROM sms_number_grants WHERE workspace_id=$1 AND user_id=$2",[workspace,ownerId]);
      expect((await listConversationWorkspace(owner,{text:smsId})).selected).toBeNull();
      expect((await listConversationWorkspace(owner,{text:randomUUID()})).selected).toBeNull();
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
      await pool.query("INSERT INTO contacts(id,workspace_id,business_id,name,email) SELECT gen_random_uuid(),$1,$2,'Customer '||n,'person'||n||'@example.test' FROM generate_series(0,59) n",[workspace,businessId]);
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

    it("drafts from client facts and only permitted history, excluding internal notes", async () => {
      const ids = await identities();
      await mergeConversations(owner, { conversationId: ids.email.id, targetConversationId: ids.sms.id, confirmConflict: true });
      const result = await generateClientDraft(smsOnly, { channel: "sms", accountId: numberId, to: "2125550123", threadId: smsId, direction: "Ask about their first website" });
      expect(result.draft.text).toContain("Alice");
      const supplied = JSON.stringify(vi.mocked(writeSuggestedDraft).mock.calls[0][1]);
      expect(supplied).toContain("SMS from Alice");
      expect(supplied).not.toContain("Provider body");
      expect(supplied).not.toContain("legacy note");
      expect(supplied).toContain("Ask about their first website");
    });
    it("rejects viewers, foreign accounts, mismatched recipients and changed grants before generating", async () => {
      const input = { channel: "sms", accountId: numberId, to: "2125550123", threadId: smsId };
      await expect(generateClientDraft(viewer, input)).rejects.toThrow();
      await expect(generateClientDraft(context(otherId, otherWorkspace), input)).rejects.toThrow();
      await expect(generateClientDraft(owner, { ...input, to: "21255550199" })).rejects.toThrow();
      await expect(generateClientDraft(owner, { ...input, recipient: {kind:"contact",id:secondContactId} })).rejects.toThrow();
      await pool.query("UPDATE sms_number_grants SET can_send=false WHERE user_id=$1", [ownerId]);
      await expect(generateClientDraft(owner, input)).rejects.toThrow();
      expect(writeSuggestedDraft).not.toHaveBeenCalled();
    });
    it("discards generated content when source access is revoked while AI runs", async () => {
      vi.mocked(writeSuggestedDraft).mockImplementationOnce(async () => {
        await pool.query("DELETE FROM sms_number_grants WHERE user_id=$1", [ownerId]);
        return { subject: "", text: "Private derived content", memories: [] };
      });
      await expect(generateClientDraft(owner, {channel:"sms",accountId:numberId,to:"2125550123",threadId:smsId})).rejects.toThrow();
      expect(writeSuggestedDraft).toHaveBeenCalledOnce();
    });
    it("hides a draft when a different channel used in its context loses access", async () => {
      const ids = await identities();
      await mergeConversations(owner, {conversationId:ids.email.id,targetConversationId:ids.sms.id,confirmConflict:true});
      vi.mocked(writeSuggestedDraft).mockImplementationOnce(async () => {
        gateway.mailboxes.mockResolvedValue([]);
        return {subject:"",text:"Derived from email while replying by SMS",memories:[]};
      });
      await expect(generateClientDraft(owner, {channel:"sms",accountId:numberId,to:"2125550123",threadId:smsId})).rejects.toThrow("Conversation access changed");
      expect(writeSuggestedDraft).toHaveBeenCalledOnce();
    });
    it("uses new lead inquiry details without requiring conversation history", async () => {
      const lead = randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email,phone,interest,description) VALUES($1,$2,'New Person','','new@example.test','+12125550199','First website','Need appointment booking')", [lead,workspace]);
      const result = await generateClientDraft(owner, {channel:"sms",accountId:numberId,to:"2125550199",recipient:{kind:"lead",id:lead}});
      expect(result.contextNote).toContain("no conversation history");
      const supplied = JSON.stringify(vi.mocked(writeSuggestedDraft).mock.calls[0][1]);
      expect(supplied).toContain("First website"); expect(supplied).toContain("Need appointment booking");
    });
    it("keeps source-scoped memory private, editable and independent of recent history", async () => {
      const ids=await identities();
      const source=(await workspaceView(owner,{conversation:ids.email.id})).selected!.sources[0];
      await saveClientMemory(owner,{sourceId:source.id,category:"preference",text:"Prefers a short agenda before meetings.",useInDrafts:true});
      await mergeConversations(owner,{conversationId:ids.email.id,targetConversationId:ids.sms.id,confirmConflict:true});
      const facts=await loadClientMemory(owner,ids.sms.id);expect(facts).toHaveLength(1);
      expect(await loadClientMemory(smsOnly,ids.sms.id)).toEqual([]);
      const fact=facts[0];
      await saveClientMemory(owner,{sourceId:source.id,id:fact.id,revision:fact.revision,category:"preference",text:"Prefers written agendas.",useInDrafts:false});
      await expect(saveClientMemory(member,{sourceId:source.id,id:fact.id,revision:fact.revision,category:"preference",text:"Stale edit",useInDrafts:true})).rejects.toThrow("another session");
      await generateClientDraft(owner,{channel:"sms",accountId:numberId,to:"2125550123",threadId:smsId});
      expect(JSON.stringify(vi.mocked(writeSuggestedDraft).mock.calls.at(-1)![1])).not.toContain("Prefers written agendas");
      await expect(saveClientMemory(viewer,{sourceId:source.id,category:"context",text:"No viewer writes",useInDrafts:true})).rejects.toThrow();
      await expect(saveClientMemory(context(otherId,otherWorkspace),{sourceId:source.id,category:"context",text:"Foreign workspace",useInDrafts:true})).rejects.toThrow();
    });
    it("saves only grounded suggestions and preserves corrections and removals across retries",async()=>{
      const ids=await identities(),record=(await workspaceView(owner,{conversation:ids.sms.id})).selected!;
      const evidence=memoryEvidence(record),entry=evidence.find(e=>e.text.includes("SMS from Alice"))!;
      const fact={evidenceId:entry.id,category:"context",text:"Alice sent a text.",quote:"SMS from Alice"};
      await rememberSuggestions(owner,evidence,[{...fact,quote:"An invented quotation"},{...fact,evidenceId:"forged"},fact]);
      let saved=await loadClientMemory(owner,record.conversation.id);expect(saved).toHaveLength(1);
      await saveClientMemory(owner,{id:saved[0].id,revision:saved[0].revision,sourceId:entry.sourceId,category:"context",text:"Corrected by team",useInDrafts:true});
      await rememberSuggestions(owner,evidence,[fact]);saved=await loadClientMemory(owner,record.conversation.id);
      expect(saved[0].text).toBe("Corrected by team");
      await saveClientMemory(owner,{id:saved[0].id,revision:saved[0].revision,sourceId:entry.sourceId,category:"context",text:saved[0].text,useInDrafts:true,dismiss:true});
      await rememberSuggestions(owner,evidence,[fact]);expect(await loadClientMemory(owner,record.conversation.id)).toEqual([]);
      const tombstone=(await pool.query("SELECT body,quote,dismissed FROM crm_client_memory")).rows[0];expect(tombstone).toEqual({body:"",quote:"",dismissed:true});
    });
    it("feeds saved client context into drafts and stores new facts from the same AI request",async()=>{
      const ids=await identities(),record=(await workspaceView(owner,{conversation:ids.sms.id})).selected!;
      const source=record.sources[0],evidence=memoryEvidence(record)[0];
      await saveClientMemory(owner,{sourceId:source.id,category:"preference",text:"Always include a meeting agenda",useInDrafts:true});
      vi.mocked(writeSuggestedDraft).mockResolvedValueOnce({subject:"",text:"Here is an agenda, Alice.",memories:[{category:"context",text:"Alice sent a text",quote:evidence.text,evidenceId:evidence.id}]});
      await generateClientDraft(owner,{channel:"sms",accountId:numberId,to:"2125550123",threadId:smsId});
      expect(JSON.stringify(vi.mocked(writeSuggestedDraft).mock.calls[0][1])).toContain("Always include a meeting agenda");
      expect(await loadClientMemory(owner,record.conversation.id)).toHaveLength(2);
      expect(writeSuggestedDraft).toHaveBeenCalledOnce();
    });
    it("discards drafts if saved memory is corrected or its separate source loses access during generation",async()=>{
      const ids=await identities();
      // Deliberately separate threads, linked to one person.
      await pool.query("UPDATE crm_conversations SET contact_id=$2 WHERE workspace_id=$1",[workspace,contactId]);
      const source=(await workspaceView(owner,{conversation:ids.email.id})).selected!.sources[0];
      await saveClientMemory(owner,{sourceId:source.id,category:"context",text:"Email-only project detail",useInDrafts:true});
      vi.mocked(writeSuggestedDraft).mockImplementationOnce(async()=>{gateway.mailboxes.mockResolvedValue([]);return{subject:"",text:"Must not expose email detail",memories:[]};});
      await expect(generateClientDraft(owner,{channel:"sms",accountId:numberId,to:"2125550123",threadId:smsId})).rejects.toThrow("client brief");
    });
    it("never combines different people at the same business and erases memory on anonymization",async()=>{
      const ids=await identities(),source=(await workspaceView(owner,{conversation:ids.sms.id})).selected!.sources[0];
      await pool.query("UPDATE crm_conversations SET contact_id=$2 WHERE id=$1",[ids.sms.id,contactId]);
      await pool.query("UPDATE crm_conversations SET contact_id=$2 WHERE id=$1",[ids.email.id,secondContactId]);
      await saveClientMemory(owner,{sourceId:source.id,category:"context",text:"Alice's private project",useInDrafts:true});
      expect(await loadClientMemory(owner,ids.email.id)).toEqual([]);
      await pool.query("UPDATE crm_businesses SET anonymized_at=now() WHERE id=$1",[businessId]);
      expect((await pool.query("SELECT id FROM crm_client_memory")).rowCount).toBe(0);
      expect((await pool.query("SELECT anonymized_at FROM crm_businesses WHERE id=$1",[businessId])).rows[0].anonymized_at).not.toBeNull();
    });
    it("deletes lead history without discovery restoring it or affecting another person",async()=>{
      const ids=await identities(),source=(await workspaceView(owner,{conversation:ids.sms.id})).selected!.sources[0];
      const lead=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization) VALUES($1,$2,'Delete this lead','')",[lead,workspace]);
      await pool.query("UPDATE crm_conversations SET lead_id=$2 WHERE id=$1",[ids.sms.id,lead]);
      await saveClientMemory(owner,{sourceId:source.id,category:"context",text:"Lead detail to erase",useInDrafts:true});
      await deleteLead(owner,{leadId:lead,confirmed:"yes"});expect((await pool.query("SELECT id FROM crm_client_memory")).rowCount).toBe(0);
      await expireCheckpoint();
      const after=await workspaceView(owner,{});
      expect(after.items.some(c=>c.id===ids.sms.id)).toBe(false);
      expect(after.items.some(c=>c.id===ids.email.id)).toBe(true);
      await expect(loadConversationSourceHistory(owner,{sourceId:source.id})).rejects.toThrow();
      await pool.query("UPDATE crm_conversation_sources SET visible=true WHERE id=$1",[source.id]);
      expect((await pool.query("SELECT visible FROM crm_conversation_sources WHERE id=$1",[source.id])).rows[0].visible).toBe(false);
      expect((await pool.query("SELECT body FROM sms_messages WHERE conversation_id=$1",[smsId])).rows.every(r=>r.body==='')).toBe(true);

    });
    it("hides expired memory immediately and clears it in retention",async()=>{
      const ids=await identities(),source=(await workspaceView(owner,{conversation:ids.sms.id})).selected!.sources[0];
      await saveClientMemory(owner,{sourceId:source.id,category:"context",text:"Old project detail",useInDrafts:true});
      await pool.query("UPDATE crm_client_memory SET expires_at=now()-interval '1 second'");
      expect(await loadClientMemory(owner,ids.sms.id)).toEqual([]);
      await pool.query("SELECT perform_reporting_retention()");expect((await pool.query("SELECT id FROM crm_client_memory")).rowCount).toBe(0);
    });
    it("enforces shared atomic draft quotas across simultaneous requests", async () => {
      const results = await Promise.allSettled(Array.from({length:7}, () => reserveDraftRequest(owner)));
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(3);
      await pool.query("DELETE FROM request_rate_limits WHERE scope='crm-ai-draft-burst'");
      await pool.query("UPDATE request_rate_limits SET count=300 WHERE scope='crm-ai-draft-workspace'");
      await expect(reserveDraftRequest(member)).rejects.toThrow("daily AI draft allowance");
      await pool.query("UPDATE request_rate_limits SET expires_at=now()-interval '1 second' WHERE scope LIKE 'crm-ai-draft-%'");
      await expect(reserveDraftRequest(owner)).resolves.toBeUndefined();
    });
  },
);
