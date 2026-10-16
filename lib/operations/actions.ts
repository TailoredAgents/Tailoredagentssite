"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import {
  asDatabaseDate,
  clientSchema,
  contactSchema,
  convertLeadSchema,
  formValues,
  leadNoteSchema,
  milestoneSchema,
  milestoneStatusSchema,
  projectRecordSchema,
  projectSchema,
  siteSchema,
  updateLeadSchema,
  validationState,
  type OperationActionState,
} from "./validation";

const genericFailure: OperationActionState = {
  status: "error",
  message: "The change could not be saved. Refresh the page and try again.",
};

function canMutate(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

async function mutationContext() {
  const context = await requireDashboardContext();
  if (!canMutate(context.role)) return null;
  return context;
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

function denied(): OperationActionState {
  return { status: "error", message: "Your workspace role does not allow this change." };
}

function missing(): OperationActionState {
  return { status: "error", message: "That record is no longer available in this workspace." };
}

function success(message: string): OperationActionState {
  return { status: "success", message };
}

export async function updateLeadAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = updateLeadSchema.safeParse(formValues(formData, [
    "leadId", "status", "ownerUserId", "nextAction", "nextActionAt", "outcomeSummary",
  ]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;

  try {
    const changed = await withTransaction(async (client) => {
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
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${input.leadId}`);
    return success("Lead updated.");
  } catch {
    return genericFailure;
  }
}

export async function addLeadNoteAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = leadNoteSchema.safeParse(formValues(formData, ["leadId", "body"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  try {
    const created = await withTransaction(async (client) => {
      const lead = await client.query("SELECT 1 FROM leads WHERE id = $1 AND workspace_id = $2", [input.leadId, context.workspace.id]);
      if (!lead.rowCount) return false;
      const noteId = randomUUID();
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
    revalidatePath(`/dashboard/leads/${input.leadId}`);
    return success("Note added.");
  } catch {
    return genericFailure;
  }
}

export async function convertLeadAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = convertLeadSchema.safeParse({
    ...formValues(formData, ["leadId", "clientName", "projectName", "projectSummary", "createSite"]),
    createSite: formData.get("createSite"),
  });
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  let clientId = "";

  try {
    const converted = await withTransaction(async (client) => {
      const leadResult = await client.query<{
        name: string; email: string; phone: string | null; website_url: string | null; client_id: string | null;
      }>(
        "SELECT name, email, phone, website_url, client_id FROM leads WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
        [input.leadId, context.workspace.id],
      );
      const lead = leadResult.rows[0];
      if (!lead || lead.client_id) return "unavailable" as const;

      let existingSite: { id: string; client_id: string | null } | undefined;
      if (input.createSite && lead.website_url) {
        const existingSiteResult = await client.query<{ id: string; client_id: string | null }>(
          "SELECT id, client_id FROM sites WHERE workspace_id = $1 AND url = $2 FOR UPDATE",
          [context.workspace.id, lead.website_url],
        );
        existingSite = existingSiteResult.rows[0];
        if (existingSite?.client_id) return "site_conflict" as const;
      }

      clientId = randomUUID();
      await client.query(
        "INSERT INTO clients (id, workspace_id, lead_id, name, status) VALUES ($1, $2, $3, $4, 'active')",
        [clientId, context.workspace.id, input.leadId, input.clientName],
      );
      const contactId = randomUUID();
      await client.query(
        `INSERT INTO contacts (id, workspace_id, client_id, name, email, phone, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [contactId, context.workspace.id, clientId, lead.name, lead.email, lead.phone],
      );

      let siteId: string | null = null;
      let siteAction: "site.created" | "site.client_linked" | null = null;
      if (input.createSite && lead.website_url) {
        if (existingSite) {
          siteId = existingSite.id;
          siteAction = "site.client_linked";
          await client.query(
            "UPDATE sites SET client_id = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3",
            [clientId, siteId, context.workspace.id],
          );
        } else {
          siteId = randomUUID();
          siteAction = "site.created";
          await client.query(
            `INSERT INTO sites (id, workspace_id, client_id, name, url, environment, status)
             VALUES ($1, $2, $3, $4, $5, 'production', 'active')`,
            [siteId, context.workspace.id, clientId, input.clientName, lead.website_url],
          );
        }
      }

      const projectId = randomUUID();
      await client.query(
        `INSERT INTO projects
          (id, workspace_id, client_id, lead_id, site_id, owner_user_id, name, status, summary, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', $8, now())`,
        [projectId, context.workspace.id, clientId, input.leadId, siteId, context.user.id, input.projectName, input.projectSummary ?? null],
      );
      await client.query(
        `UPDATE leads
         SET status = 'won', client_id = $1, converted_at = now(),
             outcome_summary = COALESCE(outcome_summary, 'Converted to an active client.'),
             next_action = NULL, next_action_at = NULL, updated_at = now()
         WHERE id = $2 AND workspace_id = $3`,
        [clientId, input.leadId, context.workspace.id],
      );
      for (const event of [
        { action: "lead.converted", type: "lead", id: input.leadId },
        { action: "client.created", type: "client", id: clientId },
        { action: "contact.created", type: "contact", id: contactId },
        { action: "project.created", type: "project", id: projectId },
        ...(siteId && siteAction ? [{ action: siteAction, type: "site", id: siteId }] : []),
      ]) {
        await insertAuditLog(client, {
          workspaceId: context.workspace.id,
          actorUserId: context.user.id,
          action: event.action,
          targetType: event.type,
          targetId: event.id,
        });
      }
      return "converted" as const;
    });
    if (converted === "site_conflict") {
      return { status: "error", message: "That website is already assigned to another client. Resolve the site record before converting this lead." };
    }
    if (converted !== "converted") return { status: "error", message: "This lead has already been converted or is no longer available." };
  } catch {
    return genericFailure;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/clients/${clientId}`);
}

export async function saveClientAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = clientSchema.safeParse(formValues(formData, ["clientId", "name", "status", "notes"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const clientId = input.clientId ?? randomUUID();
  try {
    const saved = await withTransaction(async (client) => {
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
  } catch {
    return genericFailure;
  }
  revalidatePath("/dashboard/clients");
  if (input.clientId) {
    revalidatePath(`/dashboard/clients/${clientId}`);
    return success("Client updated.");
  }
  redirect(`/dashboard/clients/${clientId}`);
}

export async function saveContactAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = contactSchema.safeParse({
    ...formValues(formData, ["contactId", "clientId", "name", "email", "phone", "title", "isPrimary"]),
    isPrimary: formData.get("isPrimary"),
  });
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  try {
    const created = await withTransaction(async (client) => {
      const owner = await client.query("SELECT 1 FROM clients WHERE id = $1 AND workspace_id = $2", [input.clientId, context.workspace.id]);
      if (!owner.rowCount) return false;
      const contactId = input.contactId ?? randomUUID();
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
          `INSERT INTO contacts (id, workspace_id, client_id, name, email, phone, title, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [contactId, context.workspace.id, input.clientId, input.name, input.email ?? null, input.phone ?? null, input.title ?? null, input.isPrimary],
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
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return success(input.contactId ? "Contact updated." : "Contact added.");
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { status: "error", message: "That email is already attached to this client." };
    return genericFailure;
  }
}

export async function saveSiteAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = siteSchema.safeParse(formValues(formData, ["siteId", "clientId", "name", "url", "environment", "status", "notes"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const siteId = input.siteId ?? randomUUID();
  try {
    const saved = await withTransaction(async (client) => {
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
    return genericFailure;
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sites");
  if (input.siteId) {
    revalidatePath(`/dashboard/sites/${siteId}`);
    return success("Site updated.");
  }
  redirect(`/dashboard/sites/${siteId}`);
}

export async function saveProjectAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = projectSchema.safeParse(formValues(formData, [
    "projectId", "clientId", "siteId", "ownerUserId", "name", "status", "summary", "startedAt", "dueAt",
  ]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  const projectId = input.projectId ?? randomUUID();
  try {
    const saved = await withTransaction(async (client) => {
      const clientRecord = await client.query("SELECT 1 FROM clients WHERE id = $1 AND workspace_id = $2", [input.clientId, context.workspace.id]);
      if (!clientRecord.rowCount) return false;
      if (input.projectId) {
        const existingProject = await client.query(
          "SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
          [projectId, context.workspace.id],
        );
        if (!existingProject.rowCount) return false;
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
    if (!saved) return missing();
  } catch {
    return genericFailure;
  }
  revalidatePath("/dashboard/projects");
  if (input.projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`);
    return success("Project updated.");
  }
  redirect(`/dashboard/projects/${projectId}`);
}

export async function addMilestoneAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = milestoneSchema.safeParse(formValues(formData, ["projectId", "title", "status", "dueAt"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  try {
    const created = await withTransaction(async (client) => {
      const project = await client.query("SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2", [input.projectId, context.workspace.id]);
      if (!project.rowCount) return false;
      const milestoneId = randomUUID();
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
    revalidatePath(`/dashboard/projects/${input.projectId}`);
    return success("Milestone added.");
  } catch {
    return genericFailure;
  }
}

export async function updateMilestoneStatusAction(formData: FormData) {
  const context = await mutationContext();
  if (!context) return;
  const parsed = milestoneStatusSchema.safeParse(formValues(formData, ["projectId", "milestoneId", "status"]));
  if (!parsed.success) return;
  const input = parsed.data;
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE project_milestones milestone
       SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE NULL END, updated_at = now()
       FROM projects project
       WHERE milestone.id = $2 AND milestone.project_id = project.id
         AND project.id = $3 AND project.workspace_id = $4`,
      [input.status, input.milestoneId, input.projectId, context.workspace.id],
    );
    if (!result.rowCount) return;
    await insertAuditLog(client, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "project.milestone_updated",
      targetType: "project_milestone",
      targetId: input.milestoneId,
      metadata: { projectId: input.projectId, status: input.status },
    });
  });
  revalidatePath(`/dashboard/projects/${input.projectId}`);
}

export async function addProjectRecordAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = projectRecordSchema.safeParse(formValues(formData, ["projectId", "kind", "title", "body"]));
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  try {
    const created = await withTransaction(async (client) => {
      const project = await client.query("SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2", [input.projectId, context.workspace.id]);
      if (!project.rowCount) return false;
      const recordId = randomUUID();
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
    revalidatePath(`/dashboard/projects/${input.projectId}`);
    return success(`${input.kind.charAt(0).toUpperCase() + input.kind.slice(1)} added.`);
  } catch {
    return genericFailure;
  }
}
