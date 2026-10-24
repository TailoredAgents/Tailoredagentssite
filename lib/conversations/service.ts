import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeInbox } from "@/lib/inbox/data";
import { getMailThreadHistory } from "@/lib/inbox/mail-provider";
import { getConversationRecipient, recipientMatchesAddress, recipientMatchesConversation } from "./recipients";
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

// Called only after the channel service has returned an accepted send receipt.
// Linking must never turn an accepted send into a retryable send failure.
export async function bindSentRecipient(
  context: DashboardContext,
  form: FormData,
  receipt: { channel: "email" | "sms"; id: string },
) {
  const recipient = await getConversationRecipient(context, String(form.get("recipientKind") || ""), String(form.get("recipientId") || ""));
  if (!recipient) throw new ConversationInputError("The recipient is no longer available.");
  const scope = await scopes(context);
  const mailboxId = String(form.get("mailboxId") || "");
  const numberId = String(form.get("numberId") || "");
  let addresses: string[], latestId: string | null, activity: Date, inbound: Date | null, outbound: Date | null;
  if (receipt.channel === "sms") {
    if (!scope.numbers.some(n => n.id === numberId)) throw new ConversationAccessError("Number access changed.");
    const sms = (await getDatabasePool().query<{remote_phone:string;last_message_at:Date;last_inbound_at:Date|null;last_outbound_at:Date|null;latest:string|null}>(
      `SELECT c.remote_phone,
        (SELECT max(created_at) FROM sms_messages m WHERE m.workspace_id=c.workspace_id AND m.conversation_id=c.id) last_message_at,
        (SELECT max(created_at) FROM sms_messages m WHERE m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND direction='inbound') last_inbound_at,
        (SELECT max(created_at) FROM sms_messages m WHERE m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND direction='outbound') last_outbound_at,
        (SELECT id::text FROM sms_messages m WHERE m.workspace_id=c.workspace_id AND m.conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) latest FROM sms_conversations c WHERE c.workspace_id=$1 AND c.number_id=$2 AND c.id=$3`,
      [context.workspace.id, numberId, receipt.id],
    )).rows[0];
    if (!sms) throw new ConversationAccessError("Text history is unavailable.");
    addresses = [sms.remote_phone]; latestId = sms.latest; activity = sms.last_message_at; inbound = sms.last_inbound_at; outbound = sms.last_outbound_at;
  } else {
    if (!scope.mailboxes.some(m => m.id === mailboxId)) throw new ConversationAccessError("Mailbox access changed.");
    const page = await getMailThreadHistory(context, mailboxId, receipt.id, { limit: 50 });
    // Only the actual provider-confirmed destination can establish the CRM link.
    addresses = [...new Set(page.messages.filter(m => m.direction === "outbound").map(m => m.to))];
    const last = page.messages.at(-1);
    if (!last) throw new ConversationInputError("Email history is still syncing.");
    latestId = last.id; activity = new Date(last.createdAt);
    const received = [...page.messages].reverse().find(m => m.direction === "inbound");
    const sent = [...page.messages].reverse().find(m => m.direction === "outbound");
    inbound = received ? new Date(received.createdAt) : null; outbound = sent ? new Date(sent.createdAt) : null;
  }
  if (!addresses.length || !addresses.every(address => recipientMatchesAddress(recipient, address)))
    throw new ConversationInputError("The message destination does not match this person.");
  return transaction(context, async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [receipt.channel === "sms" ? `unified-sms:${context.workspace.id}:${numberId}` : `unified-mail:${context.workspace.id}:${mailboxId}`]);
    const fresh = await scopes(context);
    if (receipt.channel === "sms" ? !fresh.numbers.some(n => n.id === numberId) : !fresh.mailboxes.some(m => m.id === mailboxId))
      throw new ConversationAccessError("Channel access changed.");
    const existing = (await db.query<{id:string;conversation_id:string}>(
      `SELECT id,conversation_id FROM crm_conversation_sources WHERE workspace_id=$1 AND ${receipt.channel === "sms" ? "sms_conversation_id=$2" : "thread_id=$2 AND mailbox_id=$3"} FOR UPDATE`,
      [context.workspace.id, receipt.id, ...(receipt.channel === "email" ? [mailboxId] : [])],
    )).rows[0];
    let canonicalId = existing?.conversation_id;
    const target = String(form.get("crmConversationId") || "");
    // Existing histories keep their identity and work state. Only a newly created
    // source can join the conversation from which the user started the send.
    if (!canonicalId && target) {
      await available(context, target, true);
      const row = (await db.query<{contact_id:string|null;lead_id:string|null;business_id:string|null}>("SELECT contact_id,lead_id,business_id FROM crm_conversations WHERE workspace_id=$1 AND id=$2 AND merged_into_id IS NULL FOR UPDATE", [context.workspace.id,target])).rows[0];
      const sources = await authorizedSources(context, fresh, target);
      if (row && recipientMatchesConversation(recipient,row,sources.flatMap(s => s.external_addresses))) canonicalId = target;
    }
    if (canonicalId) {
      if (existing) await available(context, canonicalId, true);
      const row = (await db.query<{contact_id:string|null;lead_id:string|null;business_id:string|null}>("SELECT contact_id,lead_id,business_id FROM crm_conversations WHERE workspace_id=$1 AND id=$2 AND merged_into_id IS NULL FOR UPDATE", [context.workspace.id,canonicalId])).rows[0];
      if (!row || !recipientMatchesConversation(recipient,row,addresses)) throw new ConversationInputError("This history is linked to another CRM record.");
      await db.query(`UPDATE crm_conversations SET ${recipient.kind === "lead" ? "lead_id" : "contact_id"}=$3,business_id=COALESCE(business_id,$4),updated_at=now() WHERE workspace_id=$1 AND id=$2`,[context.workspace.id,canonicalId,recipient.id,recipient.businessId]);
    } else {
      canonicalId = randomUUID();
      await db.query("INSERT INTO crm_conversations(id,workspace_id,contact_id,lead_id,business_id,owner_user_id,status) VALUES($1,$2,$3,$4,$5,$6,'waiting')",[canonicalId,context.workspace.id,recipient.kind === "contact" ? recipient.id : null,recipient.kind === "lead" ? recipient.id : null,recipient.businessId,context.user.id]);
    }
    if (!existing) await db.query(
      `INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,mailbox_id,thread_id,sms_conversation_id,external_addresses,latest_message_id,last_activity_at,last_inbound_at,last_outbound_at,seen_sweep) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,(SELECT sweep_id FROM crm_conversation_sync WHERE workspace_id=$2 AND mailbox_id=$5))`,
      [randomUUID(),context.workspace.id,canonicalId,receipt.channel,receipt.channel === "email" ? mailboxId : null,receipt.channel === "email" ? receipt.id : null,receipt.channel === "sms" ? receipt.id : null,addresses,latestId,activity,inbound,outbound],
    );
    await audit(db,context,"conversation.recipient_linked",canonicalId);
    return canonicalId;
  });
}
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
