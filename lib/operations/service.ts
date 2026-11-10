import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {authorizeSales,SalesAccessError} from '@/lib/sales/data';
import {asDatabaseDate,clientSchema,contactSchema,formValues,leadNoteSchema,milestoneSchema,milestoneStatusSchema,projectRecordSchema,projectSchema,siteSchema,updateLeadSchema,validationState,type OperationActionState} from './validation';
export type OperationServiceResult=OperationActionState & {redirectTo?:string;outcomeUnknown?:boolean;recordId?:string};
class OperationConflictError extends Error {}
const genericFailure:OperationServiceResult={status:'error',message:'The change could not be saved. Refresh the page and check the record before trying again.',outcomeUnknown:true};
function serviceFailure(error:unknown):OperationServiceResult {return error instanceof OperationConflictError?{status:'error',message:'This record changed or is unavailable. Read it again and prepare a new change.'}:genericFailure;}
async function mutationContext(actor:DashboardContext):Promise<DashboardContext|null>{
 try {const role=await authorizeSales(actor,true);return {...actor,role:role as DashboardContext['role']};}catch(error){if(error instanceof SalesAccessError)return null;throw error;}
}
// Optional for existing browser forms; mandatory in assistant schemas for edits.
// The row lock is held by the same transaction that performs the domain change.
async function requireRevision(db:PoolClient,context:DashboardContext,table:'leads'|'clients'|'contacts'|'sites'|'projects'|'project_milestones',id:string|undefined,expected:FormDataEntryValue|null){
 if(!id||expected===null)return;
 if(typeof expected!=='string'||!Number.isFinite(Date.parse(expected)))throw new OperationConflictError();
 const row=(await db.query<{updated_at:Date}>(table==='project_milestones'?
  'SELECT m.updated_at FROM project_milestones m JOIN projects p ON p.id=m.project_id WHERE m.id=$1 AND p.workspace_id=$2 FOR UPDATE OF m':
  `SELECT updated_at FROM ${table} WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,[id,context.workspace.id])).rows[0];
 if(!row||row.updated_at.getTime()!==Date.parse(expected))throw new OperationConflictError();
}

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function denied(): OperationServiceResult {
  return { status: "error", message: "Your workspace role does not allow this change." };
}

function missing(): OperationServiceResult {
  return { status: "error", message: "That record is no longer available in this workspace." };
}

function success(message: string): OperationServiceResult {
  return { status: "success", message };
}

async function linkClientBusiness(client: PoolClient, workspaceId: string, clientId: string) {
  const result = await client.query<{id:string}>(`INSERT INTO crm_businesses(id,workspace_id,name,client_id)
    SELECT COALESCE(business_id,id),workspace_id,name,id FROM clients WHERE id=$1 AND workspace_id=$2
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,updated_at=now() RETURNING id`,[clientId,workspaceId]);
  const businessId=result.rows[0]?.id;
  if (!businessId) throw new Error("client_unavailable");
  await client.query("UPDATE clients SET business_id=$1 WHERE id=$2 AND workspace_id=$3",[businessId,clientId,workspaceId]);
  await client.query("UPDATE contacts SET business_id=$1 WHERE client_id=$2 AND workspace_id=$3 AND business_id IS NULL",[businessId,clientId,workspaceId]);
  return businessId;
}

export async function updateLead(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = updateLeadSchema.safeParse(formValues(formData, [
    "leadId", "status", "ownerUserId", "nextAction", "nextActionAt", "outcomeSummary",
  ]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;

  try {
    const changed = await withTransaction(async (client) => {
      await requireRevision(client,context,'leads',input.leadId,formData.get('expectedUpdatedAt'));
      if (input.ownerUserId) {
        const membership = await client.query(
          "SELECT 1 FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'",
          [context.workspace.id, input.ownerUserId],
        );
        if (!membership.rowCount) return false;
      }
      const result = await client.query(
        `UPDATE leads
         SET status = $1, owner_user_id = $2, next_action = $3, next_action_at = $4,
             outcome_summary = $5, updated_at = now()
         WHERE id = $6 AND workspace_id = $7`,
        [input.status, input.ownerUserId ?? null, input.nextAction ?? null,
          asDatabaseDate(input.nextActionAt), input.outcomeSummary ?? null,
          input.leadId, context.workspace.id],
      );
      if (!result.rowCount) return false;
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: "lead.updated",
        targetType: "lead",
        targetId: input.leadId,
        metadata: { status: input.status },
      });
      return true;
    });
    if (!changed) return missing();
    return success("Prospect updated.");
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function updateLeadStatus(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = updateLeadSchema.pick({ leadId: true, status: true })
    .safeParse(formValues(formData, ["leadId", "status"]));
  if (!parsed.success) return validationState(parsed.error);
  const { leadId, status } = parsed.data;

  try {
    const changed = await withTransaction(async (client) => {
      await requireRevision(client,context,'leads',leadId,formData.get('expectedUpdatedAt'));
      const result = await client.query(
        "UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3",
        [status, leadId, context.workspace.id],
      );
      if (!result.rowCount) return false;
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: "lead.updated",
        targetType: "lead",
        targetId: leadId,
        metadata: { status },
      });
      return true;
    });
    if (!changed) return missing();
    return success("Status saved.");
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function addLeadNote(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = leadNoteSchema.safeParse(formValues(formData, ["leadId", "body"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const noteId = randomUUID();
  try {
    const created = await withTransaction(async (client) => {
      const lead = await client.query("SELECT 1 FROM leads WHERE id = $1 AND workspace_id = $2", [input.leadId, context.workspace.id]);
      if (!lead.rowCount) return false;
      await client.query(
        "INSERT INTO lead_notes (id, workspace_id, lead_id, author_user_id, body) VALUES ($1, $2, $3, $4, $5)",
        [noteId, context.workspace.id, input.leadId, context.user.id, input.body],
      );
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: "lead.note_added",
        targetType: "lead",
        targetId: input.leadId,
      });
      return true;
    });
    if (!created) return missing();
    return {...success("Note added."),recordId:noteId};
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function saveClient(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = clientSchema.safeParse(formValues(formData, ["clientId", "name", "status", "notes"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const clientId = input.clientId ?? randomUUID();
  try {
    const saved = await withTransaction(async (client) => {
      await requireRevision(client,context,'clients',input.clientId,formData.get('expectedUpdatedAt'));
      if (input.clientId) {
        const result = await client.query(
          "UPDATE clients SET name = $1, status = $2, notes = $3, updated_at = now() WHERE id = $4 AND workspace_id = $5",
          [input.name, input.status, input.notes ?? null, clientId, context.workspace.id],
        );
        if (!result.rowCount) return false;
      } else {
        await client.query(
          "INSERT INTO clients (id, workspace_id, name, status, notes) VALUES ($1, $2, $3, $4, $5)",
          [clientId, context.workspace.id, input.name, input.status, input.notes ?? null],
        );
      }
      await linkClientBusiness(client, context.workspace.id, clientId);
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: input.clientId ? "client.updated" : "client.created",
        targetType: "client",
        targetId: clientId,
        metadata: { status: input.status },
      });
      return true;
    });
    if (!saved) return missing();
  } catch (error) {
    return serviceFailure(error);
  }
  if (input.clientId) {
    return {...success("Client updated."),recordId:clientId};
  }
  return {...success('Saved.'),recordId:clientId,redirectTo:`/dashboard/clients/${clientId}`};
}

export async function saveContact(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = contactSchema.safeParse({
    ...formValues(formData, ["contactId", "clientId", "name", "email", "phone", "title", "isPrimary"]),
    isPrimary: formData.get("isPrimary"),
  });
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const contactId = input.contactId ?? randomUUID();
  try {
    const created = await withTransaction(async (client) => {
      await requireRevision(client,context,'contacts',input.contactId,formData.get('expectedUpdatedAt'));
      const owner = await client.query("SELECT 1 FROM clients WHERE id = $1 AND workspace_id = $2", [input.clientId, context.workspace.id]);
      if (!owner.rowCount) return false;
      const businessId = await linkClientBusiness(client, context.workspace.id, input.clientId);
      if (input.contactId) {
        const existing = await client.query(
          "SELECT 1 FROM contacts WHERE id = $1 AND client_id = $2 AND workspace_id = $3 FOR UPDATE",
          [contactId, input.clientId, context.workspace.id],
        );
        if (!existing.rowCount) return false;
      }
      if (input.isPrimary) await client.query("UPDATE contacts SET is_primary = false, updated_at = now() WHERE client_id = $1", [input.clientId]);
      if (input.contactId) {
        const updated = await client.query(
          `UPDATE contacts
           SET name = $1, email = $2, phone = $3, title = $4, is_primary = $5, updated_at = now()
           WHERE id = $6 AND client_id = $7 AND workspace_id = $8`,
          [input.name, input.email ?? null, input.phone ?? null, input.title ?? null,
            input.isPrimary, contactId, input.clientId, context.workspace.id],
        );
        if (!updated.rowCount) return false;
      } else {
        await client.query(
          `INSERT INTO contacts (id, workspace_id, client_id, business_id, name, email, phone, title, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [contactId, context.workspace.id, input.clientId, businessId, input.name, input.email ?? null, input.phone ?? null, input.title ?? null, input.isPrimary],
        );
      }
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: input.contactId ? "contact.updated" : "contact.created",
        targetType: "contact",
        targetId: contactId,
        metadata: { clientId: input.clientId },
      });
      return true;
    });
    if (!created) return missing();
    return {...success(input.contactId ? "Contact updated." : "Contact added."),recordId:contactId};
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { status: "error", message: "That email is already attached to this client." };
    return serviceFailure(error);
  }
}

export async function saveSite(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = siteSchema.safeParse(formValues(formData, ["siteId", "clientId", "name", "url", "environment", "status", "notes"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const siteId = input.siteId ?? randomUUID();
  try {
    const saved = await withTransaction(async (client) => {
      await requireRevision(client,context,'sites',input.siteId,formData.get('expectedUpdatedAt'));
      if (input.clientId) {
        const clientRecord = await client.query("SELECT 1 FROM clients WHERE id = $1 AND workspace_id = $2", [input.clientId, context.workspace.id]);
        if (!clientRecord.rowCount) return false;
      }
      if (input.siteId) {
        const projectConflict = await client.query(
          `SELECT 1 FROM projects
           WHERE site_id = $1 AND workspace_id = $2
             AND client_id IS DISTINCT FROM $3
           LIMIT 1`,
          [siteId, context.workspace.id, input.clientId ?? null],
        );
        if (projectConflict.rowCount) return "project_conflict" as const;
        const result = await client.query(
          `UPDATE sites SET client_id = $1, name = $2, url = $3, environment = $4,
                  status = $5, notes = $6, updated_at = now()
           WHERE id = $7 AND workspace_id = $8`,
          [input.clientId ?? null, input.name, input.url, input.environment, input.status, input.notes ?? null, siteId, context.workspace.id],
        );
        if (!result.rowCount) return "missing" as const;
      } else {
        await client.query(
          `INSERT INTO sites (id, workspace_id, client_id, name, url, environment, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [siteId, context.workspace.id, input.clientId ?? null, input.name, input.url, input.environment, input.status, input.notes ?? null],
        );
      }
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: input.siteId ? "site.updated" : "site.created",
        targetType: "site",
        targetId: siteId,
        metadata: { status: input.status },
      });
      return "saved" as const;
    });
    if (saved === "project_conflict") {
      return { status: "error", message: "This site's client cannot change while a project for another client uses it." };
    }
    if (saved !== "saved") return missing();
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { status: "error", message: "That URL already exists in this workspace." };
    return serviceFailure(error);
  }
  if (input.siteId) {
    return {...success("Site updated."),recordId:siteId};
  }
  return {...success('Saved.'),recordId:siteId,redirectTo:`/dashboard/sites/${siteId}`};
}

export async function saveProject(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = projectSchema.safeParse(formValues(formData, [
    "projectId", "clientId", "siteId", "ownerUserId", "name", "status", "summary", "startedAt", "dueAt",
  ]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const projectId = input.projectId ?? randomUUID();
  try {
    const saved = await withTransaction(async (client) => {
      await requireRevision(client,context,'projects',input.projectId,formData.get('expectedUpdatedAt'));
      const clientRecord = await client.query("SELECT 1 FROM clients WHERE id = $1 AND workspace_id = $2", [input.clientId, context.workspace.id]);
      if (!clientRecord.rowCount) return false;
      if (input.projectId) {
        const existingProject = await client.query(
          "SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
          [projectId, context.workspace.id],
        );
        if (!existingProject.rowCount) return false;
        const completedSale = await client.query(
          `SELECT 1 FROM crm_opportunities
           WHERE project_id = $1 AND workspace_id = $2 AND stage = 'won'
             AND client_id IS DISTINCT FROM $3
           LIMIT 1`,
          [projectId, context.workspace.id, input.clientId],
        );
        if (completedSale.rowCount) return "sales_client_conflict" as const;
      }
      if (input.ownerUserId) {
        const owner = await client.query("SELECT 1 FROM workspace_memberships WHERE user_id = $1 AND workspace_id = $2 AND status = 'active'", [input.ownerUserId, context.workspace.id]);
        if (!owner.rowCount) return false;
      }
      let linkedSite = false;
      if (input.siteId) {
        const site = await client.query<{ client_id: string | null }>(
          "SELECT client_id FROM sites WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
          [input.siteId, context.workspace.id],
        );
        if (!site.rowCount || (site.rows[0].client_id && site.rows[0].client_id !== input.clientId)) return false;
        if (!site.rows[0].client_id) {
          await client.query(
            "UPDATE sites SET client_id = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3",
            [input.clientId, input.siteId, context.workspace.id],
          );
          linkedSite = true;
        }
      }
      const completedAt = input.status === "completed" ? new Date() : null;
      if (input.projectId) {
        const result = await client.query(
          `UPDATE projects SET client_id = $1, site_id = $2, owner_user_id = $3,
                  name = $4, status = $5, summary = $6, started_at = $7, due_at = $8,
                  completed_at = $9, updated_at = now()
           WHERE id = $10 AND workspace_id = $11`,
          [input.clientId, input.siteId ?? null, input.ownerUserId ?? null, input.name,
            input.status, input.summary ?? null, asDatabaseDate(input.startedAt),
            asDatabaseDate(input.dueAt), completedAt, projectId, context.workspace.id],
        );
        if (!result.rowCount) return false;
      } else {
        await client.query(
          `INSERT INTO projects
            (id, workspace_id, client_id, site_id, owner_user_id, name, status, summary, started_at, due_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [projectId, context.workspace.id, input.clientId, input.siteId ?? null,
            input.ownerUserId ?? null, input.name, input.status, input.summary ?? null,
            asDatabaseDate(input.startedAt), asDatabaseDate(input.dueAt), completedAt],
        );
      }
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: input.projectId ? "project.updated" : "project.created",
        targetType: "project",
        targetId: projectId,
        metadata: { status: input.status },
      });
      if (linkedSite && input.siteId) {
        await insertAuditLog(client, {
          workspaceId: context.workspace.id,
          actorUserId: context.user.id,
          action: "site.client_linked",
          targetType: "site",
          targetId: input.siteId,
          metadata: { clientId: input.clientId, projectId },
        });
      }
      return true;
    });
    if (saved === "sales_client_conflict") return {
      status: "error",
      message: "This project is linked to a completed sale. Keep it with that client to preserve the sales history.",
    };
    if (!saved) return missing();
  } catch (error) {
    return serviceFailure(error);
  }
  if (input.projectId) {
    return {...success("Project updated."),recordId:projectId};
  }
  return {...success('Saved.'),recordId:projectId,redirectTo:`/dashboard/projects/${projectId}`};
}

export async function addMilestone(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = milestoneSchema.safeParse(formValues(formData, ["projectId", "title", "status", "dueAt"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const milestoneId = randomUUID();
  try {
    const created = await withTransaction(async (client) => {
      const project = await client.query("SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2", [input.projectId, context.workspace.id]);
      if (!project.rowCount) return false;
      await client.query(
        `INSERT INTO project_milestones (id, project_id, title, status, due_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [milestoneId, input.projectId, input.title, input.status, asDatabaseDate(input.dueAt), input.status === "completed" ? new Date() : null],
      );
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: "project.milestone_created",
        targetType: "project_milestone",
        targetId: milestoneId,
        metadata: { projectId: input.projectId },
      });
      return true;
    });
    if (!created) return missing();
    return {...success("Milestone added."),recordId:milestoneId};
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function updateMilestoneStatus(actor: DashboardContext, formData: FormData): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = milestoneStatusSchema.safeParse(formValues(formData, ["projectId", "milestoneId", "status"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  try {
    const changed = await withTransaction(async (client) => {
      await requireRevision(client,context,'project_milestones',input.milestoneId,formData.get('expectedUpdatedAt'));
      const result = await client.query(
        `UPDATE project_milestones milestone
         SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE NULL END, updated_at = now()
         FROM projects project
         WHERE milestone.id = $2 AND milestone.project_id = project.id
           AND project.id = $3 AND project.workspace_id = $4`,
        [input.status, input.milestoneId, input.projectId, context.workspace.id],
      );
      if (!result.rowCount) return false;
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: "project.milestone_updated",
        targetType: "project_milestone",
        targetId: input.milestoneId,
        metadata: { projectId: input.projectId, status: input.status },
      });
      return true;
    });
    if (!changed) return missing();
    return success("Milestone updated.");
  } catch (error) { return serviceFailure(error); }
}

export async function addProjectRecord(
  actor: DashboardContext,
  formData: FormData,
): Promise<OperationServiceResult> {
  const context = await mutationContext(actor);
  if (!context) return denied();
  const parsed = projectRecordSchema.safeParse(formValues(formData, ["projectId", "kind", "title", "body"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const recordId = randomUUID();
  try {
    const created = await withTransaction(async (client) => {
      const project = await client.query("SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2", [input.projectId, context.workspace.id]);
      if (!project.rowCount) return false;
      await client.query(
        "INSERT INTO project_records (id, project_id, author_user_id, kind, title, body) VALUES ($1, $2, $3, $4, $5, $6)",
        [recordId, input.projectId, context.user.id, input.kind, input.title, input.body ?? null],
      );
      await insertAuditLog(client, {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        action: `project.${input.kind}_created`,
        targetType: "project_record",
        targetId: recordId,
        metadata: { projectId: input.projectId, kind: input.kind },
      });
      return true;
    });
    if (!created) return missing();
    return {...success(`${input.kind.charAt(0).toUpperCase() + input.kind.slice(1)} added.`),recordId};
  } catch (error) {
    return serviceFailure(error);
  }
}
