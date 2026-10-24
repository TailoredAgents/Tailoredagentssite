import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { getWorkspaceMembers } from "@/lib/operations/data";
import { getVoiceConfiguration } from "@/lib/voice-provider/config";
import {
  salesStages,
  type SalesFilters,
  type SalesOpportunity,
  type SalesRecord,
  type SalesTask,
  type SalesMockup,
  type SalesWorkspace,
  type SalesToday,
  type SalesList,
} from "./types";

export class SalesAccessError extends Error {}
export async function authorizeSales(
  context: DashboardContext,
  mutate = false,
) {
  const found = await getDatabasePool().query<{ role: string }>(
    `SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'`,
    [context.workspace.id, context.user.id],
  );
  const role = found.rows[0]?.role;
  if (!role || (mutate && !["owner", "admin", "member"].includes(role)))
    throw new SalesAccessError(
      "Your workspace access does not allow this action.",
    );
  return role;
}
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const validId = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const opportunitySelect = `SELECT o.id,o.title,o.stage,o.value_cents::float8 AS "valueCents",o.offer_type AS "offerType",o.source,
 o.owner_user_id AS "ownerId",u.name AS "ownerName",o.client_id AS "clientId",o.project_id AS "projectId",o.lead_id AS "leadId",
 o.created_at AS "createdAt",o.updated_at AS "updatedAt",o.closed_at AS "closedAt",
 json_build_object('id',b.id,'name',b.name,'websiteUrl',b.website_url,'phone',b.normalized_phone,'email',b.normalized_email,'industry',b.industry,'state',b.state,'websiteStatus',b.website_status,'score',b.score::float8,'researchUrl',b.research_url,'researchNotes',b.research_notes,'anonymizedAt',b.anonymized_at,'updatedAt',b.updated_at) AS business,
 CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'title',c.title) END AS contact,
 CASE WHEN nt.id IS NULL THEN NULL ELSE json_build_object('id',nt.id,'title',nt.title,'dueAt',nt.due_at,'kind',nt.kind) END AS "nextTask",
 m.status AS "mockupStatus",COALESCE((SELECT array_agg(l.name ORDER BY l.created_at,l.id) FROM crm_list_members lm JOIN crm_lists l ON l.id=lm.list_id WHERE lm.opportunity_id=o.id AND lm.workspace_id=o.workspace_id),'{}') AS "listNames"
 FROM crm_opportunities o JOIN crm_businesses b ON b.id=o.business_id AND b.workspace_id=o.workspace_id
 LEFT JOIN contacts c ON c.id=o.primary_contact_id AND c.workspace_id=o.workspace_id
 LEFT JOIN "user" u ON u.id=o.owner_user_id LEFT JOIN crm_mockups m ON m.opportunity_id=o.id AND m.workspace_id=o.workspace_id
 LEFT JOIN LATERAL (SELECT id,title,due_at,kind FROM crm_tasks WHERE opportunity_id=o.id AND workspace_id=o.workspace_id AND status='open' ORDER BY due_at,id LIMIT 1) nt ON true`;
type OpportunityRow = Omit<
  SalesOpportunity,
  "createdAt" | "updatedAt" | "closedAt"
> & { createdAt: Date; updatedAt: Date; closedAt: Date | null };
function opportunity(row: OpportunityRow): SalesOpportunity {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
const taskSelect = `SELECT t.id,t.opportunity_id AS "opportunityId",COALESCE(b.name,cb.name,p.name,s.external_addresses[1],'Customer') AS "businessName",COALESCE(o.title,'Call follow-up') AS "opportunityTitle",t.owner_user_id AS "ownerId",u.name AS "ownerName",t.kind,t.title,t.due_at AS "dueAt",t.end_at AS "endAt",t.location,t.notes,t.status FROM crm_tasks t LEFT JOIN crm_opportunities o ON o.id=t.opportunity_id AND o.workspace_id=t.workspace_id LEFT JOIN crm_businesses b ON b.id=o.business_id AND b.workspace_id=t.workspace_id LEFT JOIN crm_conversation_sources s ON s.id=t.conversation_source_id AND s.workspace_id=t.workspace_id LEFT JOIN crm_conversations c ON c.id=s.conversation_id AND c.workspace_id=s.workspace_id LEFT JOIN contacts p ON p.id=c.contact_id AND p.workspace_id=c.workspace_id LEFT JOIN crm_businesses cb ON cb.id=COALESCE(c.business_id,p.business_id) AND cb.workspace_id=c.workspace_id LEFT JOIN "user" u ON u.id=t.owner_user_id`;
type TaskRow = Omit<SalesTask, "dueAt" | "endAt"> & {
  dueAt: Date;
  endAt: Date | null;
};
function task(row: TaskRow): SalesTask {
  return {
    ...row,
    dueAt: row.dueAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
  };
}
const mockupSelect = `SELECT m.id,m.opportunity_id AS "opportunityId",b.name AS "businessName",o.title AS "opportunityTitle",m.owner_user_id AS "ownerId",u.name AS "ownerName",m.status,m.brief,m.preview_url AS "previewUrl",m.repository_url AS "repositoryUrl",m.project_path AS "projectPath",m.qa_notes AS "qaNotes",m.created_at AS "createdAt",m.updated_at AS "updatedAt" FROM crm_mockups m JOIN crm_opportunities o ON o.id=m.opportunity_id AND o.workspace_id=m.workspace_id JOIN crm_businesses b ON b.id=o.business_id AND b.workspace_id=m.workspace_id LEFT JOIN "user" u ON u.id=m.owner_user_id`;
type MockupRow = Omit<SalesMockup, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};
function mockup(row: MockupRow): SalesMockup {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSalesWorkspace(
  context: DashboardContext,
  filters: SalesFilters = {},
): Promise<SalesWorkspace> {
  await authorizeSales(context);
  const q = one(filters.q).slice(0, 120),
    stage = salesStages.includes(one(filters.stage) as never)
      ? one(filters.stage)
      : "all",
    owner = one(filters.owner) || "all",
    list = validId(one(filters.list)) ? one(filters.list) : "all",
    view = one(filters.view) === "table" ? "table" : "board";
  const page = Math.max(
      1,
      Math.min(10000, Math.trunc(Number(one(filters.page))) || 1),
    ),
    size = 48;
  const values: unknown[] = [context.workspace.id],
    where = ["o.workspace_id=$1"];
  if (q) {
    values.push(`%${q}%`);
    where.push(
      `(b.name ILIKE $${values.length} OR o.title ILIKE $${values.length} OR c.name ILIKE $${values.length} OR b.normalized_phone ILIKE $${values.length} OR b.normalized_email ILIKE $${values.length})`,
    );
  }
  if (stage !== "all") {
    values.push(stage);
    where.push(`o.stage=$${values.length}`);
  } else where.push("o.stage<>'archived'");
  if (owner === "unassigned") where.push("o.owner_user_id IS NULL");
  else if (owner !== "all") {
    values.push(owner === "mine" ? context.user.id : owner);
    where.push(`o.owner_user_id=$${values.length}`);
  }
  if (list !== "all") {
    values.push(list);
    where.push(
      `EXISTS(SELECT 1 FROM crm_list_members lm WHERE lm.opportunity_id=o.id AND lm.workspace_id=o.workspace_id AND lm.list_id=$${values.length})`,
    );
  }
  const clause = where.join(" AND "),
    pool = getDatabasePool();
  const [rows, totals, members, lists, inquiries] = await Promise.all([
    pool.query<OpportunityRow>(
      `${opportunitySelect} WHERE ${clause} ORDER BY CASE WHEN o.stage IN ('interested','discovery','mockup','proposal') THEN 0 WHEN o.stage='contacted' THEN 1 WHEN o.stage='prospect' THEN 2 ELSE 3 END,o.updated_at DESC,o.id LIMIT ${size} OFFSET $${values.length + 1}`,
      [...values, (page - 1) * size],
    ),
    pool.query<{ stage: string; count: string; value: string }>(
      `SELECT o.stage,count(*)::text AS count,coalesce(sum(o.value_cents),0)::text AS value FROM crm_opportunities o JOIN crm_businesses b ON b.id=o.business_id LEFT JOIN contacts c ON c.id=o.primary_contact_id WHERE ${clause} GROUP BY o.stage`,
      values,
    ),
    getWorkspaceMembers(context),
    pool.query<{ id: string; name: string }>(
      "SELECT id,name FROM crm_lists WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200",
      [context.workspace.id],
    ),
    pool.query<{
      id: string;
      name: string;
      organization: string;
      phone: string | null;
      email: string | null;
      source: string;
      created_at: Date;
    }>(
      `SELECT l.id,l.name,l.organization,l.phone,l.email,l.source,l.created_at FROM leads l WHERE l.workspace_id=$1 AND l.status NOT IN ('won','lost','archived') AND l.anonymized_at IS NULL AND NOT EXISTS(SELECT 1 FROM crm_opportunities o WHERE o.lead_id=l.id AND o.workspace_id=l.workspace_id) ORDER BY l.created_at DESC LIMIT 10`,
      [context.workspace.id],
    ),
  ]);
  const stageCounts = Object.fromEntries(
    totals.rows.map((r) => [r.stage, Number(r.count)]),
  );
  const total = totals.rows.reduce((n, r) => n + Number(r.count), 0),
    value = (stages: string[]) =>
      totals.rows
        .filter((r) => stages.includes(r.stage))
        .reduce((n, r) => n + Number(r.value), 0);
  return {
    items: rows.rows.map(opportunity),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / size)),
    q,
    stage,
    owner,
    list,
    view,
    members: members.filter((m) => m.role !== "viewer"),
    lists: lists.rows,
    stageCounts,
    summary: {
      prospects: stageCounts.prospect ?? 0,
      interested: ["interested", "discovery", "mockup", "proposal"].reduce(
        (n, s) => n + (stageCounts[s] ?? 0),
        0,
      ),
      open:
        total -
        (stageCounts.won ?? 0) -
        (stageCounts.lost ?? 0) -
        (stageCounts.archived ?? 0),
      won: stageCounts.won ?? 0,
      pipelineValueCents: value([
        "prospect",
        "contacted",
        "interested",
        "discovery",
        "mockup",
        "proposal",
      ]),
      wonValueCents: value(["won"]),
    },
    websiteInquiries: inquiries.rows.map((r) => ({
      id: r.id,
      name: r.name,
      organization: r.organization,
      phone: r.phone,
      email: r.email,
      source: r.source,
      createdAt: r.created_at.toISOString(),
    })),
  };
}
export async function getSalesRecord(
  context: DashboardContext,
  id: string,
): Promise<SalesRecord | null> {
  await authorizeSales(context);
  if (!validId(id)) return null;
  const pool = getDatabasePool(),
    rows = await pool.query<OpportunityRow>(
      `${opportunitySelect} WHERE o.workspace_id=$1 AND o.id=$2`,
      [context.workspace.id, id],
    );
  if (!rows.rows[0]) return null;
  const record = opportunity(rows.rows[0]);
  const [contacts, tasks, activities, mockups, lists, members, preferences] =
    await Promise.all([
      pool.query(
        "SELECT id,name,email,phone,title FROM contacts WHERE workspace_id=$1 AND business_id=$2 ORDER BY is_primary DESC,name",
        [context.workspace.id, record.business.id],
      ),
      pool.query<TaskRow>(
        `${taskSelect} WHERE t.workspace_id=$1 AND t.opportunity_id=$2 ORDER BY (t.status='open') DESC,t.due_at DESC LIMIT 100`,
        [context.workspace.id, id],
      ),
      pool.query<{
        id: string;
        kind: string;
        source: string;
        direction: string;
        outcome: string | null;
        body: string;
        actorName: string | null;
        occurredAt: Date;
      }>(
        `SELECT a.id,a.kind,a.source,a.direction,a.outcome,a.body,u.name AS "actorName",a.occurred_at AS "occurredAt" FROM crm_activities a LEFT JOIN "user" u ON u.id=a.actor_user_id WHERE a.workspace_id=$1 AND a.opportunity_id=$2 ORDER BY a.occurred_at DESC,a.id LIMIT 100`,
        [context.workspace.id, id],
      ),
      pool.query<MockupRow>(
        `${mockupSelect} WHERE m.workspace_id=$1 AND m.opportunity_id=$2`,
        [context.workspace.id, id],
      ),
      pool.query<{ id: string; name: string }>(
        "SELECT l.id,l.name FROM crm_lists l JOIN crm_list_members m ON m.list_id=l.id AND m.workspace_id=l.workspace_id WHERE m.workspace_id=$1 AND m.opportunity_id=$2 ORDER BY l.created_at",
        [context.workspace.id, id],
      ),
      getWorkspaceMembers(context),
      pool.query<{
        channel: string;
        address: string;
        status: string;
        evidence: string | null;
      }>(
        `SELECT p.channel,p.normalized_address AS address,p.status,p.evidence
         FROM crm_channel_preferences p
         WHERE p.workspace_id=$1 AND (p.normalized_address=ANY($2::text[])
           OR EXISTS (SELECT 1 FROM contacts c WHERE c.workspace_id=p.workspace_id
             AND c.business_id=$3 AND p.normalized_address IN (lower(trim(c.email)),crm_normalized_phone(c.phone))))`,
        [
          context.workspace.id,
          [record.business.phone, record.business.email].filter(Boolean),
          record.business.id,
        ],
      ),
    ]);
  return {
    ...record,
    contacts: contacts.rows,
    tasks: tasks.rows.map(task),
    activities: activities.rows.map((r) => ({
      ...r,
      occurredAt: r.occurredAt.toISOString(),
    })),
    mockup: mockups.rows[0] ? mockup(mockups.rows[0]) : null,
    lists: lists.rows,
    members: members.filter((m) => m.role !== "viewer"),
    channelPreferences: preferences.rows,
  };
}
export async function getSalesToday(
  context: DashboardContext,
  scope: "mine" | "team" = "mine",
): Promise<SalesToday> {
  await authorizeSales(context);
  const voice=getVoiceConfiguration();
  const pool = getDatabasePool(),
    values =
      scope === "mine"
        ? [context.workspace.id, context.user.id]
        : [context.workspace.id];
  const ownership = (alias: string) =>
    scope === "mine" ? ` AND ${alias}.owner_user_id=$2` : "";
  const [tasks, opps, mockups, members] = await Promise.all([
    pool.query<TaskRow>(
      `${taskSelect} WHERE t.workspace_id=$1 AND t.status='open' AND t.due_at<=now()+interval '7 days' AND (t.conversation_source_id IS NULL OR ($5 AND s.visible AND s.channel='call' AND c.merged_into_id IS NULL AND cb.anonymized_at IS NULL AND EXISTS(SELECT 1 FROM voice_conversations vc JOIN voice_lines l ON l.id=vc.line_id AND l.workspace_id=vc.workspace_id JOIN voice_line_grants g ON g.line_id=l.id AND g.workspace_id=l.workspace_id WHERE vc.id=s.voice_conversation_id AND vc.workspace_id=t.workspace_id AND l.account_sid=$3 AND l.phone=$4 AND g.user_id=$2 AND g.can_read)))${ownership("t")} ORDER BY t.due_at,t.id LIMIT 100`,
      [context.workspace.id,context.user.id,voice.accountSid,voice.phoneNumber,voice.webhookReady],
    ),
    pool.query<OpportunityRow>(
      `${opportunitySelect} WHERE o.workspace_id=$1 AND o.stage NOT IN ('won','lost','archived')${ownership("o")} ORDER BY CASE WHEN o.stage IN ('interested','discovery','proposal') THEN 0 ELSE 1 END,o.updated_at DESC LIMIT 48`,
      values,
    ),
    pool.query<MockupRow>(
      `${mockupSelect} WHERE m.workspace_id=$1 AND o.stage<>'archived' AND m.status<>'delivered'${ownership("m")} ORDER BY m.created_at LIMIT 30`,
      values,
    ),
    getWorkspaceMembers(context),
  ]);
  const allTasks = tasks.rows.map(task),
    opportunities = opps.rows.map(opportunity),
    queue = mockups.rows.map(mockup);
  return {
    scope,
    members: members.filter((m) => m.role !== "viewer"),
    tasks: allTasks.filter((t) => t.kind === "follow_up"),
    appointments: allTasks.filter((t) => t.kind === "appointment"),
    opportunities,
    mockups: queue,
    stats: {
      assigned: opportunities.length,
      interested: opportunities.filter((o) =>
        ["interested", "discovery", "mockup", "proposal"].includes(o.stage),
      ).length,
      due: allTasks.filter((t) => Date.parse(t.dueAt) <= Date.now()).length,
      appointments: allTasks.filter((t) => t.kind === "appointment").length,
      mockups: queue.length,
    },
  };
}
export async function getMockupQueue(context: DashboardContext) {
  await authorizeSales(context);
  const [rows, members] = await Promise.all([
    getDatabasePool().query<MockupRow>(
      `${mockupSelect} WHERE m.workspace_id=$1 AND o.stage<>'archived' ORDER BY (m.status='delivered'),m.created_at DESC LIMIT 200`,
      [context.workspace.id],
    ),
    getWorkspaceMembers(context),
  ]);
  return {
    items: rows.rows.map(mockup),
    members: members.filter((m) => m.role !== "viewer"),
  };
}
export async function getSalesLists(
  context: DashboardContext,
): Promise<SalesList[]> {
  await authorizeSales(context);
  const rows = await getDatabasePool().query<{
    id: string;
    name: string;
    source: string;
    createdAt: Date;
    businesses: string;
    contacted: string;
    interested: string;
    appointments: string;
    mockups: string;
    won: string;
    wonValueCents: string;
  }>(
    `SELECT l.id,l.name,l.source,l.created_at AS "createdAt",count(DISTINCT lm.business_id)::text AS businesses,
 count(DISTINCT o.id) FILTER(WHERE o.stage NOT IN ('prospect','archived'))::text AS contacted,
 count(DISTINCT o.id) FILTER(WHERE o.stage IN ('interested','discovery','mockup','proposal','won'))::text AS interested,
 count(DISTINCT o.id) FILTER(WHERE EXISTS(SELECT 1 FROM crm_tasks t WHERE t.opportunity_id=o.id AND t.workspace_id=l.workspace_id AND t.kind='appointment'))::text AS appointments,
 count(DISTINCT o.id) FILTER(WHERE EXISTS(SELECT 1 FROM crm_mockups m WHERE m.opportunity_id=o.id AND m.workspace_id=l.workspace_id))::text AS mockups,
 count(DISTINCT o.id) FILTER(WHERE o.stage='won' AND l.id=first_source.id)::text AS won,
 coalesce(sum(o.value_cents) FILTER(WHERE o.stage='won' AND l.id=first_source.id),0)::text AS "wonValueCents"
 FROM crm_lists l LEFT JOIN crm_list_members lm ON lm.list_id=l.id AND lm.workspace_id=l.workspace_id LEFT JOIN crm_opportunities o ON o.id=lm.opportunity_id AND o.workspace_id=l.workspace_id
 LEFT JOIN LATERAL(SELECT sl.id FROM crm_lists sl JOIN crm_list_members sm ON sm.list_id=sl.id AND sm.workspace_id=sl.workspace_id WHERE sm.opportunity_id=o.id ORDER BY sl.created_at,sl.id LIMIT 1) first_source ON true
 WHERE l.workspace_id=$1 GROUP BY l.id ORDER BY l.created_at DESC LIMIT 200`,
    [context.workspace.id],
  );
  return rows.rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    businesses: Number(r.businesses),
    contacted: Number(r.contacted),
    interested: Number(r.interested),
    appointments: Number(r.appointments),
    mockups: Number(r.mockups),
    won: Number(r.won),
    wonValueCents: Number(r.wonValueCents),
  }));
}
