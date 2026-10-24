import { leadDisplayName } from "@/lib/operations/format";
import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeSales } from "./data";
import {
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  parseProspectCsv,
  type ImportRow,
} from "./import";
import { importFingerprint } from "./import-fingerprint";
import {
  activitySchema,
  completeTaskSchema,
  convertOpportunitySchema,
  createOpportunitySchema,
  mockupSchema,
  preferenceSchema,
  requestMockupSchema,
  taskSchema,
  updateOpportunitySchema,
  type CreateOpportunityInput,
} from "./validation";

export class SalesInputError extends Error {}
type BusinessRow = {
  id: string;
  name: string;
  client_id: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  normalized_domain: string | null;
};
type OpportunityRow = {
  id: string;
  business_id: string;
  primary_contact_id: string | null;
  lead_id: string | null;
  stage: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
};
const missing = () =>
  new SalesInputError("That record is no longer available in this workspace.");
async function transaction<T>(
  context: DashboardContext,
  work: (db: PoolClient) => Promise<T>,
) {
  await authorizeSales(context, true);
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `agency-sales:${context.workspace.id}`,
    ]);
    // Recheck membership after obtaining the lock; UI and caller-provided roles are not authority.
    const access = await db.query(
      "SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin','member') AND w.status='active'",
      [context.workspace.id, context.user.id],
    );
    if (!access.rowCount)
      throw new SalesInputError(
        "Your workspace access no longer allows changes.",
      );
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
async function owner(
  db: PoolClient,
  context: DashboardContext,
  userId?: string,
) {
  if (!userId) return;
  const r = await db.query(
    "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role<>'viewer'",
    [context.workspace.id, userId],
  );
  if (!r.rowCount)
    throw new SalesInputError("Choose an active teammate with editing access.");
}
async function opportunity(
  db: PoolClient,
  context: DashboardContext,
  id: string,
) {
  const r = await db.query<OpportunityRow>(
    "SELECT o.id,o.business_id,o.primary_contact_id,o.lead_id,o.stage,o.client_id,o.project_id,o.title FROM crm_opportunities o JOIN crm_businesses b ON b.id=o.business_id AND b.workspace_id=o.workspace_id WHERE o.id=$1 AND o.workspace_id=$2 AND b.anonymized_at IS NULL FOR UPDATE OF o",
    [id, context.workspace.id],
  );
  if (!r.rows[0]) throw missing();
  return r.rows[0];
}
async function audit(
  db: PoolClient,
  context: DashboardContext,
  action: string,
  id: string,
  targetType = "sales_opportunity",
  metadata?: Record<string, unknown>,
) {
  await insertAuditLog(db, {
    workspaceId: context.workspace.id,
    actorUserId: context.user.id,
    action,
    targetType,
    targetId: id,
    metadata,
  });
}
async function addActivity(
  db: PoolClient,
  context: DashboardContext,
  o: OpportunityRow,
  input: {
    kind: string;
    body: string;
    direction?: string;
    outcome?: string;
    source?: string;
    occurredAt?: string;
    externalKey?: string;
  },
) {
  const result = await db.query(
    `INSERT INTO crm_activities(id,workspace_id,opportunity_id,business_id,actor_user_id,kind,source,direction,outcome,body,occurred_at,external_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,now()),$12) ON CONFLICT (workspace_id,source,external_key) WHERE external_key IS NOT NULL DO NOTHING RETURNING id`,
    [
      randomUUID(),
      context.workspace.id,
      o.id,
      o.business_id,
      context.user.id,
      input.kind,
      input.source ?? "manual",
      input.direction ?? "internal",
      input.outcome ?? null,
      input.body,
      input.occurredAt ?? null,
      input.externalKey ?? null,
    ],
  );
  return Boolean(result.rowCount);
}
function identity(input: {
  email?: string;
  phone?: string;
  websiteUrl?: string;
}) {
  const email = input.email ? normalizeEmail(input.email) : null,
    phone = input.phone ? normalizePhone(input.phone) : null,
    domain = input.websiteUrl ? normalizeDomain(input.websiteUrl) : null;
  if (input.email && !email)
    throw new SalesInputError("Use a valid email address.");
  if (input.phone && !phone)
    throw new SalesInputError(
      "Use a US phone number or an international number starting with +.",
    );
  if (input.websiteUrl && !domain)
    throw new SalesInputError("Use a valid business website address.");
  return { email, phone, domain };
}
async function findBusiness(
  db: PoolClient,
  context: DashboardContext,
  input: { email?: string; phone?: string; websiteUrl?: string },
  excludeBusinessId?: string,
) {
  const { email, phone, domain } = identity(input);
  // Match canonical account identities and its existing contact records, never business names.
  const r = await db.query<BusinessRow>(
    `SELECT DISTINCT b.id,b.name,b.client_id,b.normalized_phone,b.normalized_email,b.normalized_domain FROM crm_businesses b LEFT JOIN contacts c ON c.business_id=b.id AND c.workspace_id=b.workspace_id LEFT JOIN sites s ON s.client_id=b.client_id AND s.workspace_id=b.workspace_id WHERE b.workspace_id=$1 AND ($5::uuid IS NULL OR b.id<>$5) AND (($2::text IS NOT NULL AND (b.normalized_email=$2 OR lower(c.email)=$2)) OR ($3::text IS NOT NULL AND (b.normalized_phone=$3 OR crm_normalized_phone(c.phone)=$3)) OR ($4::text IS NOT NULL AND (b.normalized_domain=$4 OR lower(substring(s.url from '^https?://(?:www\\.)?([^/:?#]+)'))=$4)))`,
    [context.workspace.id, email, phone, domain, excludeBusinessId ?? null],
  );
  if (r.rows.length > 1)
    throw new SalesInputError(
      "Those contact details match multiple businesses. Review the existing records before importing or creating this opportunity.",
    );
  const found = r.rows[0] ?? null;
  if (
    found &&
    ((domain &&
      found.normalized_domain &&
      domain !== found.normalized_domain) ||
      (email &&
        found.normalized_email &&
        email !== found.normalized_email &&
        phone &&
        found.normalized_phone &&
        phone !== found.normalized_phone))
  )
    throw new SalesInputError(
      "Those details conflict with an existing business. Review it before linking this record.",
    );
  return found;
}
async function ensureBusiness(
  db: PoolClient,
  context: DashboardContext,
  input: Partial<CreateOpportunityInput> & { businessName: string },
) {
  const found = await findBusiness(db, context, input);
  if (found) return { business: found, created: false };
  const { email, phone, domain } = identity(input),
    id = randomUUID();
  await db.query(
    `INSERT INTO crm_businesses(id,workspace_id,name,website_url,normalized_domain,normalized_phone,normalized_email,industry,state,website_status,score,research_url,research_notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      context.workspace.id,
      input.businessName,
      input.websiteUrl ?? null,
      domain,
      phone,
      email,
      input.industry ?? null,
      input.state ?? null,
      input.websiteStatus ?? "unknown",
      input.score ?? null,
      input.researchUrl ?? null,
      input.notes ?? null,
    ],
  );
  await audit(db, context, "business.created", id, "business");
  return {
    business: {
      id,
      name: input.businessName,
      client_id: null,
      normalized_email: email,
      normalized_phone: phone,
      normalized_domain: domain,
    },
    created: true,
  };
}
async function ensureContact(
  db: PoolClient,
  context: DashboardContext,
  business: BusinessRow,
  input: { contactName?: string; email?: string; phone?: string },
) {
  const { email, phone } = identity(input);
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM contacts WHERE workspace_id=$1 AND business_id=$2 AND (($3::text IS NOT NULL AND lower(email)=$3) OR ($4::text IS NOT NULL AND crm_normalized_phone(phone)=$4)) ORDER BY is_primary DESC,created_at LIMIT 2`,
    [context.workspace.id, business.id, email, phone],
  );
  if (existing.rows.length > 1)
    throw new SalesInputError(
      "The contact details match different people. Review the business contacts before continuing.",
    );
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await db.query(
    `INSERT INTO contacts(id,workspace_id,business_id,client_id,name,email,phone,is_primary) VALUES($1,$2,$3,$4,$5,$6,$7,NOT EXISTS(SELECT 1 FROM contacts WHERE business_id=$3 AND workspace_id=$2))`,
    [
      id,
      context.workspace.id,
      business.id,
      business.client_id,
      input.contactName ?? "Business contact",
      email,
      phone,
    ],
  );
  return id;
}
async function insertOpportunity(
  db: PoolClient,
  context: DashboardContext,
  business: BusinessRow,
  contactId: string,
  input: {
    title: string;
    stage?: string;
    ownerUserId?: string;
    value?: number;
    offerType?: string;
    source?: string;
    leadId?: string;
  },
) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO crm_opportunities(id,workspace_id,business_id,primary_contact_id,lead_id,owner_user_id,title,stage,value_cents,offer_type,source,client_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      context.workspace.id,
      business.id,
      contactId,
      input.leadId ?? null,
      input.ownerUserId ?? null,
      input.title,
      input.stage ?? "prospect",
      input.value === undefined ? null : Math.round(input.value * 100),
      input.offerType ?? "standard",
      input.source ?? "manual",
      business.client_id,
    ],
  );
  await audit(db, context, "opportunity.created", id);
  return id;
}
export async function createOpportunity(
  context: DashboardContext,
  input: unknown,
) {
  const data = createOpportunitySchema.parse(input);
  return transaction(context, async (db) => {
    await owner(db, context, data.ownerUserId);
    const { business } = await ensureBusiness(db, context, data);
    const contactId = await ensureContact(db, context, business, data);
    return insertOpportunity(db, context, business, contactId, data);
  });
}
export async function updateOpportunity(
  context: DashboardContext,
  input: unknown,
) {
  const data = updateOpportunitySchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    await owner(db, context, data.ownerUserId);
    const versions = (
      await db.query<{
        opportunity_updated_at: Date;
        business_updated_at: Date;
      }>(
        `SELECT o.updated_at AS opportunity_updated_at,b.updated_at AS business_updated_at FROM crm_opportunities o JOIN crm_businesses b ON b.id=o.business_id AND b.workspace_id=o.workspace_id WHERE o.id=$1 AND o.workspace_id=$2 FOR UPDATE OF b`,
        [o.id, context.workspace.id],
      )
    ).rows[0];
    if (
      versions.opportunity_updated_at.toISOString() !==
        new Date(data.expectedUpdatedAt).toISOString() ||
      versions.business_updated_at.toISOString() !==
        new Date(data.expectedBusinessUpdatedAt).toISOString()
    )
      throw new SalesInputError(
        "This record changed while you were editing. Reload to review the latest version before saving.",
      );
    if (data.stage === "won" && o.stage !== "won")
      throw new SalesInputError(
        "Use Complete sale to create the client and project together.",
      );
    if (o.project_id && data.stage !== "won")
      throw new SalesInputError(
        "This sale has a client project. Keep its won state and manage delivery from Projects.",
      );
    const normalized = identity(data),
      collision = await findBusiness(db, context, data, o.business_id);
    if (collision)
      throw new SalesInputError(
        "Those details belong to another business. Review its record before making this change.",
      );
    await db.query(
      `UPDATE crm_businesses SET name=$1,website_url=$2,normalized_domain=$3,normalized_phone=$4,normalized_email=$5,industry=$6,state=$7,website_status=$8,score=$9,research_url=$10,research_notes=$11,updated_at=now() WHERE id=$12 AND workspace_id=$13`,
      [
        data.businessName,
        data.websiteUrl ?? null,
        normalized.domain,
        normalized.phone,
        normalized.email,
        data.industry ?? null,
        data.state ?? null,
        data.websiteStatus,
        data.score ?? null,
        data.researchUrl ?? null,
        data.notes ?? null,
        o.business_id,
        context.workspace.id,
      ],
    );
    if (o.primary_contact_id) {
      const c = identity({
        email: data.contactEmail,
        phone: data.contactPhone,
      });
      await db.query(
        "UPDATE contacts SET name=$1,email=$2,phone=$3,updated_at=now() WHERE id=$4 AND business_id=$5 AND workspace_id=$6",
        [
          data.contactName ?? "Business contact",
          c.email,
          c.phone,
          o.primary_contact_id,
          o.business_id,
          context.workspace.id,
        ],
      );
    }
    await db.query(
      `UPDATE crm_opportunities SET title=$1,stage=$2,owner_user_id=$3,value_cents=$4,offer_type=$5,closed_at=CASE WHEN $2 IN ('won','lost','archived') THEN COALESCE(closed_at,now()) ELSE NULL END,updated_at=now() WHERE id=$6 AND workspace_id=$7`,
      [
        data.title,
        data.stage,
        data.ownerUserId ?? null,
        data.value === undefined ? null : Math.round(data.value * 100),
        data.offerType,
        o.id,
        context.workspace.id,
      ],
    );
    await db.query(
      "UPDATE clients SET name=$1,updated_at=now() WHERE business_id=$2 AND workspace_id=$3",
      [data.businessName, o.business_id, context.workspace.id],
    );
    if (o.stage !== data.stage)
      await addActivity(db, context, o, {
        kind: "outcome",
        source: "system",
        body: `Sales stage changed from ${o.stage} to ${data.stage}.`,
      });
    await audit(db, context, "opportunity.updated", o.id, "sales_opportunity", {
      stage: data.stage,
      offerType: data.offerType,
    });
  });
}
export async function logActivity(context: DashboardContext, input: unknown) {
  const data = activitySchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    await addActivity(db, context, o, data);
    await db.query(
      "UPDATE crm_opportunities SET updated_at=now() WHERE id=$1 AND workspace_id=$2",
      [o.id, context.workspace.id],
    );
    await audit(
      db,
      context,
      "communication.logged",
      o.id,
      "sales_opportunity",
      { kind: data.kind },
    );
  });
}
export async function saveTask(context: DashboardContext, input: unknown) {
  const data = taskSchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    await owner(db, context, data.ownerUserId);
    if (data.taskId) {
      const result = await db.query(
        `UPDATE crm_tasks SET title=$1,kind=$2,owner_user_id=$3,due_at=$4,end_at=$5,location=$6,notes=$7,updated_at=now() WHERE id=$8 AND opportunity_id=$9 AND workspace_id=$10 AND status='open'`,
        [
          data.title,
          data.kind,
          data.ownerUserId ?? null,
          data.dueAt,
          data.endAt ?? null,
          data.location ?? null,
          data.notes ?? null,
          data.taskId,
          o.id,
          context.workspace.id,
        ],
      );
      if (!result.rowCount) throw missing();
    } else
      await db.query(
        `INSERT INTO crm_tasks(id,workspace_id,opportunity_id,owner_user_id,kind,title,due_at,end_at,location,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          randomUUID(),
          context.workspace.id,
          o.id,
          data.ownerUserId ?? null,
          data.kind,
          data.title,
          data.dueAt,
          data.endAt ?? null,
          data.location ?? null,
          data.notes ?? null,
        ],
      );
    await audit(db, context, "sales_task.saved", o.id);
  });
}
export async function completeTask(context: DashboardContext, input: unknown) {
  const data = completeTaskSchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId),
      r = await db.query(
        "UPDATE crm_tasks SET status=$1,completed_at=CASE WHEN $1='completed' THEN now() ELSE NULL END,updated_at=now() WHERE id=$2 AND opportunity_id=$3 AND workspace_id=$4 AND status='open' RETURNING title",
        [data.status, data.taskId, o.id, context.workspace.id],
      );
    if (!r.rows[0]) throw missing();
    await addActivity(db, context, o, {
      kind: "outcome",
      body: `${data.status === "completed" ? "Completed" : "Cancelled"}: ${r.rows[0].title}. ${data.outcome}`,
    });
    await audit(
      db,
      context,
      "sales_task." + data.status,
      data.taskId,
      "sales_task",
    );
  });
}
export async function requestMockup(context: DashboardContext, input: unknown) {
  const data = requestMockupSchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    await owner(db, context, data.ownerUserId);
    if (["won", "lost", "archived"].includes(o.stage))
      throw new SalesInputError(
        "Reopen an active opportunity before requesting a mockup.",
      );
    const r = await db.query(
      `INSERT INTO crm_mockups(id,workspace_id,opportunity_id,requested_by_user_id,owner_user_id,brief) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(opportunity_id) DO NOTHING RETURNING id`,
      [
        randomUUID(),
        context.workspace.id,
        o.id,
        context.user.id,
        data.ownerUserId ?? null,
        data.brief,
      ],
    );
    if (!r.rowCount)
      throw new SalesInputError(
        "A mockup request already exists. Update its brief or progress below.",
      );
    await db.query(
      "UPDATE crm_opportunities SET stage='mockup',updated_at=now() WHERE id=$1 AND workspace_id=$2",
      [o.id, context.workspace.id],
    );
    await addActivity(db, context, o, {
      kind: "note",
      source: "system",
      body: "Website mockup requested. The brief is in the mockup queue.",
    });
    await audit(db, context, "mockup.requested", o.id);
  });
}
export async function saveMockup(context: DashboardContext, input: unknown) {
  const data = mockupSchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    await owner(db, context, data.ownerUserId);
    const r = await db.query(
      `UPDATE crm_mockups SET status=$1,owner_user_id=$2,brief=$3,preview_url=$4,repository_url=$5,project_path=$6,qa_notes=$7,updated_at=now() WHERE opportunity_id=$8 AND workspace_id=$9 RETURNING id`,
      [
        data.status,
        data.ownerUserId ?? null,
        data.brief,
        data.previewUrl ?? null,
        data.repositoryUrl ?? null,
        data.projectPath ?? null,
        data.qaNotes ?? null,
        o.id,
        context.workspace.id,
      ],
    );
    if (!r.rowCount) throw missing();
    await addActivity(db, context, o, {
      kind: "note",
      source: "system",
      body: `Website mockup updated: ${data.status}.`,
    });
    await audit(db, context, "mockup.updated", r.rows[0].id, "mockup", {
      status: data.status,
    });
  });
}
export async function convertOpportunity(
  context: DashboardContext,
  input: unknown,
) {
  const data = convertOpportunitySchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    if (o.project_id)
      return { clientId: o.client_id!, projectId: o.project_id };
    if (["lost", "archived"].includes(o.stage))
      throw new SalesInputError(
        "Reopen the opportunity before completing this sale.",
      );
    const business = (
      await db.query<BusinessRow>(
        "SELECT id,name,client_id,normalized_email,normalized_phone,normalized_domain FROM crm_businesses WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
        [o.business_id, context.workspace.id],
      )
    ).rows[0];
    if (data.clientName) {
      business.name = data.clientName;
      await db.query(
        "UPDATE crm_businesses SET name=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3",
        [data.clientName, business.id, context.workspace.id],
      );
      if (business.client_id)
        await db.query(
          "UPDATE clients SET name=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3",
          [data.clientName, business.client_id, context.workspace.id],
        );
    }
    let clientId = business.client_id;
    if (!clientId) {
      clientId = randomUUID();
      await db.query(
        "INSERT INTO clients(id,workspace_id,business_id,name,status) VALUES($1,$2,$3,$4,'active')",
        [clientId, context.workspace.id, business.id, business.name],
      );
      await db.query(
        "UPDATE crm_businesses SET client_id=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3",
        [clientId, business.id, context.workspace.id],
      );
      await audit(db, context, "client.created", clientId, "client");
    }
    await db.query(
      "UPDATE contacts SET client_id=$1,updated_at=now() WHERE business_id=$2 AND workspace_id=$3 AND client_id IS NULL",
      [clientId, business.id, context.workspace.id],
    );
    let siteId: string | null = null;
    if (data.createSite) {
      const website = (
        await db.query<{ website_url: string | null }>(
          "SELECT website_url FROM crm_businesses WHERE id=$1 AND workspace_id=$2",
          [business.id, context.workspace.id],
        )
      ).rows[0].website_url;
      if (website) {
        const site = (
          await db.query<{ id: string; client_id: string | null }>(
            "SELECT id,client_id FROM sites WHERE workspace_id=$1 AND url=$2 FOR UPDATE",
            [context.workspace.id, website],
          )
        ).rows[0];
        if (site?.client_id && site.client_id !== clientId)
          throw new SalesInputError(
            "That website is already assigned to a different client. Review its site record first.",
          );
        siteId = site?.id ?? randomUUID();
        if (site)
          await db.query(
            "UPDATE sites SET client_id=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3",
            [clientId, siteId, context.workspace.id],
          );
        else
          await db.query(
            "INSERT INTO sites(id,workspace_id,client_id,name,url,environment,status) VALUES($1,$2,$3,$4,$5,'production','active')",
            [siteId, context.workspace.id, clientId, business.name, website],
          );
        await audit(
          db,
          context,
          site ? "site.client_linked" : "site.created",
          siteId,
          "site",
        );
      }
    }
    const projectId = randomUUID();
    await db.query(
      "INSERT INTO projects(id,workspace_id,client_id,site_id,owner_user_id,name,status,summary,started_at) VALUES($1,$2,$3,$4,$5,$6,'planned',$7,now())",
      [
        projectId,
        context.workspace.id,
        clientId,
        siteId,
        context.user.id,
        data.projectName,
        data.projectSummary ?? null,
      ],
    );
    await db.query(
      "UPDATE crm_opportunities SET stage='won',client_id=$1,project_id=$2,closed_at=now(),updated_at=now() WHERE id=$3 AND workspace_id=$4",
      [clientId, projectId, o.id, context.workspace.id],
    );
    if (o.lead_id)
      await db.query(
        "UPDATE leads SET status='won',client_id=$1,business_id=$2,converted_at=COALESCE(converted_at,now()),next_action=NULL,next_action_at=NULL,updated_at=now() WHERE id=$3 AND workspace_id=$4",
        [clientId, business.id, o.lead_id, context.workspace.id],
      );
    await addActivity(db, context, o, {
      kind: "outcome",
      source: "system",
      body: "Sale completed. The existing client workspace now contains the project and linked contact information.",
    });
    await audit(db, context, "opportunity.won", o.id, "sales_opportunity", {
      clientId,
      projectId,
    });
    await audit(db, context, "project.created", projectId, "project");
    return { clientId, projectId };
  });
}

export async function linkInquiry(context: DashboardContext, leadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) throw missing();
  return transaction(context, async (db) => {
    const existing = await db.query<{ id: string }>(
      "SELECT id FROM crm_opportunities WHERE lead_id=$1 AND workspace_id=$2",
      [leadId, context.workspace.id],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const r = await db.query<{
      id: string;
      organization: string;
      name: string;
      email: string | null;
      source: string;
      phone: string | null;
      website_url: string | null;
      description: string | null;
      status: string;
      client_id: string | null;
      business_id: string | null;
      owner_user_id: string | null;
    }>(
      "SELECT id,organization,name,email,phone,website_url,description,status,client_id,business_id,owner_user_id,source FROM leads WHERE id=$1 AND workspace_id=$2 AND anonymized_at IS NULL FOR UPDATE",
      [leadId, context.workspace.id],
    );
    const l = r.rows[0];
    if (!l) throw missing();
    // An existing converted lead reuses its client's canonical business.
    let business: BusinessRow | undefined;
    if (l.client_id)
      business = (
        await db.query<BusinessRow>(
          "SELECT id,name,client_id,normalized_phone,normalized_email,normalized_domain FROM crm_businesses WHERE client_id=$1 AND workspace_id=$2",
          [l.client_id, context.workspace.id],
        )
      ).rows[0];
    if (!business)
      business = (
        await ensureBusiness(db, context, {
          businessName: leadDisplayName(l),
          email: l.email ?? undefined,
          phone: l.phone ?? undefined,
          websiteUrl: l.website_url ?? undefined,
          notes: l.description ?? undefined,
        })
      ).business;
    const contactId = await ensureContact(db, context, business, {
        contactName: l.name,
        email: l.email ?? undefined,
        phone: l.phone ?? undefined,
      }),
      id = await insertOpportunity(db, context, business, contactId, {
        title: `${l.source === "manual" ? "Lead" : "Website inquiry"} — ${leadDisplayName(l)}`,
        stage:
          l.status === "won"
            ? "won"
            : l.status === "lost"
              ? "lost"
              : "interested",
        source: l.source,
        leadId,
        ownerUserId: l.owner_user_id ?? undefined,
      });
    await db.query(
      "UPDATE leads SET business_id=$1 WHERE id=$2 AND workspace_id=$3",
      [business.id, leadId, context.workspace.id],
    );
    await addActivity(
      db,
      context,
      {
        id,
        business_id: business.id,
        primary_contact_id: contactId,
        lead_id: leadId,
        stage: "interested",
        client_id: l.client_id,
        project_id: null,
        title: leadDisplayName(l),
      },
      {
        kind: "note",
        source: "system",
        body: l.description ?? "Lead linked to the sales workspace.",
      },
    );
    return id;
  });
}

export async function setChannelPreference(
  context: DashboardContext,
  input: unknown,
) {
  const data = preferenceSchema.parse(input);
  return transaction(context, async (db) => {
    const o = await opportunity(db, context, data.opportunityId);
    const address =
      data.channel === "email"
        ? normalizeEmail(data.address)
        : normalizePhone(data.address);
    if (!address) throw new SalesInputError("Use a valid contact address.");
    const known = await db.query(
      `SELECT 1 FROM crm_businesses b LEFT JOIN contacts c ON c.business_id=b.id AND c.workspace_id=b.workspace_id WHERE b.id=$1 AND b.workspace_id=$2 AND ($3 IN (b.normalized_email,b.normalized_phone,lower(c.email),c.phone) OR crm_normalized_phone(c.phone)=$3 AND $4<>'email')`,
      [o.business_id, context.workspace.id, address, data.channel],
    );
    if (!known.rowCount)
      throw new SalesInputError(
        "Choose a saved contact address for this business.",
      );
    await db.query(
      `INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence,actor_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,channel,normalized_address) DO UPDATE SET status=EXCLUDED.status,evidence=EXCLUDED.evidence,actor_user_id=EXCLUDED.actor_user_id,updated_at=now()`,
      [
        context.workspace.id,
        data.channel,
        address,
        data.status,
        data.evidence,
        context.user.id,
      ],
    );
    await addActivity(db, context, o, {
      kind: "note",
      source: "system",
      body: `${data.channel} contact preference: ${data.status}. ${data.evidence}`,
    });
    await audit(
      db,
      context,
      "communication.preference_updated",
      o.id,
      "sales_opportunity",
      { channel: data.channel, status: data.status },
    );
  });
}

type ImportResult = {
  created: number;
  matched: number;
  skipped: number;
  suppressed: number;
  listId: string | null;
  issues: string[];
};
export async function importSalesCsv(
  context: DashboardContext,
  input: {
    csv: string;
    listName: string;
    ownerUserId?: string;
    reviewed: boolean;
  },
  mode: "prospects" | "dialer",
): Promise<ImportResult> {
  if (!input.reviewed)
    throw new SalesInputError(
      "Review the mapped rows and confirm the import first.",
    );
  if (Buffer.byteLength(input.csv, "utf8") > 750000)
    throw new SalesInputError(
      "Import up to 750 KB at a time. Split this calling list into smaller files.",
    );
  if (input.listName.trim().length < 2 || input.listName.length > 200)
    throw new SalesInputError(
      "Give this import a name between 2 and 200 characters.",
    );
  const parsed = parseProspectCsv(input.csv, { mode });
  if (parsed.errors.length)
    throw new SalesInputError(
      `Fix the CSV before importing. Row ${parsed.errors[0].row}: ${parsed.errors[0].message}`,
    );
  if (!parsed.rows.length || parsed.rows.length > 1000)
    throw new SalesInputError("Import between 1 and 1,000 rows at a time.");
  const fileHash = importFingerprint(
    `${mode}\n${importFingerprint(input.csv)}`,
  );
  return transaction(context, async (db) => {
    await owner(db, context, input.ownerUserId);
    const result: ImportResult = {
      created: 0,
      matched: 0,
      skipped: 0,
      suppressed: 0,
      listId: null,
      issues: [],
    };
    if (mode === "prospects") {
      const prior = await db.query<{ id: string }>(
        "SELECT id FROM crm_lists WHERE workspace_id=$1 AND file_hash=$2",
        [context.workspace.id, fileHash],
      );
      if (prior.rows[0])
        return {
          ...result,
          matched: parsed.rows.length,
          listId: prior.rows[0].id,
          issues: ["This exact file was already imported; no records changed."],
        };
      result.listId = randomUUID();
      await db.query(
        "INSERT INTO crm_lists(id,workspace_id,name,source,file_hash,created_by) VALUES($1,$2,$3,'research',$4,$5)",
        [
          result.listId,
          context.workspace.id,
          input.listName.trim(),
          fileHash,
          context.user.id,
        ],
      );
    }
    for (const row of parsed.rows) {
      try {
        if (mode === "dialer") {
          await importDialerRow(db, context, row, result);
          continue;
        }
        const { business, created } = await ensureBusiness(db, context, {
          ...row,
          websiteStatus:
            row.websiteStatus as CreateOpportunityInput["websiteStatus"],
          notes: row.notes,
        });
        if (business.client_id) {
          result.skipped++;
          if (result.issues.length < 8)
            result.issues.push(
              `Row ${row.rowNumber}: existing client preserved; create a new opportunity deliberately for additional services.`,
            );
          continue;
        }
        const existing = await db.query<OpportunityRow>(
          "SELECT id,business_id,primary_contact_id,lead_id,stage,client_id,project_id,title FROM crm_opportunities WHERE business_id=$1 AND workspace_id=$2 AND stage NOT IN ('won','lost','archived') ORDER BY created_at LIMIT 1",
          [business.id, context.workspace.id],
        );
        let id = existing.rows[0]?.id;
        if (!id) {
          const contactId = await ensureContact(db, context, business, row);
          id = await insertOpportunity(db, context, business, contactId, {
            title: `Website — ${business.name}`,
            ownerUserId: input.ownerUserId,
            source: "research",
          });
        }
        const added = await db.query(
          `INSERT INTO crm_list_members(list_id,workspace_id,business_id,opportunity_id,source_row,research_data) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(list_id,business_id) DO NOTHING`,
          [
            result.listId,
            context.workspace.id,
            business.id,
            id,
            row.rowNumber,
            JSON.stringify(row),
          ],
        );
        if (!added.rowCount) {
          result.skipped++;
          continue;
        }
        if (created) result.created++;
        else result.matched++;
      } catch (error) {
        if (!(error instanceof SalesInputError)) throw error;
        result.skipped++;
        if (result.issues.length < 8)
          result.issues.push(`Row ${row.rowNumber}: ${error.message}`);
      }
    }
    await audit(
      db,
      context,
      mode === "prospects"
        ? "prospect_list.imported"
        : "dialer_results.imported",
      result.listId ?? fileHash,
      "sales_import",
      {
        created: result.created,
        matched: result.matched,
        skipped: result.skipped,
      },
    );
    return result;
  });
}
async function importDialerRow(
  db: PoolClient,
  context: DashboardContext,
  row: ImportRow,
  result: ImportResult,
) {
  const outcome = row.outcome?.toLowerCase().replace(/[_-]/g, " ").trim() ?? "";
  const optedOut = /^(dnc|do not call|stop|opt out|unsubscribe)$/.test(outcome);
  // A validated opt-out is durable even when the business is not yet imported,
  // its sale is closed, or multiple open opportunities make history ambiguous.
  if (optedOut && row.phone) {
    const channel =
      outcome === "stop" || outcome === "unsubscribe" ? "sms" : "call";
    const changed = await db.query(
      `INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence,actor_user_id) VALUES($1,$2,$3,'blocked',$4,$5) ON CONFLICT(workspace_id,channel,normalized_address) DO UPDATE SET status='blocked',evidence=EXCLUDED.evidence,actor_user_id=EXCLUDED.actor_user_id,updated_at=now() WHERE crm_channel_preferences.status<>'blocked' RETURNING channel`,
      [
        context.workspace.id,
        channel,
        row.phone,
        `BatchDialer: ${row.outcome}`,
        context.user.id,
      ],
    );
    if (changed.rowCount) {
      result.suppressed++;
      await audit(
        db,
        context,
        "communication.imported_opt_out",
        createHash("sha256").update(row.phone).digest("hex"),
        "channel_preference",
        { channel },
      );
    }
  }
  const business = await findBusiness(db, context, row);
  if (!business) {
    result.skipped++;
    if (result.issues.length < 8)
      result.issues.push(
        `Row ${row.rowNumber}: no matching saved business; import the prospect list first.`,
      );
    return;
  }
  const rows = await db.query<OpportunityRow>(
    "SELECT id,business_id,primary_contact_id,lead_id,stage,client_id,project_id,title FROM crm_opportunities WHERE business_id=$1 AND workspace_id=$2 AND stage NOT IN ('won','lost','archived') ORDER BY created_at DESC LIMIT 2",
    [business.id, context.workspace.id],
  );
  if (rows.rows.length !== 1) {
    result.skipped++;
    if (result.issues.length < 8)
      result.issues.push(
        `Row ${row.rowNumber}: select an opportunity manually; this business has ${rows.rows.length ? "multiple open sales" : "no open sale"}.`,
      );
    return;
  }
  const o = rows.rows[0],
    key = createHash("sha256")
      .update(
        JSON.stringify([
          row.externalId ?? null,
          row.phone ?? null,
          row.email ?? null,
          row.occurredAt ?? null,
          row.outcome?.toLowerCase(),
        ]),
      )
      .digest("hex");
  const added = await addActivity(db, context, o, {
    kind: "call",
    source: "batchdialer",
    direction: "outbound",
    outcome: row.outcome,
    body: [
      `BatchDialer result: ${row.outcome}`,
      !row.occurredAt
        ? "No call time supplied; the displayed time is when this result was imported."
        : null,
      row.notes,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 20000),
    occurredAt: row.occurredAt,
    externalKey: key,
  });
  if (!added) {
    result.matched++;
    return;
  }
  result.created++;
  const stage = optedOut
    ? o.stage
    : /^(interested|hot|warm|qualified|mockup requested)$/.test(outcome)
      ? "interested"
      : o.stage === "prospect"
        ? "contacted"
        : o.stage;
  await db.query(
    "UPDATE crm_opportunities SET stage=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3",
    [
      ["prospect", "contacted"].includes(o.stage) ? stage : o.stage,
      o.id,
      context.workspace.id,
    ],
  );
}
