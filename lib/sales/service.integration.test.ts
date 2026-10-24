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
import { createManualLead } from "@/lib/operations/manual-leads";
import { deleteLead } from "@/lib/operations/delete-lead";
import { exportLeads, getLead, listLeads } from "@/lib/operations/data";
import {
  convertLeadAction,
  saveClientAction,
  saveContactAction,
  saveProjectAction,
} from "@/lib/operations/actions";
import {
  getMockupQueue,
  getSalesLists,
  getSalesRecord,
  getSalesToday,
  getSalesWorkspace,
  SalesAccessError,
} from "./data";
import {
  completeTask,
  convertOpportunity,
  createOpportunity,
  importSalesCsv,
  linkInquiry,
  logActivity,
  requestMockup,
  SalesInputError,
  saveMockup,
  saveTask,
  setChannelPreference,
  updateOpportunity,
} from "./service";
import type { CreateOpportunityInput } from "./validation";

vi.mock("server-only", () => ({}));
const actionSession = vi.hoisted(() => ({
  context: null as DashboardContext | null,
}));
vi.mock("@/lib/dashboard/data", () => ({
  requireDashboardContext: async () => {
    if (!actionSession.context) throw new Error("No fixture action session");
    return actionSession.context;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new Error(`fixture_redirect:${location}`);
  },
}));

const databaseUrl = process.env.TEST_SALES_DATABASE_URL;
const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000008002";
const ownerId = "sales-fixture-owner",
  memberId = "sales-fixture-member",
  viewerId = "sales-fixture-viewer",
  otherOwnerId = "sales-fixture-other";

function context(
  userId = ownerId,
  role: DashboardContext["role"] = "owner",
  workspace = workspaceId,
): DashboardContext {
  return {
    user: {
      id: userId,
      name: "Sales fixture user",
      email: `${userId}@example.test`,
    },
    workspace: {
      id: workspace,
      name: "Sales fixture workspace",
      slug: "sales-fixture",
    },
    role,
  };
}
const owner = context(),
  member = context(memberId, "member"),
  viewer = context(viewerId, "viewer"),
  otherOwner = context(otherOwnerId, "owner", otherWorkspaceId);
let pool: Pool;
let safeDatabaseVerified = false;
let fixtureSequence = 0;

function prospect(
  overrides: Partial<CreateOpportunityInput> = {},
): CreateOpportunityInput {
  const sequence = ++fixtureSequence;
  return {
    businessName: `Fixture business ${sequence}`,
    contactName: `Fixture contact ${sequence}`,
    email: `contact${sequence}@fixture.example.test`,
    phone: `+1212555${String(sequence).padStart(4, "0")}`,
    websiteUrl: `https://business-${sequence}.example.test`,
    title: `Website sale ${sequence}`,
    stage: "prospect",
    websiteStatus: "unknown",
    offerType: "standard",
    ...overrides,
  };
}
async function count(
  table:
    | "crm_businesses"
    | "contacts"
    | "crm_opportunities"
    | "crm_lists"
    | "crm_list_members"
    | "crm_activities"
    | "crm_tasks"
    | "crm_mockups"
    | "crm_channel_preferences"
    | "clients"
    | "projects",
) {
  return Number(
    (await pool.query(`SELECT count(*)::text AS count FROM ${table}`)).rows[0]
      .count,
  );
}
async function record(id: string, activeContext = owner) {
  const found = await getSalesRecord(activeContext, id);
  expect(found).not.toBeNull();
  return found!;
}
function imported(csv: string, listName = "Fixture researched prospects") {
  return { csv, listName, ownerUserId: memberId, reviewed: true };
}
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const initialActionState = { status: "idle" as const, message: "" };

describe.skipIf(!databaseUrl)(
  "Agency sales service with an isolated PostgreSQL database",
  () => {
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.pathname !== "/ta_sales_test" ||
        url.search ||
        url.hash
      ) {
        throw new Error(
          "Sales integration tests require the exact local ta_sales_test database without connection overrides.",
        );
      }
      vi.stubEnv("DATABASE_URL", databaseUrl!);
      pool = getDatabasePool();
      const connected = await pool.query<{ database: string }>(
        "SELECT current_database() AS database",
      );
      if (connected.rows[0].database !== "ta_sales_test")
        throw new Error(
          "Refusing to modify a database other than ta_sales_test.",
        );
      safeDatabaseVerified = true;
      await pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
      );
      for (const filename of (await readdir("db/migrations"))
        .filter((file) => file.endsWith(".sql"))
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
        const migration = await pool.connect();
        try {
          await migration.query("BEGIN");
          await migration.query(
            await readFile(`db/migrations/${filename}`, "utf8"),
          );
          await migration.query(
            "INSERT INTO schema_migrations(filename) VALUES($1)",
            [filename],
          );
          await migration.query("COMMIT");
        } catch (error) {
          await migration.query("ROLLBACK");
          throw error;
        } finally {
          migration.release();
        }
      }
    }, 30_000);

    beforeEach(async () => {
      if (!safeDatabaseVerified)
        throw new Error(
          "Disposable sales test database has not been verified.",
        );
      // This intentionally clears only the guarded, disposable database, including
      // dependent fixture rows introduced by the existing application migrations.
      await pool.query(
        'TRUNCATE crm_channel_preferences, crm_activities, crm_tasks, crm_mockups, crm_list_members, crm_lists, crm_opportunities, contacts, projects, clients, crm_businesses, leads, audit_logs, "user" CASCADE',
      );
      await pool.query("DELETE FROM workspaces WHERE id=$1", [
        otherWorkspaceId,
      ]);
      await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [
        workspaceId,
      ]);
      await pool.query(
        "INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'sales-fixture-other','Other private workspace','internal','active')",
        [otherWorkspaceId],
      );
      for (const [userId, role, workspace] of [
        [ownerId, "owner", workspaceId],
        [memberId, "member", workspaceId],
        [viewerId, "viewer", workspaceId],
        [otherOwnerId, "owner", otherWorkspaceId],
      ]) {
        await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [
          userId,
          userId,
          `${userId}@example.test`,
        ]);
        await pool.query(
          "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
          [randomUUID(), workspace, userId, role],
        );
      }
      fixtureSequence = 0;
      actionSession.context = owner;
    });

    afterAll(async () => {
      await pool?.end();
      delete (globalThis as { tailoredAgentsDatabasePool?: Pool })
        .tailoredAgentsDatabasePool;
      vi.unstubAllEnvs();
    });

    it("creates a phone-only manual lead without invented email, public delivery, or website analytics", async () => {
      const { leadId } = await createManualLead(member, {
        submissionId: randomUUID(),
        organization: "  Call-in landscaping prospect  ",
        phone: "(212) 555-0186",
        interest: "Website redesign",
        description:
          "Referral from an existing customer. Call back after 3 pm.",
      });
      const saved = await getLead(owner, leadId);
      expect(saved).toMatchObject({
        id: leadId,
        organization: "Call-in landscaping prospect",
        email: null,
        source: "manual",
        status: "new",
        ownerUserId: memberId,
        deliveryStatus: "not_configured",
        interest: "Website redesign",
        description:
          "Referral from an existing customer. Call back after 3 pm.",
      });
      expect(saved?.phone).toBeTruthy();
      const privateState = (
        await pool.query(
          "SELECT measurement_context,measurement_status,measurement_recorded_at,delivered_at FROM leads WHERE id=$1",
          [leadId],
        )
      ).rows[0];
      expect(privateState).toEqual({
        measurement_context: null,
        measurement_status: null,
        measurement_recorded_at: null,
        delivered_at: null,
      });
      const search = await listLeads(owner, { q: "0186" });
      expect(search.items.map((lead) => lead.id)).toEqual([leadId]);
      expect(search.items[0].email).toBeNull();
      expect(await exportLeads(owner)).toEqual([
        expect.objectContaining({
          organization: saved!.organization,
          email: null,
          phone: saved!.phone,
        }),
      ]);
      expect(await getLead(otherOwner, leadId)).toBeNull();
      const audit = (
        await pool.query(
          "SELECT action,actor_user_id,target_type,target_id FROM audit_logs WHERE action='lead.created'",
        )
      ).rows;
      expect(audit).toEqual([
        {
          action: "lead.created",
          actor_user_id: memberId,
          target_type: "lead",
          target_id: leadId,
        },
      ]);
      expect(await count("crm_businesses")).toBe(0);
      expect(await count("crm_opportunities")).toBe(0);
    });

    it("normalizes a manual lead email and bare website while retaining optional contact context", async () => {
      const { leadId } = await createManualLead(owner, {
        submissionId: randomUUID(),
        organization: "Email referral fixture",
        name: "  Casey Referral  ",
        email: " CASEY@Example.test ",
        websiteUrl: "referral.example.test/services",
      });
      expect(await getLead(owner, leadId)).toMatchObject({
        name: "Casey Referral",
        organization: "Email referral fixture",
        email: "casey@example.test",
        phone: null,
        websiteUrl: "https://referral.example.test/services",
        ownerUserId: ownerId,
      });
      expect((await listLeads(owner, { q: "casey@example.test" })).total).toBe(
        1,
      );
    });

    it("preserves manual phone extensions while finding and linking the canonical base number", async () => {
      const phone = "212-555-0187 ext 204";
      const { leadId } = await createManualLead(owner, {
        submissionId: randomUUID(),
        organization: "Extension contact fixture",
        phone,
      });
      expect(await getLead(owner, leadId)).toMatchObject({
        phone,
        email: null,
      });
      expect(await exportLeads(owner)).toEqual([
        expect.objectContaining({
          organization: "Extension contact fixture",
          phone,
          email: null,
        }),
      ]);
      expect(
        (await listLeads(owner, { q: "2125550187" })).items.map(
          (lead) => lead.id,
        ),
      ).toEqual([leadId]);
      const opportunityId = await linkInquiry(owner, leadId);
      const linked = await record(opportunityId);
      expect(linked.contact?.phone).toBe("+12125550187");
      expect(linked.business.phone).toBe("+12125550187");
      expect(await getLead(owner, leadId)).toMatchObject({ phone });
    });

    it("checks stored membership before accepting a manual lead even with a spoofed role", async () => {
      const input = {
        submissionId: randomUUID(),
        organization: "Unauthorized manual fixture",
        phone: "2125550187",
      };
      await expect(
        createManualLead({ ...viewer, role: "owner" }, input),
      ).rejects.toThrow();
      await pool.query(
        "UPDATE workspace_memberships SET status='suspended' WHERE workspace_id=$1 AND user_id=$2",
        [workspaceId, memberId],
      );
      await expect(
        createManualLead({ ...member, role: "owner" }, input),
      ).rejects.toThrow();
      await expect(
        createManualLead(context(ownerId, "owner", otherWorkspaceId), input),
      ).rejects.toThrow();
      expect(
        (await pool.query("SELECT count(*)::int AS count FROM leads")).rows[0]
          .count,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM audit_logs WHERE action='lead.created'",
          )
        ).rows[0].count,
      ).toBe(0);
    });

    it("replays concurrent manual submissions once while isolating request IDs by actor and workspace", async () => {
      const input = {
        submissionId: randomUUID(),
        organization: "Repeat-safe manual fixture",
        email: "repeat@example.test",
      };
      const [first, replay] = await Promise.all([
        createManualLead(owner, input),
        createManualLead(owner, input),
      ]);
      expect(replay.leadId).toBe(first.leadId);
      expect((await pool.query("SELECT id FROM leads")).rows).toHaveLength(1);
      expect(
        (
          await pool.query(
            "SELECT id FROM audit_logs WHERE action='lead.created'",
          )
        ).rows,
      ).toHaveLength(1);
      const otherActor = await createManualLead(member, input);
      const otherWorkspace = await createManualLead(otherOwner, input);
      expect(
        new Set([first.leadId, otherActor.leadId, otherWorkspace.leadId]).size,
      ).toBe(3);
      expect((await listLeads(owner, {})).total).toBe(2);
      expect(
        (await listLeads(otherOwner, {})).items.map((lead) => lead.id),
      ).toEqual([otherWorkspace.leadId]);
      expect(
        (
          await pool.query(
            "SELECT id FROM audit_logs WHERE action='lead.created'",
          )
        ).rows,
      ).toHaveLength(3);
    });

    it.each([undefined, "", "   "])("creates and links a lead with no business name (%j)", async (organization) => {
      const { leadId } = await createManualLead(member, {
        submissionId: randomUUID(), organization, name: "Jordan Referral", phone: "7705550134",
      });
      expect(await getLead(member, leadId)).toMatchObject({ organization: "", name: "Jordan Referral" });
      const opportunityId = await linkInquiry(member, leadId);
      const linked = await record(opportunityId);
      expect(linked.business.name).toBe("Jordan Referral");
      expect(linked.title).toBe("Lead — Jordan Referral");
    });

    it("keeps a phone-only lead identifiable without inventing a business name", async () => {
      const { leadId } = await createManualLead(member, { submissionId: randomUUID(), phone: "7705550135" });
      expect(await getLead(member, leadId)).toMatchObject({ organization: "", phone: "7705550135" });
      const linked = await record(await linkInquiry(member, leadId));
      expect(linked.business.name).toBe("7705550135");
    });

    it("deletes a lead and its notes once, with a content-free audit record", async () => {
      const { leadId } = await createManualLead(member, { submissionId: randomUUID(), name: "Deletion fixture", phone: "7705550136" });
      await pool.query("INSERT INTO lead_notes(id,workspace_id,lead_id,body) VALUES($1,$2,$3,'Private fixture note')", [randomUUID(), workspaceId, leadId]);
      expect(await deleteLead(member, { leadId, confirmed: "yes" })).toBe(true);
      expect(await getLead(owner, leadId)).toBeNull();
      expect((await listLeads(owner, {})).total).toBe(0);
      expect((await pool.query("SELECT id FROM lead_notes")).rowCount).toBe(0);
      expect(await deleteLead(owner, { leadId, confirmed: "yes" })).toBe(false);
      const audit = await pool.query("SELECT target_id,metadata FROM audit_logs WHERE action='lead.deleted'");
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].target_id).toBe(leadId);
      expect(JSON.stringify(audit.rows)).not.toContain("Deletion fixture");
    });

    it("preserves converted records, Inbox histories and Meta replay receipts when deleting a lead", async () => {
      const { leadId } = await createManualLead(member, { submissionId: randomUUID(), name: "Converted deletion fixture", phone: "7705550137" });
      const opportunityId = await linkInquiry(member, leadId);
      const sale = await convertOpportunity(owner, { opportunityId, projectName: "Keep this project" });
      const emailId = randomUUID(), smsId = randomUUID(), numberId = randomUUID(), conversationId = randomUUID();
      await pool.query("INSERT INTO inbox_conversations(id,workspace_id,mailbox_id,thread_id,lead_id) VALUES($1,$2,'fixture-mailbox','fixture-thread',$3)", [emailId, workspaceId, leadId]);
      await pool.query("INSERT INTO inbox_notes(id,workspace_id,conversation_id,body) VALUES($1,$2,$3,'Keep this conversation note')", [randomUUID(), workspaceId, emailId]);
      await pool.query("INSERT INTO sms_numbers(id,workspace_id,account_sid,provider_sid,phone) VALUES($1,$2,$3,$4,'+17705550138')", [numberId, workspaceId, 'AC'+'1'.repeat(32), 'PN'+'1'.repeat(32)]);
      await pool.query("INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone,lead_id) VALUES($1,$2,$3,'+17705550137',$4)", [smsId, workspaceId, numberId, leadId]);
      await pool.query("INSERT INTO sms_messages(id,workspace_id,conversation_id,direction,body,status) VALUES($1,$2,$3,'inbound','Keep this text','received')", [randomUUID(), workspaceId, smsId]);
      await pool.query("INSERT INTO crm_conversations(id,workspace_id,lead_id) VALUES($1,$2,$3)", [conversationId, workspaceId, leadId]);
      await pool.query("INSERT INTO meta_lead_events(id,workspace_id,page_id,provider_lead_id,form_id,status,lead_id) VALUES($1,$2,'123456','234567','345678','imported',$3)", [randomUUID(), workspaceId, leadId]);
      expect(await deleteLead(owner, { leadId, confirmed: "yes" })).toBe(true);
      expect(await getLead(owner, leadId)).toBeNull();
      expect((await pool.query("SELECT id,lead_id FROM clients WHERE id=$1", [sale.clientId])).rows).toEqual([{ id: sale.clientId, lead_id: null }]);
      expect(await count("projects")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect((await record(opportunityId)).leadId).toBeNull();
      for (const table of ['inbox_conversations','sms_conversations','crm_conversations']) {
        expect((await pool.query(`SELECT lead_id FROM ${table}`)).rows).toEqual([{ lead_id: null }]);
      }
      expect((await pool.query("SELECT body FROM inbox_notes")).rows[0].body).toBe("Keep this conversation note");
      expect((await pool.query("SELECT body FROM sms_messages")).rows[0].body).toBe("Keep this text");
      expect((await pool.query("SELECT status,lead_id FROM meta_lead_events")).rows).toEqual([{ status: "imported", lead_id: null }]);
    });

    it("requires confirmation and real active write access in the lead's workspace", async () => {
      const { leadId } = await createManualLead(owner, { submissionId: randomUUID(), email: "delete-access@example.test" });
      await expect(deleteLead(owner, { leadId })).rejects.toThrow();
      await expect(deleteLead({ ...viewer, role: "owner" }, { leadId, confirmed: "yes" })).rejects.toThrow(SalesAccessError);
      expect(await deleteLead(otherOwner, { leadId, confirmed: "yes" })).toBe(false);
      await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE workspace_id=$1 AND user_id=$2", [workspaceId, memberId]);
      await expect(deleteLead({ ...member, role: "owner" }, { leadId, confirmed: "yes" })).rejects.toThrow(SalesAccessError);
      expect(await getLead(owner, leadId)).not.toBeNull();
      expect((await pool.query("SELECT id FROM audit_logs WHERE action='lead.deleted'")).rowCount).toBe(0);
    });

    it("rejects missing contact methods and unsafe website addresses without storing a lead", async () => {
      const input = {
        submissionId: randomUUID(),
        organization: "Invalid manual fixture",
      };
      await expect(createManualLead(owner, input)).rejects.toThrow();
      await expect(
        createManualLead(owner, { ...input, email: "invalid-address" }),
      ).rejects.toThrow();
      await expect(
        createManualLead(owner, {
          ...input,
          phone: "2125550188",
          websiteUrl: "javascript:alert(1)",
        }),
      ).rejects.toThrow();
      expect((await pool.query("SELECT id FROM leads")).rows).toHaveLength(0);
    });

    it("links and converts a phone-only manual lead into its original client and project", async () => {
      const { leadId } = await createManualLead(member, {
        submissionId: randomUUID(),
        organization: "Phone-only website sale fixture",
        name: "Jordan Phone",
        phone: "+12125550189",
        description: "Interested after an in-person introduction.",
      });
      const opportunityId = await linkInquiry(member, leadId);
      expect(await linkInquiry(owner, leadId)).toBe(opportunityId);
      const linked = await record(opportunityId);
      expect(linked).toMatchObject({ source: "manual", leadId });
      expect(linked.business.email).toBeNull();
      expect(linked.contact?.email).toBeNull();
      const sale = await convertOpportunity(owner, {
        opportunityId,
        projectName: "Phone referral website delivery",
      });
      expect(await getLead(owner, leadId)).toMatchObject({
        status: "won",
        source: "manual",
        email: null,
        clientId: sale.clientId,
      });
      expect(await count("clients")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect(await count("projects")).toBe(1);
      expect(
        (await pool.query("SELECT email,phone,client_id FROM contacts"))
          .rows[0],
      ).toEqual({
        email: null,
        phone: "+12125550189",
        client_id: sale.clientId,
      });
    });

    it("reuses canonical businesses and contacts while keeping separate sales and offer prices", async () => {
      const input = prospect({
        stage: "interested",
        ownerUserId: memberId,
        value: 800,
        offerType: "promotion",
      });
      const [firstId, secondId] = await Promise.all([
        createOpportunity(owner, input),
        createOpportunity(member, {
          ...input,
          title: "Monthly SEO engagement",
          value: 2500,
          offerType: "standard",
        }),
      ]);
      expect(firstId).not.toBe(secondId);
      const first = await record(firstId),
        second = await record(secondId);
      expect(first.business.id).toBe(second.business.id);
      expect(first.contact?.id).toBe(second.contact?.id);
      expect(first).toMatchObject({
        stage: "interested",
        ownerId: memberId,
        valueCents: 80000,
        offerType: "promotion",
      });
      expect(second).toMatchObject({
        valueCents: 250000,
        offerType: "standard",
      });
      expect(await count("crm_businesses")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect(await count("crm_opportunities")).toBe(2);
      expect(await count("crm_tasks")).toBe(0);
      expect(await count("crm_mockups")).toBe(0);
      expect((await getSalesWorkspace(member, { owner: "mine" })).total).toBe(
        2,
      );
    });

    it("uses stored membership permissions even when a caller spoofs an owner role", async () => {
      const id = await createOpportunity(owner, prospect());
      expect((await getSalesWorkspace(viewer)).total).toBe(1);
      await expect(
        createOpportunity({ ...viewer, role: "owner" }, prospect()),
      ).rejects.toBeInstanceOf(SalesAccessError);
      await expect(
        logActivity(viewer, {
          opportunityId: id,
          kind: "note",
          body: "Viewer must not write",
        }),
      ).rejects.toBeInstanceOf(SalesAccessError);
      await pool.query(
        "UPDATE workspace_memberships SET status='suspended' WHERE workspace_id=$1 AND user_id=$2",
        [workspaceId, memberId],
      );
      await expect(getSalesWorkspace(member)).rejects.toBeInstanceOf(
        SalesAccessError,
      );
      await expect(
        createOpportunity({ ...member, role: "owner" }, prospect()),
      ).rejects.toBeInstanceOf(SalesAccessError);
      expect(await count("crm_opportunities")).toBe(1);
      expect(await count("crm_activities")).toBe(0);
    });

    it("hides other workspaces and rejects writes to their opportunities", async () => {
      const localId = await createOpportunity(owner, prospect());
      const otherId = await createOpportunity(
        otherOwner,
        prospect({ businessName: "Private other business" }),
      );
      expect(await getSalesRecord(owner, otherId)).toBeNull();
      expect(await getSalesRecord(owner, "not-a-uuid")).toBeNull();
      expect(
        (await getSalesWorkspace(owner)).items.map((item) => item.id),
      ).toEqual([localId]);
      expect(
        (await getSalesWorkspace(owner, { q: "Private other business" })).total,
      ).toBe(0);
      await expect(
        logActivity(owner, {
          opportunityId: otherId,
          kind: "call",
          body: "Forbidden cross-workspace call",
        }),
      ).rejects.toBeInstanceOf(SalesInputError);
      await expect(
        requestMockup(owner, {
          opportunityId: otherId,
          brief: "Forbidden other workspace mockup",
        }),
      ).rejects.toBeInstanceOf(SalesInputError);
      await expect(
        convertOpportunity(owner, {
          opportunityId: otherId,
          projectName: "Forbidden project",
        }),
      ).rejects.toBeInstanceOf(SalesInputError);
      expect(await count("crm_activities")).toBe(0);
      expect(await count("crm_mockups")).toBe(0);
      expect(await count("projects")).toBe(0);
      expect(
        (await getSalesWorkspace(otherOwner)).items.map((item) => item.id),
      ).toEqual([otherId]);
    });

    it("rejects inactive, view-only, and other-workspace assignees without partial writes", async () => {
      for (const ownerUserId of [otherOwnerId, viewerId, "not-a-saved-user"]) {
        await expect(
          createOpportunity(owner, prospect({ ownerUserId })),
        ).rejects.toThrow("active teammate");
      }
      expect(await count("crm_businesses")).toBe(0);
      expect(await count("contacts")).toBe(0);
      const input = prospect(),
        id = await createOpportunity(owner, input);
      const current = await record(id);
      await expect(
        updateOpportunity(owner, {
          ...input,
          opportunityId: id,
          expectedUpdatedAt: current.updatedAt,
          expectedBusinessUpdatedAt: current.business.updatedAt,
          ownerUserId: otherOwnerId,
          businessName: "Must not persist",
        }),
      ).rejects.toThrow("active teammate");
      expect((await record(id)).business.name).toBe(input.businessName);
    });

    it("imports quoted researched lists, preserves evidence, and replays without duplicate records", async () => {
      const row =
        '"Acme, ""Studio""",(212) 555-0100,OWNER@acme.example.test,Design,NY,No website,84,https://research.example.test/acme,"First line\nSecond line"';
      const csv = `Business Name,Phone,Email,Industry,State,Website Status,Score,Research URL,Notes\n${row}\n${row}`;
      const result = await importSalesCsv(owner, imported(csv), "prospects");
      expect(result).toMatchObject({
        created: 1,
        matched: 0,
        skipped: 1,
        issues: [],
      });
      const saved = (await getSalesWorkspace(owner)).items[0];
      expect(saved.business).toMatchObject({
        name: 'Acme, "Studio"',
        phone: "+12125550100",
        email: "owner@acme.example.test",
        industry: "Design",
        state: "NY",
        websiteStatus: "none",
        score: 84,
        researchUrl: "https://research.example.test/acme",
        researchNotes: "First line\nSecond line",
      });
      expect(saved.ownerId).toBe(memberId);
      const provenance = (
        await pool.query(
          "SELECT research_data FROM crm_list_members WHERE list_id=$1",
          [result.listId],
        )
      ).rows[0].research_data;
      expect(provenance).toMatchObject({
        rowNumber: 2,
        score: 84,
        state: "NY",
        businessName: 'Acme, "Studio"',
      });
      const replay = await importSalesCsv(
        owner,
        imported(csv, "Renamed replay"),
        "prospects",
      );
      expect(replay).toMatchObject({
        created: 0,
        matched: 2,
        skipped: 0,
        listId: result.listId,
      });
      expect(replay.issues.join(" ")).toContain("already imported");
      for (const table of [
        "crm_businesses",
        "contacts",
        "crm_opportunities",
        "crm_lists",
        "crm_list_members",
      ] as const)
        expect(await count(table)).toBe(1);
    });

    it("requires import review and rejects invalid files before saving any rows", async () => {
      const csv =
        "Business Name,Phone\nValid fixture,2125550100\nInvalid fixture,not-a-phone";
      await expect(
        importSalesCsv(
          owner,
          { ...imported(csv), reviewed: false },
          "prospects",
        ),
      ).rejects.toThrow("Review");
      await expect(
        importSalesCsv(owner, imported(csv), "prospects"),
      ).rejects.toThrow("Fix the CSV");
      expect(await count("crm_lists")).toBe(0);
      expect(await count("crm_businesses")).toBe(0);
    });

    it("skips ambiguous imported identities and continues safe rows without merging businesses", async () => {
      const first = prospect(),
        second = prospect();
      await createOpportunity(owner, first);
      await createOpportunity(owner, second);
      const csv = `Business Name,Phone,Email\nAmbiguous fixture,${first.phone},${second.email}\nSafe fixture,+12125550999,safe@fixture.example.test`;
      const result = await importSalesCsv(owner, imported(csv), "prospects");
      expect(result).toMatchObject({ created: 1, matched: 0, skipped: 1 });
      expect(result.issues.join(" ")).toContain("multiple businesses");
      expect(await count("crm_businesses")).toBe(3);
      expect(await count("crm_list_members")).toBe(1);
      expect(
        (await getSalesWorkspace(owner)).items.map(
          (item) => item.business.name,
        ),
      ).not.toContain("Ambiguous fixture");
    });

    it("deduplicates BatchDialer outcomes and preserves channel suppression", async () => {
      const input = prospect({ phone: "+12125550100" }),
        id = await createOpportunity(owner, input);
      const header = "Phone,Disposition,Call ID,Call Date,Notes";
      const interested = `${header}\n(212) 555-0100,Interested,call-fixture-1,2026-10-21T10:30:00-04:00,Requested a website preview`;
      expect(
        await importSalesCsv(
          member,
          imported(interested, "First dialer results"),
          "dialer",
        ),
      ).toMatchObject({ created: 1, matched: 0, skipped: 0 });
      expect(
        await importSalesCsv(
          member,
          imported(interested, "Same dialer results"),
          "dialer",
        ),
      ).toMatchObject({ created: 0, matched: 1, skipped: 0 });
      const equivalent = `${header}\n+12125550100,Interested,call-fixture-1,2026-10-21T14:30:00Z,Edited export note`;
      expect(
        await importSalesCsv(member, imported(equivalent), "dialer"),
      ).toMatchObject({ created: 0, matched: 1 });
      expect((await record(id)).stage).toBe("interested");
      expect(await count("crm_tasks")).toBe(0);
      expect(await count("crm_mockups")).toBe(0);
      const activity = (await record(id)).activities[0];
      expect(activity).toMatchObject({
        kind: "call",
        source: "batchdialer",
        direction: "outbound",
        outcome: "Interested",
        occurredAt: "2026-10-21T14:30:00.000Z",
      });
      const suppression = `${header}\n2125550100,DNC,call-fixture-2,2026-10-22T14:30:00Z,Asked to stop calls\n2125550100,STOP,call-fixture-3,2026-10-22T14:35:00Z,Asked to stop texts`;
      expect(
        await importSalesCsv(member, imported(suppression), "dialer"),
      ).toMatchObject({ created: 2, skipped: 0 });
      await importSalesCsv(member, imported(interested), "dialer");
      expect(await count("crm_activities")).toBe(3);
      expect((await record(id)).channelPreferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channel: "call",
            address: "+12125550100",
            status: "blocked",
          }),
          expect.objectContaining({
            channel: "sms",
            address: "+12125550100",
            status: "blocked",
          }),
        ]),
      );
    });

    it("does not guess a sales opportunity for unmatched or ambiguous dialer outcomes", async () => {
      const input = prospect({ phone: "+12125550100" });
      await createOpportunity(owner, input);
      await createOpportunity(owner, {
        ...input,
        title: "Separate recurring service sale",
      });
      const result = await importSalesCsv(
        member,
        imported(
          "Phone,Disposition,Call ID\n2125550100,Interested,ambiguous-call-fixture\n2125550999,DNC,unmatched-call-fixture",
        ),
        "dialer",
      );
      expect(result).toMatchObject({
        created: 0,
        matched: 0,
        skipped: 2,
        suppressed: 1,
      });
      expect(result.issues.join(" ")).toContain("multiple open sales");
      expect(result.issues.join(" ")).toContain("no matching saved business");
      expect(await count("crm_activities")).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT channel,normalized_address,status FROM crm_channel_preferences",
          )
        ).rows,
      ).toEqual([
        {
          channel: "call",
          normalized_address: "+12125550999",
          status: "blocked",
        },
      ]);
    });

    it("preserves imported opt-outs for won sales and multiple open sales without guessing call history", async () => {
      const closedInput = prospect({ phone: "+12125550100" });
      const closedId = await createOpportunity(owner, closedInput);
      await convertOpportunity(owner, {
        opportunityId: closedId,
        projectName: "Won fixture website",
      });
      const ambiguousInput = prospect({ phone: "+12125550200" });
      await createOpportunity(owner, ambiguousInput);
      await createOpportunity(owner, {
        ...ambiguousInput,
        title: "Second open fixture opportunity",
      });
      const csv =
        "Phone,Disposition,Call ID\n2125550100,STOP,won-opt-out-fixture\n2125550200,DNC,multi-open-opt-out-fixture";
      const result = await importSalesCsv(member, imported(csv), "dialer");
      expect(result).toMatchObject({
        created: 0,
        matched: 0,
        skipped: 2,
        suppressed: 2,
      });
      expect(result.issues.join(" ")).toContain("no open sale");
      expect(result.issues.join(" ")).toContain("multiple open sales");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM crm_activities WHERE source='batchdialer'",
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT channel,normalized_address,status FROM crm_channel_preferences ORDER BY normalized_address",
          )
        ).rows,
      ).toEqual([
        {
          channel: "sms",
          normalized_address: "+12125550100",
          status: "blocked",
        },
        {
          channel: "call",
          normalized_address: "+12125550200",
          status: "blocked",
        },
      ]);
      expect(
        await importSalesCsv(member, imported(csv), "dialer"),
      ).toMatchObject({ created: 0, skipped: 2, suppressed: 0 });
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM audit_logs WHERE action='communication.imported_opt_out'",
          )
        ).rows[0].count,
      ).toBe(2);
    });

    it("requires explicit task timing and outcome, and completes each commitment once", async () => {
      const id = await createOpportunity(
        owner,
        prospect({ ownerUserId: memberId }),
      );
      const task = {
        opportunityId: id,
        title: "Call back about the preview",
        kind: "follow_up",
        ownerUserId: memberId,
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      };
      await expect(
        saveTask(member, { ...task, dueAt: undefined }),
      ).rejects.toThrow();
      await expect(
        saveTask(member, { ...task, dueAt: "2026-10-22T09:00:00" }),
      ).rejects.toThrow();
      await saveTask(member, task);
      const saved = (await record(id)).tasks[0];
      expect(saved).toMatchObject({
        title: task.title,
        dueAt: task.dueAt,
        ownerId: memberId,
        status: "open",
      });
      expect(
        (await getSalesToday(member)).tasks.map((item) => item.id),
      ).toEqual([saved.id]);
      expect((await getSalesToday(owner)).tasks).toEqual([]);
      const completion = {
        opportunityId: id,
        taskId: saved.id,
        status: "completed",
        outcome: "Preview reviewed; discovery appointment agreed.",
      };
      await expect(
        completeTask(member, { ...completion, outcome: "" }),
      ).rejects.toThrow();
      await completeTask(member, completion);
      await expect(completeTask(member, completion)).rejects.toBeInstanceOf(
        SalesInputError,
      );
      expect((await getSalesToday(member)).tasks).toEqual([]);
      const closed = await record(id);
      expect(closed.tasks[0].status).toBe("completed");
      expect(
        closed.activities.filter((item) => item.kind === "outcome"),
      ).toHaveLength(1);
      expect(closed.activities[0].body).toContain(completion.outcome);
    });

    it("separates appointments and follow-ups by owner, time window, and workspace", async () => {
      const localId = await createOpportunity(
        owner,
        prospect({ ownerUserId: memberId }),
      );
      const otherId = await createOpportunity(otherOwner, prospect());
      const soon = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      const later = new Date(Date.now() + 15 * 24 * 60 * 60_000).toISOString();
      const base = {
        opportunityId: localId,
        title: "Website discovery",
        kind: "appointment",
        ownerUserId: memberId,
        dueAt: soon,
      };
      await expect(
        saveTask(member, {
          ...base,
          endAt: new Date(Date.parse(soon) - 60_000).toISOString(),
        }),
      ).rejects.toThrow();
      await saveTask(member, {
        ...base,
        endAt: new Date(Date.parse(soon) + 30 * 60_000).toISOString(),
      });
      await saveTask(owner, {
        ...base,
        title: "Owner follow-up",
        kind: "follow_up",
        ownerUserId: ownerId,
      });
      await saveTask(member, {
        ...base,
        title: "Later appointment",
        dueAt: later,
      });
      await saveTask(otherOwner, {
        ...base,
        opportunityId: otherId,
        ownerUserId: otherOwnerId,
      });
      const mine = await getSalesToday(member),
        team = await getSalesToday(owner, "team");
      expect(mine.tasks).toEqual([]);
      expect(mine.appointments.map((item) => item.title)).toEqual([
        "Website discovery",
      ]);
      expect(team.tasks.map((item) => item.title)).toEqual(["Owner follow-up"]);
      expect(team.appointments.map((item) => item.opportunityId)).toEqual([
        localId,
      ]);
    });

    it("allows one mockup request and requires an actual preview before readiness", async () => {
      const id = await createOpportunity(
        member,
        prospect({ stage: "interested" }),
      );
      const input = {
        opportunityId: id,
        ownerUserId: ownerId,
        brief:
          "Build a personalized website preview with online appointment booking.",
      };
      await requestMockup(member, input);
      await expect(requestMockup(member, input)).rejects.toThrow(
        "already exists",
      );
      expect(await count("crm_mockups")).toBe(1);
      expect((await record(id)).stage).toBe("mockup");
      await expect(
        saveMockup(owner, { ...input, status: "ready" }),
      ).rejects.toThrow();
      expect((await record(id)).mockup?.status).toBe("requested");
      await saveMockup(owner, {
        ...input,
        status: "ready",
        previewUrl: "https://preview.example.test/fixture",
        repositoryUrl: "https://github.com/example/fixture",
        projectPath: "C:/Factory/fixture",
        qaNotes: "Reviewed phone layout and contact form.",
      });
      expect((await record(id)).mockup).toMatchObject({
        status: "ready",
        previewUrl: "https://preview.example.test/fixture",
        projectPath: "C:/Factory/fixture",
      });
      expect(
        (await getMockupQueue(member)).items.map((item) => item.opportunityId),
      ).toEqual([id]);
      expect((await getSalesToday(owner)).mockups).toHaveLength(1);
      expect((await getSalesToday(member)).mockups).toHaveLength(0);
    });

    it("converts a sale idempotently and reuses the same client and contact for a later sale", async () => {
      const input = prospect({
        stage: "proposal",
        value: 800,
        offerType: "promotion",
      });
      const id = await createOpportunity(owner, input);
      const conversion = {
        opportunityId: id,
        projectName: "Fixture website build",
        projectSummary: "The agreed promotional website scope.",
      };
      const [first, replay] = await Promise.all([
        convertOpportunity(owner, conversion),
        convertOpportunity(owner, conversion),
      ]);
      expect(replay).toEqual(first);
      expect(await count("clients")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect(await count("projects")).toBe(1);
      const won = await record(id);
      expect(won).toMatchObject({
        stage: "won",
        clientId: first.clientId,
        projectId: first.projectId,
        valueCents: 80000,
        offerType: "promotion",
      });
      expect(
        (await pool.query("SELECT client_id,business_id FROM contacts"))
          .rows[0],
      ).toMatchObject({
        client_id: first.clientId,
        business_id: won.business.id,
      });
      await expect(
        updateOpportunity(owner, {
          ...input,
          opportunityId: id,
          expectedUpdatedAt: won.updatedAt,
          expectedBusinessUpdatedAt: won.business.updatedAt,
          stage: "prospect",
        }),
      ).rejects.toThrow("won state");
      const secondId = await createOpportunity(member, {
        ...input,
        title: "Managed SEO service",
        offerType: "standard",
        value: 1200,
      });
      const second = await convertOpportunity(owner, {
        opportunityId: secondId,
        projectName: "SEO onboarding",
      });
      expect(second.clientId).toBe(first.clientId);
      expect(second.projectId).not.toBe(first.projectId);
      expect(await count("clients")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect(await count("projects")).toBe(2);
    });

    it("keeps the client name synchronized when another pre-sale opportunity edits their shared business", async () => {
      const input = prospect({ stage: "proposal" });
      const firstId = await createOpportunity(owner, input);
      const secondInput = {
        ...input,
        title: "Planned SEO engagement",
        stage: "interested",
      };
      const secondId = await createOpportunity(owner, secondInput);
      const originalContactId = (await record(firstId)).contact!.id;
      const sale = await convertOpportunity(owner, {
        opportunityId: firstId,
        projectName: "Sold website delivery",
      });
      const remaining = await record(secondId);
      expect(remaining.clientId).toBeNull();
      await updateOpportunity(owner, {
        ...secondInput,
        opportunityId: secondId,
        expectedUpdatedAt: remaining.updatedAt,
        expectedBusinessUpdatedAt: remaining.business.updatedAt,
        businessName: "Reviewed client business name",
        contactEmail: input.email,
        contactPhone: input.phone,
      });
      const first = await record(firstId),
        second = await record(secondId);
      expect(first.business.name).toBe("Reviewed client business name");
      expect(second.business.name).toBe("Reviewed client business name");
      expect(first.business.id).toBe(second.business.id);
      expect(first.contact!.id).toBe(originalContactId);
      expect(second.contact!.id).toBe(originalContactId);
      expect(
        (
          await pool.query("SELECT name,business_id FROM clients WHERE id=$1", [
            sale.clientId,
          ])
        ).rows[0],
      ).toEqual({
        name: "Reviewed client business name",
        business_id: first.business.id,
      });
      expect(
        (
          await pool.query(
            "SELECT client_id,business_id FROM contacts WHERE id=$1",
            [originalContactId],
          )
        ).rows[0],
      ).toEqual({ client_id: sale.clientId, business_id: first.business.id });
      expect(await count("crm_businesses")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect(await count("clients")).toBe(1);
      expect(await count("projects")).toBe(1);
      expect(await count("crm_opportunities")).toBe(2);
    });

    it("links existing website inquiries once and carries their sale into the original lead", async () => {
      const leadId = randomUUID();
      await pool.query(
        "INSERT INTO leads(id,workspace_id,name,organization,email,phone,description,next_action,next_action_at) VALUES($1,$2,'Fixture Contact','Website inquiry fixture','inquiry@fixture.example.test','2125550100','Requested a website and local visibility review.','Confirm discovery',now())",
        [leadId, workspaceId],
      );
      const id = await linkInquiry(member, leadId);
      expect(await linkInquiry(owner, leadId)).toBe(id);
      expect(await count("crm_opportunities")).toBe(1);
      expect(await record(id)).toMatchObject({
        source: "website",
        leadId,
        stage: "interested",
      });
      expect((await getSalesWorkspace(owner)).websiteInquiries).toEqual([]);
      const sale = await convertOpportunity(owner, {
        opportunityId: id,
        projectName: "Website inquiry delivery",
      });
      const lead = (
        await pool.query(
          "SELECT status,client_id,business_id,converted_at,next_action,next_action_at FROM leads WHERE id=$1",
          [leadId],
        )
      ).rows[0];
      expect(lead).toMatchObject({
        status: "won",
        client_id: sale.clientId,
        business_id: (await record(id)).business.id,
        next_action: null,
        next_action_at: null,
      });
      expect(lead.converted_at).toBeInstanceOf(Date);
    });

    it("attributes each won sale and its revenue to the first source list only", async () => {
      const csv =
        "Business Name,Phone,Score,Notes\nAttribution fixture,2125550100,90,Initial research";
      const first = await importSalesCsv(
        owner,
        imported(csv, "First source list"),
        "prospects",
      );
      const second = await importSalesCsv(
        owner,
        imported(
          csv.replace("Initial research", "Later research"),
          "Second source list",
        ),
        "prospects",
      );
      expect(second).toMatchObject({ created: 0, matched: 1 });
      await pool.query(
        "UPDATE crm_lists SET created_at=CASE WHEN id=$1 THEN '2026-01-01'::timestamptz ELSE '2026-02-01'::timestamptz END",
        [first.listId],
      );
      const id = (await getSalesWorkspace(owner)).items[0].id;
      await pool.query(
        "UPDATE crm_opportunities SET value_cents=80000 WHERE id=$1",
        [id],
      );
      await convertOpportunity(owner, {
        opportunityId: id,
        projectName: "Attributed website sale",
      });
      const lists = await getSalesLists(owner);
      expect(lists.find((list) => list.id === first.listId)).toMatchObject({
        businesses: 1,
        won: 1,
        wonValueCents: 80000,
      });
      expect(lists.find((list) => list.id === second.listId)).toMatchObject({
        businesses: 1,
        won: 0,
        wonValueCents: 0,
      });
      expect(lists.reduce((total, list) => total + list.wonValueCents, 0)).toBe(
        80000,
      );
      expect((await getSalesWorkspace(owner)).summary).toMatchObject({
        won: 1,
        wonValueCents: 80000,
        open: 0,
      });
      expect(
        (await getSalesWorkspace(owner, { list: second.listId! })).items.map(
          (item) => item.id,
        ),
      ).toEqual([id]);
    });

    it("only records preferences for saved, valid addresses in the correct business", async () => {
      const input = prospect({
        email: "owner@preference.example.test",
        phone: "+12125550100",
      });
      const id = await createOpportunity(owner, input);
      const secondId = await createOpportunity(owner, prospect());
      const preference = {
        opportunityId: id,
        channel: "email",
        address: "OWNER@preference.example.test",
        status: "blocked",
        evidence: "Customer asked us to stop promotional emails.",
      };
      await setChannelPreference(member, preference);
      await setChannelPreference(member, {
        ...preference,
        channel: "call",
        address: "(212) 555-0100",
        evidence: "Customer requested no more sales calls.",
      });
      await expect(
        setChannelPreference(member, {
          ...preference,
          address: "not-an-address",
        }),
      ).rejects.toThrow("valid contact address");
      await expect(
        setChannelPreference(member, {
          ...preference,
          address: "unsaved@preference.example.test",
        }),
      ).rejects.toThrow("saved contact address");
      await expect(
        setChannelPreference(member, {
          ...preference,
          opportunityId: secondId,
        }),
      ).rejects.toThrow("saved contact address");
      expect(await count("crm_channel_preferences")).toBe(2);
      expect((await record(id)).channelPreferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channel: "email",
            address: "owner@preference.example.test",
            status: "blocked",
          }),
          expect.objectContaining({
            channel: "call",
            address: "+12125550100",
            status: "blocked",
          }),
        ]),
      );
      expect((await record(secondId)).channelPreferences).toEqual([]);
      const audit = await pool.query(
        "SELECT actor_user_id,metadata FROM audit_logs WHERE action='communication.preference_updated'",
      );
      expect(audit.rows).toHaveLength(2);
      expect(
        audit.rows.every(
          (row) =>
            row.actor_user_id === memberId && row.metadata.status === "blocked",
        ),
      ).toBe(true);
    });

    it("rejects stale opportunity and shared-business edits without overwriting newer work", async () => {
      const input = prospect();
      const firstId = await createOpportunity(owner, input);
      const secondId = await createOpportunity(owner, {
        ...input,
        title: "Separate SEO opportunity",
      });
      const first = await record(firstId),
        staleSecond = await record(secondId);
      await updateOpportunity(owner, {
        ...input,
        opportunityId: firstId,
        expectedUpdatedAt: first.updatedAt,
        expectedBusinessUpdatedAt: first.business.updatedAt,
        businessName: "Reviewed current business name",
        contactEmail: input.email,
        contactPhone: input.phone,
      });
      await expect(
        updateOpportunity(member, {
          ...input,
          opportunityId: secondId,
          expectedUpdatedAt: staleSecond.updatedAt,
          expectedBusinessUpdatedAt: staleSecond.business.updatedAt,
          businessName: "Stale name must not persist",
        }),
      ).rejects.toThrow("changed while you were editing");
      const current = await record(firstId);
      expect(current.business.name).toBe("Reviewed current business name");
      await pool.query(
        "UPDATE crm_opportunities SET updated_at=updated_at+interval '1 second' WHERE id=$1",
        [firstId],
      );
      await expect(
        updateOpportunity(owner, {
          ...input,
          opportunityId: firstId,
          expectedUpdatedAt: current.updatedAt,
          expectedBusinessUpdatedAt: current.business.updatedAt,
        }),
      ).rejects.toThrow("changed while you were editing");
      expect((await record(firstId)).business.name).toBe(
        "Reviewed current business name",
      );
    });

    it.each(["(212) 555-0123", "(212) 555-0123 ext. 456"])(
      "matches legacy phone %s across imports, sales, and preferences without duplicating identity",
      async (legacyPhone) => {
        const input = prospect({ phone: undefined });
        const firstId = await createOpportunity(owner, input),
          first = await record(firstId);
        await pool.query("UPDATE contacts SET phone=$1 WHERE id=$2", [
          legacyPhone,
          first.contact!.id,
        ]);
        const importedList = await importSalesCsv(
          owner,
          imported(
            "Business Name,Phone\nPreviously researched business,2125550123",
          ),
          "prospects",
        );
        expect(importedList).toMatchObject({
          created: 0,
          matched: 1,
          skipped: 0,
        });
        expect(await count("crm_opportunities")).toBe(1);
        const secondId = await createOpportunity(
          owner,
          prospect({
            email: undefined,
            websiteUrl: undefined,
            phone: "+12125550123",
          }),
        );
        const second = await record(secondId);
        expect(second.business.id).toBe(first.business.id);
        expect(second.contact?.id).toBe(first.contact?.id);
        expect(await count("crm_businesses")).toBe(1);
        expect(await count("contacts")).toBe(1);
        await setChannelPreference(owner, {
          opportunityId: secondId,
          channel: "call",
          address: "+12125550123",
          status: "blocked",
          evidence: "Existing customer requested no further calls.",
        });
        expect(await count("crm_channel_preferences")).toBe(1);
        expect((await record(secondId)).channelPreferences).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              channel: "call",
              address: "+12125550123",
              status: "blocked",
            }),
          ]),
        );
      },
    );

    it("keeps archived mockups out of Today and the active queue while retaining their history", async () => {
      const input = prospect({ stage: "interested", ownerUserId: ownerId });
      const id = await createOpportunity(owner, input);
      await requestMockup(owner, {
        opportunityId: id,
        ownerUserId: ownerId,
        brief: "Retain this requested preview as archived sales history.",
      });
      expect(
        (await getSalesToday(owner)).mockups.map((item) => item.opportunityId),
      ).toEqual([id]);
      expect(
        (await getMockupQueue(owner)).items.map((item) => item.opportunityId),
      ).toEqual([id]);
      const current = await record(id);
      await updateOpportunity(owner, {
        ...input,
        opportunityId: id,
        expectedUpdatedAt: current.updatedAt,
        expectedBusinessUpdatedAt: current.business.updatedAt,
        stage: "archived",
        contactEmail: input.email,
        contactPhone: input.phone,
      });
      expect((await getSalesToday(owner)).mockups).toEqual([]);
      expect((await getSalesToday(owner, "team")).mockups).toEqual([]);
      expect((await getMockupQueue(owner)).items).toEqual([]);
      expect((await record(id)).mockup?.status).toBe("requested");
      expect(await count("crm_mockups")).toBe(1);
    });

    it("keeps anonymized sales history readable and rejects new content after retention", async () => {
      const input = prospect();
      const id = await createOpportunity(owner, input);
      await requestMockup(owner, {
        opportunityId: id,
        brief: "Private preview request",
      });
      await saveTask(owner, {
        opportunityId: id,
        title: "Private callback",
        kind: "follow_up",
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });
      await logActivity(owner, {
        opportunityId: id,
        kind: "note",
        body: "Private prospect history",
      });
      const active = await record(id);
      await pool.query(
        "UPDATE crm_businesses SET retained_until=now()-interval '1 day',updated_at=now()-interval '3 years' WHERE id=$1",
        [active.business.id],
      );
      await pool.query(
        "UPDATE crm_opportunities SET updated_at=now()-interval '3 years' WHERE id=$1",
        [id],
      );
      await pool.query(
        "UPDATE crm_tasks SET due_at=now()-interval '3 years',updated_at=now()-interval '3 years' WHERE opportunity_id=$1",
        [id],
      );
      await pool.query(
        "UPDATE crm_activities SET created_at=now()-interval '3 years',occurred_at=now()-interval '3 years' WHERE opportunity_id=$1",
        [id],
      );
      await pool.query(
        "UPDATE crm_mockups SET updated_at=now()-interval '3 years' WHERE opportunity_id=$1",
        [id],
      );
      await pool.query("SELECT perform_reporting_retention()");
      const retained = await record(id);
      expect(retained.stage).toBe("archived");
      expect(retained.business.name).toBe("Expired prospect");
      expect(retained.business.anonymizedAt).not.toBeNull();
      const writes = [
        () =>
          updateOpportunity(owner, {
            ...input,
            opportunityId: id,
            expectedUpdatedAt: retained.updatedAt,
            expectedBusinessUpdatedAt: retained.business.updatedAt,
            businessName: "Reintroduced private name",
          }),
        () =>
          logActivity(owner, {
            opportunityId: id,
            kind: "note",
            body: "Reintroduced private notes",
          }),
        () =>
          saveTask(owner, {
            opportunityId: id,
            title: "Reintroduced callback",
            kind: "follow_up",
            dueAt: new Date(Date.now() + 60_000).toISOString(),
          }),
        () =>
          saveMockup(owner, {
            opportunityId: id,
            status: "requested",
            brief: "Reintroduced private creative brief",
          }),
      ];
      for (const write of writes)
        await expect(write()).rejects.toBeInstanceOf(SalesInputError);
      const stillRetained = await record(id);
      expect(stillRetained.business.name).toBe("Expired prospect");
      expect(
        stillRetained.activities.every(
          (item) => item.body === "[Expired prospect content removed]",
        ),
      ).toBe(true);
      expect(stillRetained.tasks).toHaveLength(1);
      expect(stillRetained.tasks[0]).toMatchObject({
        title: "Expired follow-up",
        status: "cancelled",
      });
      expect(stillRetained.mockup?.brief).toBe(
        "[Expired prospect content removed]",
      );
    });

    it("shows blocked phone and email preferences for secondary business contacts", async () => {
      const id = await createOpportunity(owner, prospect());
      const opportunity = await record(id);
      await pool.query(
        "INSERT INTO contacts(id,workspace_id,business_id,name,email,phone) VALUES($1,$2,$3,'Secondary decision maker','secondary@fixture.example.test','(212) 555-0998 ext. 42')",
        [randomUUID(), workspaceId, opportunity.business.id],
      );
      for (const preference of [
        { channel: "call", address: "+12125550998" },
        { channel: "email", address: "secondary@fixture.example.test" },
      ])
        await setChannelPreference(owner, {
          opportunityId: id,
          ...preference,
          status: "blocked",
          evidence: "Secondary contact explicitly requested no outreach.",
        });
      const reviewed = await record(id);
      expect(reviewed.contact?.id).toBe(opportunity.contact?.id);
      expect(reviewed.channelPreferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channel: "call",
            address: "+12125550998",
            status: "blocked",
          }),
          expect.objectContaining({
            channel: "email",
            address: "secondary@fixture.example.test",
            status: "blocked",
          }),
        ]),
      );
      expect(reviewed.channelPreferences).toHaveLength(2);
    });

    it("preserves a sold project's client while allowing ordinary project reassignment", async () => {
      const opportunityId = await createOpportunity(
        owner,
        prospect({ stage: "proposal" }),
      );
      const sale = await convertOpportunity(owner, {
        opportunityId,
        projectName: "Approved website delivery",
      });
      const otherClientId = randomUUID();
      await pool.query(
        "INSERT INTO clients(id,workspace_id,name,status) VALUES($1,$2,'Other project client','active')",
        [otherClientId, workspaceId],
      );
      const projectForm = {
        projectId: sale.projectId,
        clientId: otherClientId,
        name: "Edited website delivery",
        status: "active",
        summary: "Client ownership must remain consistent with the sale.",
      };
      const rejected = await saveProjectAction(
        initialActionState,
        form(projectForm),
      );
      expect(rejected).toMatchObject({ status: "error" });
      expect(rejected.message).toContain("completed sale");
      expect(
        (
          await pool.query("SELECT client_id,name FROM projects WHERE id=$1", [
            sale.projectId,
          ])
        ).rows[0],
      ).toEqual({
        client_id: sale.clientId,
        name: "Approved website delivery",
      });
      expect((await record(opportunityId)).clientId).toBe(sale.clientId);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM audit_logs WHERE action='project.updated' AND target_id=$1",
            [sale.projectId],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        await saveProjectAction(
          initialActionState,
          form({ ...projectForm, clientId: sale.clientId }),
        ),
      ).toMatchObject({ status: "success" });
      const ordinaryProjectId = randomUUID();
      await pool.query(
        "INSERT INTO projects(id,workspace_id,client_id,name,status) VALUES($1,$2,$3,'Unlinked project','planned')",
        [ordinaryProjectId, workspaceId, sale.clientId],
      );
      expect(
        await saveProjectAction(
          initialActionState,
          form({ ...projectForm, projectId: ordinaryProjectId }),
        ),
      ).toMatchObject({ status: "success" });
      expect(
        (
          await pool.query("SELECT client_id FROM projects WHERE id=$1", [
            ordinaryProjectId,
          ])
        ).rows[0].client_id,
      ).toBe(otherClientId);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM audit_logs WHERE action='project.updated' AND target_id=$1",
            [ordinaryProjectId],
          )
        ).rows[0].count,
      ).toBe(1);
    });

    it("never retroactively attributes a closed customer sale to a later cold-prospect list", async () => {
      const input = prospect({ phone: "+12125550100", value: 800 });
      const id = await createOpportunity(owner, input);
      await convertOpportunity(owner, {
        opportunityId: id,
        projectName: "Existing customer delivery",
      });
      const importedLater = await importSalesCsv(
        owner,
        imported(
          "Business Name,Phone,Notes\nExisting customer,2125550100,Researched after the sale",
          "Later cold list",
        ),
        "prospects",
      );
      expect(importedLater).toMatchObject({
        created: 0,
        matched: 0,
        skipped: 1,
      });
      expect(importedLater.issues.join(" ")).toContain("existing client");
      expect(await count("crm_list_members")).toBe(0);
      expect(await count("crm_opportunities")).toBe(1);
      expect(
        (await getSalesLists(owner)).find(
          (list) => list.id === importedLater.listId,
        ),
      ).toMatchObject({ businesses: 0, won: 0, wonValueCents: 0 });
      expect((await getSalesWorkspace(owner)).summary.wonValueCents).toBe(
        80000,
      );
    });

    it("preserves long research notes through edits and bounds imported call bodies", async () => {
      const notes = "Fixture research detail. ".repeat(500).trim();
      const input = prospect({ notes, phone: "+12125550100" });
      const id = await createOpportunity(owner, input),
        initial = await record(id);
      await updateOpportunity(owner, {
        ...input,
        opportunityId: id,
        expectedUpdatedAt: initial.updatedAt,
        expectedBusinessUpdatedAt: initial.business.updatedAt,
        contactEmail: input.email,
        contactPhone: input.phone,
      });
      expect((await record(id)).business.researchNotes).toBe(notes);
      const callNotes = "x".repeat(20000);
      const csv = `Phone,Disposition,Call ID,Notes\n2125550100,Interested,long-call-fixture,${callNotes}`;
      expect(
        await importSalesCsv(owner, imported(csv), "dialer"),
      ).toMatchObject({ created: 1, skipped: 0 });
      const call = (await record(id)).activities.find(
        (item) => item.source === "batchdialer",
      );
      expect(call).toBeDefined();
      expect(call!.body.length).toBeLessThanOrEqual(20000);
      expect(call!.body).toContain("BatchDialer result: Interested");
    });

    it("keeps legacy client and contact actions connected to one canonical sales business", async () => {
      await expect(
        saveClientAction(
          initialActionState,
          form({ name: "Legacy client fixture", status: "active", notes: "" }),
        ),
      ).rejects.toThrow("fixture_redirect:/dashboard/clients/");
      const client = (await pool.query("SELECT id,business_id FROM clients"))
        .rows[0];
      expect(client.business_id).not.toBeNull();
      expect(
        (
          await pool.query("SELECT client_id FROM crm_businesses WHERE id=$1", [
            client.business_id,
          ])
        ).rows[0].client_id,
      ).toBe(client.id);
      expect(
        await saveContactAction(
          initialActionState,
          form({
            clientId: client.id,
            name: "Legacy Contact",
            email: "legacy@fixture.example.test",
            phone: "(212) 555-0199",
            title: "",
            isPrimary: "on",
          }),
        ),
      ).toMatchObject({ status: "success" });
      const contact = (await pool.query("SELECT id,business_id FROM contacts"))
        .rows[0];
      expect(contact.business_id).toBe(client.business_id);
      const opportunityId = await createOpportunity(
        member,
        prospect({
          email: undefined,
          websiteUrl: undefined,
          phone: "+12125550199",
        }),
      );
      const opportunity = await record(opportunityId);
      expect(opportunity.business.id).toBe(client.business_id);
      expect(opportunity.contact?.id).toBe(contact.id);
      expect(
        await saveClientAction(
          initialActionState,
          form({
            clientId: client.id,
            name: "Updated legacy client fixture",
            status: "active",
            notes: "",
          }),
        ),
      ).toMatchObject({ status: "success" });
      expect((await record(opportunityId)).business.name).toBe(
        "Updated legacy client fixture",
      );
      const sale = await convertOpportunity(owner, {
        opportunityId,
        projectName: "Existing client additional website",
      });
      expect(sale.clientId).toBe(client.id);
      expect(await count("clients")).toBe(1);
      expect(await count("contacts")).toBe(1);
      expect(await count("crm_businesses")).toBe(1);
    });

    it("recognizes a legacy client by its www site domain without creating a cold-prospect duplicate", async () => {
      await expect(
        saveClientAction(
          initialActionState,
          form({
            name: "Domain-only legacy client",
            status: "active",
            notes: "",
          }),
        ),
      ).rejects.toThrow("fixture_redirect:/dashboard/clients/");
      const client = (await pool.query("SELECT id,business_id FROM clients"))
        .rows[0];
      await pool.query(
        "INSERT INTO sites(id,workspace_id,client_id,name,url,environment,status) VALUES($1,$2,$3,'Existing legacy site','https://www.legacy-domain.example.test/path','production','active')",
        [randomUUID(), workspaceId, client.id],
      );
      expect(
        (
          await pool.query(
            "SELECT normalized_domain FROM crm_businesses WHERE id=$1",
            [client.business_id],
          )
        ).rows[0].normalized_domain,
      ).toBeNull();
      const result = await importSalesCsv(
        owner,
        imported(
          "Business Name,Website\nResearched legacy business,https://legacy-domain.example.test",
          "Domain-only researched list",
        ),
        "prospects",
      );
      expect(result).toMatchObject({ created: 0, matched: 0, skipped: 1 });
      expect(result.issues.join(" ")).toContain("existing client");
      expect(await count("crm_businesses")).toBe(1);
      expect(await count("clients")).toBe(1);
      expect(await count("crm_opportunities")).toBe(0);
      expect(await count("crm_list_members")).toBe(0);
    });

    it.each([true, false])(
      "preserves the legacy inquiry create-site flag (%s) and reuses its sales record",
      async (createSite) => {
        const leadId = randomUUID();
        await pool.query(
          "INSERT INTO leads(id,workspace_id,name,organization,email,phone,website_url,description) VALUES($1,$2,'Legacy lead contact','Legacy lead business','legacy-lead@fixture.example.test','2125550100','https://legacy-lead.example.test','Website inquiry ready for delivery.')",
          [leadId, workspaceId],
        );
        const opportunityId = await linkInquiry(owner, leadId);
        const values = {
          leadId,
          clientName: "Approved client legal name",
          projectName: "Legacy inquiry project",
          projectSummary: "Preserve the existing conversion workflow.",
          ...(createSite ? { createSite: "on" } : {}),
        };
        await expect(
          convertLeadAction(initialActionState, form(values)),
        ).rejects.toThrow("fixture_redirect:/dashboard/clients/");
        const converted = await record(opportunityId);
        expect(converted.stage).toBe("won");
        expect(converted.business.name).toBe("Approved client legal name");
        expect(
          (
            await pool.query("SELECT name FROM clients WHERE id=$1", [
              converted.clientId,
            ])
          ).rows[0].name,
        ).toBe("Approved client legal name");
        expect(await count("crm_opportunities")).toBe(1);
        expect(await count("crm_businesses")).toBe(1);
        expect(await count("clients")).toBe(1);
        expect(await count("contacts")).toBe(1);
        expect(await count("projects")).toBe(1);
        const project = (
          await pool.query(
            "SELECT client_id,site_id FROM projects WHERE id=$1",
            [converted.projectId],
          )
        ).rows[0];
        const sites = await pool.query(
          "SELECT id,client_id,url FROM sites WHERE client_id=$1",
          [converted.clientId],
        );
        expect(sites.rowCount).toBe(createSite ? 1 : 0);
        expect(project.client_id).toBe(converted.clientId);
        expect(project.site_id).toBe(createSite ? sites.rows[0].id : null);
        if (createSite)
          expect(sites.rows[0].url).toBe("https://legacy-lead.example.test");
        expect(
          await convertLeadAction(initialActionState, form(values)),
        ).toMatchObject({ status: "error" });
        expect(await count("projects")).toBe(1);
      },
    );
  },
);
