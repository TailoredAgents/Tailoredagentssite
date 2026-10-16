import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { leadStatuses, projectStatuses } from "./validation";

const PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validIdentifier(value: string) {
  return UUID_PATTERN.test(value);
}

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 1;
}

function searchTerm(value: string | string[] | undefined) {
  const term = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 120) ?? "";
  return term;
}

function dateValue(value: Date | null) {
  return value?.toISOString() ?? null;
}

export async function getWorkspaceMembers(context: DashboardContext) {
  const result = await getDatabasePool().query<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>(
    `SELECT member.id, member.name, member.email, membership.role
     FROM workspace_memberships membership
     INNER JOIN "user" member ON member.id = membership.user_id
     WHERE membership.workspace_id = $1 AND membership.status = 'active'
     ORDER BY member.name, member.email`,
    [context.workspace.id],
  );
  return result.rows;
}

export async function listLeads(
  context: DashboardContext,
  input: { q?: string | string[]; status?: string | string[]; page?: string | string[] },
) {
  const q = searchTerm(input.q);
  const requestedStatus = Array.isArray(input.status) ? input.status[0] : input.status;
  const status = leadStatuses.includes(requestedStatus as (typeof leadStatuses)[number]) ? requestedStatus! : "all";
  const page = pageNumber(input.page);
  const offset = (page - 1) * PAGE_SIZE;
  const values: unknown[] = [context.workspace.id];
  const conditions = ["lead.workspace_id = $1"];

  if (status !== "all") {
    values.push(status);
    conditions.push(`lead.status = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(lead.name ILIKE $${values.length} OR lead.organization ILIKE $${values.length} OR lead.email ILIKE $${values.length})`);
  }

  const where = conditions.join(" AND ");
  const pool = getDatabasePool();
  const [rows, count] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      organization: string;
      email: string;
      inquiry_type: string;
      status: string;
      interest: string | null;
      delivery_status: string;
      next_action: string | null;
      next_action_at: Date | null;
      owner_name: string | null;
      created_at: Date;
    }>(
      `SELECT lead.id, lead.name, lead.organization, lead.email, lead.inquiry_type,
              lead.status, lead.interest, lead.delivery_status, lead.next_action,
              lead.next_action_at, owner.name AS owner_name, lead.created_at
       FROM leads lead
       LEFT JOIN "user" owner ON owner.id = lead.owner_user_id
       WHERE ${where}
       ORDER BY lead.created_at DESC
       LIMIT ${PAGE_SIZE} OFFSET $${values.length + 1}`,
      [...values, offset],
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM leads lead WHERE ${where}`,
      values,
    ),
  ]);

  const total = Number(count.rows[0]?.count ?? 0);
  return {
    items: rows.rows.map((row) => ({
      id: row.id,
      name: row.name,
      organization: row.organization,
      email: row.email,
      inquiryType: row.inquiry_type,
      status: row.status,
      interest: row.interest,
      deliveryStatus: row.delivery_status,
      nextAction: row.next_action,
      nextActionAt: dateValue(row.next_action_at),
      ownerName: row.owner_name,
      createdAt: row.created_at.toISOString(),
    })),
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
    q,
    status,
  };
}

export async function getLead(context: DashboardContext, leadId: string) {
  if (!validIdentifier(leadId)) return null;
  const pool = getDatabasePool();
  const lead = await pool.query<{
    id: string;
    inquiry_type: string;
    source: string;
    status: string;
    name: string;
    organization: string;
    email: string;
    phone: string | null;
    interest: string | null;
    website_url: string | null;
    description: string | null;
    owner_user_id: string | null;
    owner_name: string | null;
    next_action: string | null;
    next_action_at: Date | null;
    outcome_summary: string | null;
    client_id: string | null;
    delivery_status: string;
    delivered_at: Date | null;
    retained_until: Date;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT lead.*, owner.name AS owner_name
     FROM leads lead
     LEFT JOIN "user" owner ON owner.id = lead.owner_user_id
     WHERE lead.id = $1 AND lead.workspace_id = $2
     LIMIT 1`,
    [leadId, context.workspace.id],
  );
  const row = lead.rows[0];
  if (!row) return null;

  const notes = await pool.query<{
    id: string;
    body: string;
    author_name: string | null;
    created_at: Date;
  }>(
    `SELECT note.id, note.body, author.name AS author_name, note.created_at
     FROM lead_notes note
     LEFT JOIN "user" author ON author.id = note.author_user_id
     WHERE note.lead_id = $1 AND note.workspace_id = $2
     ORDER BY note.created_at DESC`,
    [leadId, context.workspace.id],
  );

  return {
    id: row.id,
    inquiryType: row.inquiry_type,
    source: row.source,
    status: row.status,
    name: row.name,
    organization: row.organization,
    email: row.email,
    phone: row.phone,
    interest: row.interest,
    websiteUrl: row.website_url,
    description: row.description,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    nextAction: row.next_action,
    nextActionAt: dateValue(row.next_action_at),
    outcomeSummary: row.outcome_summary,
    clientId: row.client_id,
    deliveryStatus: row.delivery_status,
    deliveredAt: dateValue(row.delivered_at),
    retainedUntil: row.retained_until.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    notes: notes.rows.map((note) => ({
      id: note.id,
      body: note.body,
      authorName: note.author_name ?? "System",
      createdAt: note.created_at.toISOString(),
    })),
  };
}

export async function exportLeads(context: DashboardContext) {
  const result = await getDatabasePool().query<{
    organization: string;
    name: string;
    email: string;
    phone: string | null;
    inquiry_type: string;
    interest: string | null;
    website_url: string | null;
    status: string;
    owner_name: string | null;
    next_action: string | null;
    next_action_at: Date | null;
    outcome_summary: string | null;
    created_at: Date;
  }>(
    `SELECT lead.organization, lead.name, lead.email, lead.phone, lead.inquiry_type,
            lead.interest, lead.website_url, lead.status, owner.name AS owner_name,
            lead.next_action, lead.next_action_at, lead.outcome_summary, lead.created_at
     FROM leads lead
     LEFT JOIN "user" owner ON owner.id = lead.owner_user_id
     WHERE lead.workspace_id = $1 AND lead.anonymized_at IS NULL
     ORDER BY lead.created_at DESC
     LIMIT 5000`,
    [context.workspace.id],
  );
  return result.rows;
}

export async function listClients(
  context: DashboardContext,
  input: { q?: string | string[]; page?: string | string[] },
) {
  const q = searchTerm(input.q);
  const page = pageNumber(input.page);
  const offset = (page - 1) * PAGE_SIZE;
  const values: unknown[] = [context.workspace.id];
  const conditions = ["client.workspace_id = $1"];
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`client.name ILIKE $${values.length}`);
  }
  const where = conditions.join(" AND ");
  const pool = getDatabasePool();
  const [rows, count] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      status: string;
      primary_name: string | null;
      primary_email: string | null;
      sites: string;
      projects: string;
      updated_at: Date;
    }>(
      `SELECT client.id, client.name, client.status, primary_contact.name AS primary_name,
              primary_contact.email AS primary_email,
              count(DISTINCT site.id)::text AS sites,
              count(DISTINCT project.id)::text AS projects,
              client.updated_at
       FROM clients client
       LEFT JOIN LATERAL (
         SELECT contact.name, contact.email
         FROM contacts contact
         WHERE contact.client_id = client.id
         ORDER BY contact.is_primary DESC, contact.created_at ASC
         LIMIT 1
       ) primary_contact ON true
       LEFT JOIN sites site ON site.client_id = client.id AND site.status <> 'archived'
       LEFT JOIN projects project ON project.client_id = client.id AND project.status <> 'archived'
       WHERE ${where}
       GROUP BY client.id, primary_contact.name, primary_contact.email
       ORDER BY client.updated_at DESC
       LIMIT ${PAGE_SIZE} OFFSET $${values.length + 1}`,
      [...values, offset],
    ),
    pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM clients client WHERE ${where}`, values),
  ]);
  const total = Number(count.rows[0]?.count ?? 0);
  return {
    items: rows.rows.map((row) => ({ ...row, sites: Number(row.sites), projects: Number(row.projects), updatedAt: row.updated_at.toISOString() })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    q,
  };
}

export async function getClient(context: DashboardContext, clientId: string) {
  if (!validIdentifier(clientId)) return null;
  const pool = getDatabasePool();
  const client = await pool.query<{
    id: string;
    name: string;
    status: string;
    notes: string | null;
    lead_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM clients WHERE id = $1 AND workspace_id = $2 LIMIT 1", [clientId, context.workspace.id]);
  const row = client.rows[0];
  if (!row) return null;
  const [contacts, sites, projects] = await Promise.all([
    pool.query<{ id: string; name: string; email: string | null; phone: string | null; title: string | null; is_primary: boolean }>(
      "SELECT id, name, email, phone, title, is_primary FROM contacts WHERE client_id = $1 AND workspace_id = $2 ORDER BY is_primary DESC, name",
      [clientId, context.workspace.id],
    ),
    pool.query<{ id: string; name: string; url: string; status: string; environment: string }>(
      "SELECT id, name, url, status, environment FROM sites WHERE client_id = $1 AND workspace_id = $2 ORDER BY name",
      [clientId, context.workspace.id],
    ),
    pool.query<{ id: string; name: string; status: string; due_at: Date | null }>(
      "SELECT id, name, status, due_at FROM projects WHERE client_id = $1 AND workspace_id = $2 ORDER BY updated_at DESC",
      [clientId, context.workspace.id],
    ),
  ]);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    notes: row.notes,
    leadId: row.lead_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    contacts: contacts.rows.map((contact) => ({ ...contact, isPrimary: contact.is_primary })),
    sites: sites.rows,
    projects: projects.rows.map((project) => ({ ...project, dueAt: dateValue(project.due_at) })),
  };
}

export async function getContact(context: DashboardContext, clientId: string, contactId: string) {
  if (!validIdentifier(clientId) || !validIdentifier(contactId)) return null;
  const result = await getDatabasePool().query<{
    id: string;
    client_id: string;
    client_name: string;
    name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    is_primary: boolean;
  }>(
    `SELECT contact.id, contact.client_id, client.name AS client_name, contact.name,
            contact.email, contact.phone, contact.title, contact.is_primary
     FROM contacts contact
     INNER JOIN clients client ON client.id = contact.client_id
     WHERE contact.id = $1 AND contact.client_id = $2
       AND contact.workspace_id = $3 AND client.workspace_id = $3
     LIMIT 1`,
    [contactId, clientId, context.workspace.id],
  );
  return result.rows[0] ?? null;
}

export async function clientOptions(context: DashboardContext) {
  const result = await getDatabasePool().query<{ id: string; name: string }>(
    "SELECT id, name FROM clients WHERE workspace_id = $1 AND status <> 'archived' ORDER BY name",
    [context.workspace.id],
  );
  return result.rows;
}

export async function siteOptions(context: DashboardContext, clientId?: string) {
  const values: unknown[] = [context.workspace.id];
  let clientCondition = "";
  if (clientId) {
    values.push(clientId);
    clientCondition = ` AND site.client_id = $${values.length}`;
  }
  const result = await getDatabasePool().query<{ id: string; name: string }>(
    `SELECT site.id,
            CASE WHEN client.name IS NULL
              THEN 'Unassigned — ' || site.name
              ELSE client.name || ' — ' || site.name
            END AS name
     FROM sites site
     LEFT JOIN clients client ON client.id = site.client_id
     WHERE site.workspace_id = $1 AND site.status <> 'archived'${clientCondition}
     ORDER BY client.name NULLS FIRST, site.name`,
    values,
  );
  return result.rows;
}

export async function listSites(context: DashboardContext, input: { q?: string | string[]; page?: string | string[] }) {
  const q = searchTerm(input.q);
  const page = pageNumber(input.page);
  const offset = (page - 1) * PAGE_SIZE;
  const values: unknown[] = [context.workspace.id];
  const conditions = ["site.workspace_id = $1"];
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(site.name ILIKE $${values.length} OR site.url ILIKE $${values.length} OR client.name ILIKE $${values.length})`);
  }
  const where = conditions.join(" AND ");
  const pool = getDatabasePool();
  const [rows, count] = await Promise.all([
    pool.query<{ id: string; name: string; url: string; environment: string; status: string; client_name: string | null; updated_at: Date }>(
      `SELECT site.id, site.name, site.url, site.environment, site.status, client.name AS client_name, site.updated_at
       FROM sites site LEFT JOIN clients client ON client.id = site.client_id
       WHERE ${where} ORDER BY site.updated_at DESC
       LIMIT ${PAGE_SIZE} OFFSET $${values.length + 1}`,
      [...values, offset],
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM sites site LEFT JOIN clients client ON client.id = site.client_id WHERE ${where}`,
      values,
    ),
  ]);
  const total = Number(count.rows[0]?.count ?? 0);
  return { items: rows.rows.map((row) => ({ ...row, updatedAt: row.updated_at.toISOString() })), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), q };
}

export async function getSite(context: DashboardContext, siteId: string) {
  if (!validIdentifier(siteId)) return null;
  const result = await getDatabasePool().query<{
    id: string; name: string; url: string; environment: string; status: string; notes: string | null; client_id: string | null; client_name: string | null;
  }>(
    `SELECT site.id, site.name, site.url, site.environment, site.status, site.notes,
            site.client_id, client.name AS client_name
     FROM sites site LEFT JOIN clients client ON client.id = site.client_id
     WHERE site.id = $1 AND site.workspace_id = $2 LIMIT 1`,
    [siteId, context.workspace.id],
  );
  return result.rows[0] ?? null;
}

export async function listProjects(
  context: DashboardContext,
  input: { q?: string | string[]; status?: string | string[]; page?: string | string[] },
) {
  const q = searchTerm(input.q);
  const requestedStatus = Array.isArray(input.status) ? input.status[0] : input.status;
  const status = projectStatuses.includes(requestedStatus as (typeof projectStatuses)[number]) ? requestedStatus! : "all";
  const page = pageNumber(input.page);
  const offset = (page - 1) * PAGE_SIZE;
  const values: unknown[] = [context.workspace.id];
  const conditions = ["project.workspace_id = $1"];
  if (status !== "all") {
    values.push(status);
    conditions.push(`project.status = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(project.name ILIKE $${values.length} OR client.name ILIKE $${values.length})`);
  }
  const where = conditions.join(" AND ");
  const pool = getDatabasePool();
  const [rows, count] = await Promise.all([
    pool.query<{
      id: string; name: string; status: string; client_name: string; owner_name: string | null; due_at: Date | null; milestones_open: string; updated_at: Date;
    }>(
      `SELECT project.id, project.name, project.status, client.name AS client_name,
              owner.name AS owner_name, project.due_at,
              count(milestone.id) FILTER (WHERE milestone.status <> 'completed')::text AS milestones_open,
              project.updated_at
       FROM projects project
       INNER JOIN clients client ON client.id = project.client_id
       LEFT JOIN "user" owner ON owner.id = project.owner_user_id
       LEFT JOIN project_milestones milestone ON milestone.project_id = project.id
       WHERE ${where}
       GROUP BY project.id, client.name, owner.name
       ORDER BY project.updated_at DESC
       LIMIT ${PAGE_SIZE} OFFSET $${values.length + 1}`,
      [...values, offset],
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM projects project INNER JOIN clients client ON client.id = project.client_id WHERE ${where}`,
      values,
    ),
  ]);
  const total = Number(count.rows[0]?.count ?? 0);
  return {
    items: rows.rows.map((row) => ({ ...row, milestonesOpen: Number(row.milestones_open), dueAt: dateValue(row.due_at), updatedAt: row.updated_at.toISOString() })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    q,
    status,
  };
}

export async function getProject(context: DashboardContext, projectId: string) {
  if (!validIdentifier(projectId)) return null;
  const pool = getDatabasePool();
  const project = await pool.query<{
    id: string; name: string; status: string; summary: string | null; client_id: string; client_name: string; site_id: string | null; site_name: string | null; owner_user_id: string | null; owner_name: string | null; started_at: Date | null; due_at: Date | null; completed_at: Date | null; created_at: Date;
  }>(
    `SELECT project.id, project.name, project.status, project.summary, project.client_id,
            client.name AS client_name, project.site_id, site.name AS site_name,
            project.owner_user_id, owner.name AS owner_name, project.started_at,
            project.due_at, project.completed_at, project.created_at
     FROM projects project
     INNER JOIN clients client ON client.id = project.client_id
     LEFT JOIN sites site ON site.id = project.site_id
     LEFT JOIN "user" owner ON owner.id = project.owner_user_id
     WHERE project.id = $1 AND project.workspace_id = $2 LIMIT 1`,
    [projectId, context.workspace.id],
  );
  const row = project.rows[0];
  if (!row) return null;
  const [milestones, records] = await Promise.all([
    pool.query<{ id: string; title: string; status: string; due_at: Date | null; completed_at: Date | null }>(
      "SELECT id, title, status, due_at, completed_at FROM project_milestones WHERE project_id = $1 ORDER BY sort_order, due_at NULLS LAST, created_at",
      [projectId],
    ),
    pool.query<{ id: string; kind: string; title: string; body: string | null; author_name: string | null; created_at: Date }>(
      `SELECT record.id, record.kind, record.title, record.body, author.name AS author_name, record.created_at
       FROM project_records record LEFT JOIN "user" author ON author.id = record.author_user_id
       WHERE record.project_id = $1 ORDER BY record.created_at DESC`,
      [projectId],
    ),
  ]);
  return {
    ...row,
    startedAt: dateValue(row.started_at),
    dueAt: dateValue(row.due_at),
    completedAt: dateValue(row.completed_at),
    createdAt: row.created_at.toISOString(),
    milestones: milestones.rows.map((milestone) => ({ ...milestone, dueAt: dateValue(milestone.due_at), completedAt: dateValue(milestone.completed_at) })),
    records: records.rows.map((record) => ({ ...record, authorName: record.author_name ?? "System", createdAt: record.created_at.toISOString() })),
  };
}
