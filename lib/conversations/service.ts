import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeInbox } from "@/lib/inbox/data";
import {
  authorizedSources,
  scopes,
  sourceSelect,
  type SourceRow,
  ConversationAccessError,
} from "./access";
import {
  contextSchema,
  mergeSchema,
  noteSchema,
  readSchema,
  sourceSchema,
  workSchema,
} from "./validation";
export class ConversationInputError extends Error {}
async function transaction<T>(
  context: DashboardContext,
  work: (db: PoolClient) => Promise<T>,
  read = false,
) {
  await authorizeInbox(context, !read);
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `unified-work:${context.workspace.id}`,
    ]);
    const role = (
      await db.query<{ role: string }>(
        `SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w`,
        [context.workspace.id, context.user.id],
      )
    ).rows[0]?.role;
    if (!role || (!read && role === "viewer"))
      throw new ConversationAccessError(
        "Your workspace access does not allow changes.",
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
async function available(context: DashboardContext, id: string, all = false) {
  const scope = await scopes(context),
    sources = await authorizedSources(context, scope, id);
  if (!sources.length)
    throw new ConversationAccessError(
      "This conversation is not available to your account.",
    );
  if (all) {
    const count = Number(
      (
        await getDatabasePool().query(
          "SELECT count(*)::int AS n FROM crm_conversation_sources WHERE workspace_id=$1 AND conversation_id=$2",
          [context.workspace.id, id],
        )
      ).rows[0].n,
    );
    if (sources.length !== count)
      throw new ConversationAccessError(
        "All sources must be available before changing this relationship.",
      );
  }
  return sources;
}
async function audit(
  db: PoolClient,
  context: DashboardContext,
  action: string,
  id: string,
  metadata: Record<string, unknown> = {},
) {
  await insertAuditLog(db, {
    workspaceId: context.workspace.id,
    actorUserId: context.user.id,
    action,
    targetType: "crm_conversation",
    targetId: id,
    metadata,
  });
}
export async function saveConversationWork(
  context: DashboardContext,
  raw: unknown,
) {
  const input = workSchema.parse(raw);
  if (input.remindAt && new Date(input.remindAt) <= new Date())
    throw new ConversationInputError("Choose a reminder in the future.");
  if (input.remindAt && input.status !== "needs_reply")
    throw new ConversationInputError(
      "A reminder belongs to a Needs reply conversation.",
    );
  await available(context, input.conversationId, true);
  await transaction(context, async (db) => {
    await available(context, input.conversationId, true);
    if (
      input.ownerId &&
      !(
        await db.query(
          "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role<>'viewer'",
          [context.workspace.id, input.ownerId],
        )
      ).rowCount
    )
      throw new ConversationInputError(
        "Choose an active editor in this workspace.",
      );
    await db.query(
      "UPDATE crm_conversations SET owner_user_id=$3,status=$4,remind_at=$5,work_updated_at=now(),updated_at=now() WHERE workspace_id=$1 AND id=$2 AND merged_into_id IS NULL",
      [
        context.workspace.id,
        input.conversationId,
        input.ownerId || null,
        input.status,
        input.remindAt || null,
      ],
    );
    await audit(
      db,
      context,
      "conversation.work_updated",
      input.conversationId,
      { status: input.status },
    );
  });
}
export async function markConversationRead(
  context: DashboardContext,
  raw: unknown,
) {
  const input = readSchema.parse(raw),
    sources = await available(context, input.conversationId);
  await transaction(
    context,
    async (db) => {
      for (const source of sources)
        if (source.latest_message_id)
          await db.query(
            "INSERT INTO crm_conversation_reads(workspace_id,source_id,user_id,latest_message_id) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,source_id,user_id) DO UPDATE SET latest_message_id=EXCLUDED.latest_message_id,read_at=now()",
            [
              context.workspace.id,
              source.id,
              context.user.id,
              source.latest_message_id,
            ],
          );
    },
    true,
  );
}
export async function addConversationNote(
  context: DashboardContext,
  raw: unknown,
) {
  const input = noteSchema.parse(raw),
    sources = await available(context, input.conversationId);
  if (!sources.some((s) => s.id === input.audienceSourceId))
    throw new ConversationAccessError(
      "Choose an available audience for this note.",
    );
  await transaction(context, async (db) => {
    const current = await available(context, input.conversationId);
    if (!current.some((s) => s.id === input.audienceSourceId))
      throw new ConversationAccessError(
        "This note audience changed. Refresh before saving.",
      );
    await db.query(
      "INSERT INTO crm_conversation_notes(id,workspace_id,conversation_id,audience_source_id,author_user_id,body) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS(SELECT 1 FROM crm_conversation_sources WHERE id=$4 AND workspace_id=$2 AND conversation_id=$3)",
      [
        randomUUID(),
        context.workspace.id,
        input.conversationId,
        input.audienceSourceId,
        context.user.id,
        input.body,
      ],
    );
    await audit(db, context, "conversation.note_added", input.conversationId);
  });
}
export async function linkConversationContext(
  context: DashboardContext,
  raw: unknown,
) {
  const input = contextSchema.parse(raw);
  await available(context, input.conversationId, true);
  await transaction(context, async (db) => {
    await available(context, input.conversationId, true);
    let businessId = input.businessId ?? null;
    if (input.contactId) {
      const contact = (
        await db.query<{ business_id: string | null }>(
          "SELECT business_id FROM contacts WHERE id=$1 AND workspace_id=$2",
          [input.contactId, context.workspace.id],
        )
      ).rows[0];
      if (!contact)
        throw new ConversationInputError("Choose a contact in this workspace.");
      if (businessId && contact.business_id !== businessId)
        throw new ConversationInputError(
          "The selected contact belongs to a different business.",
        );
      businessId = contact.business_id;
    }
    if (input.leadId) {
      const lead = (
        await db.query<{
          business_id: string | null;
          anonymized_at: Date | null;
        }>(
          "SELECT business_id,anonymized_at FROM leads WHERE id=$1 AND workspace_id=$2",
          [input.leadId, context.workspace.id],
        )
      ).rows[0];
      if (!lead || lead.anonymized_at)
        throw new ConversationInputError(
          "Choose an available lead in this workspace.",
        );
      if (lead.business_id && businessId && lead.business_id !== businessId)
        throw new ConversationInputError(
          "The lead belongs to a different business.",
        );
      businessId ??= lead.business_id;
    }
    if (
      businessId &&
      !(
        await db.query(
          "SELECT 1 FROM crm_businesses WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",
          [context.workspace.id, businessId],
        )
      ).rowCount
    )
      throw new ConversationInputError(
        "Choose an available business in this workspace.",
      );
    await db.query(
      "UPDATE crm_conversations SET contact_id=$3,lead_id=$4,business_id=$5,updated_at=now() WHERE workspace_id=$1 AND id=$2",
      [
        context.workspace.id,
        input.conversationId,
        input.contactId || null,
        input.leadId || null,
        businessId,
      ],
    );
    await audit(
      db,
      context,
      "conversation.context_linked",
      input.conversationId,
    );
  });
}
async function merge(
  context: DashboardContext,
  fromId: string,
  toId: string,
  confirmed: boolean,
  onlySource?: string,
) {
  await authorizeInbox(context, true);
  if (fromId === toId)
    throw new ConversationInputError("Choose another conversation.");
  const previous = (
    await getDatabasePool().query<{ merged_into_id: string | null }>(
      "SELECT merged_into_id FROM crm_conversations WHERE workspace_id=$1 AND id=$2",
      [context.workspace.id, fromId],
    )
  ).rows[0];
  if (previous?.merged_into_id === toId) {
    await available(context, toId, true);
    return toId;
  }
  await available(context, fromId, true);
  await available(context, toId, true);
  return transaction(context, async (db) => {
    await available(context, fromId, true);
    await available(context, toId, true);
    const rows = await db.query<{
      id: string;
      owner_user_id: string | null;
      status: string;
      contact_id: string | null;
      lead_id: string | null;
      business_id: string | null;
    }>(
      "SELECT * FROM crm_conversations WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND merged_into_id IS NULL FOR UPDATE",
      [context.workspace.id, [fromId, toId]],
    );
    const from = rows.rows.find((r) => r.id === fromId),
      to = rows.rows.find((r) => r.id === toId);
    if (!from || !to)
      throw new ConversationInputError(
        "Refresh these conversations before linking.",
      );
    const conflict = [
      "owner_user_id",
      "status",
      "contact_id",
      "lead_id",
      "business_id",
    ].some(
      (key) =>
        from[key as keyof typeof from] &&
        to[key as keyof typeof to] &&
        from[key as keyof typeof from] !== to[key as keyof typeof to],
    );
    if (conflict && !confirmed)
      throw new ConversationInputError(
        "These histories have different owners, work states or CRM identities. Confirm keeping the destination context before merging.",
      );
    await db.query(
      `UPDATE crm_conversation_sources SET conversation_id=$3 WHERE workspace_id=$1 AND conversation_id=$2 ${onlySource ? "AND id=$4" : ""}`,
      [context.workspace.id, fromId, toId, ...(onlySource ? [onlySource] : [])],
    );
    await db.query(
      `UPDATE crm_conversation_notes SET conversation_id=$3 WHERE workspace_id=$1 AND conversation_id=$2 ${onlySource ? "AND audience_source_id=$4" : ""}`,
      [context.workspace.id, fromId, toId, ...(onlySource ? [onlySource] : [])],
    );
    const remaining = (
      await db.query(
        "SELECT 1 FROM crm_conversation_sources WHERE workspace_id=$1 AND conversation_id=$2",
        [context.workspace.id, fromId],
      )
    ).rowCount;
    if (!remaining)
      await db.query(
        "UPDATE crm_conversations SET merged_into_id=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",
        [context.workspace.id, fromId, toId],
      );
    await audit(db, context, "conversation.sources_merged", toId, {
      sourceConversationId: fromId,
      contextConflict: conflict,
    });
    return toId;
  });
}
export async function mergeConversations(
  context: DashboardContext,
  raw: unknown,
) {
  const input = mergeSchema.parse(raw);
  return merge(
    context,
    input.conversationId,
    input.targetConversationId,
    input.confirmConflict,
  );
}
export async function linkConversationSource(
  context: DashboardContext,
  raw: unknown,
) {
  const input = sourceSchema.parse(raw);
  const row = (
    await getDatabasePool().query<SourceRow>(
      `${sourceSelect} WHERE s.workspace_id=$1 AND s.id=$2`,
      [context.workspace.id, input.sourceId],
    )
  ).rows[0];
  if (!row) throw new ConversationAccessError("This source is not available.");
  if (row.conversation_id === input.conversationId) {
    await authorizeInbox(context, true);
    await available(context, input.conversationId, true);
    return input.conversationId;
  }
  return merge(
    context,
    row.conversation_id,
    input.conversationId,
    input.confirmConflict,
    input.sourceId,
  );
}
