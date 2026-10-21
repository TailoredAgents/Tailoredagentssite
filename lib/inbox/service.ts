import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeInbox, InboxAccessError, requireInboxMailbox } from "./data";
import { getMailThread, sendMail, MailProviderError } from "./mail-provider";
import {
  conversationSchema,
  draftSchema,
  noteSchema,
  sendSchema,
  threadSchema,
} from "./validation";
import type { InboxActionState } from "./validation";

export class InboxInputError extends Error {}
async function transaction<T>(
  context: DashboardContext,
  work: (db: PoolClient) => Promise<T>,
) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `agency-inbox:${context.workspace.id}`,
    ]);
    const access = await db.query(
      "SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin','member') AND w.status='active'",
      [context.workspace.id, context.user.id],
    );
    if (!access.rowCount)
      throw new InboxAccessError(
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
async function ensureConversation(
  db: PoolClient,
  context: DashboardContext,
  mailboxId: string,
  threadId: string,
) {
  const found = await db.query<{ id: string }>(
    `INSERT INTO inbox_conversations(id,workspace_id,mailbox_id,thread_id) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,mailbox_id,thread_id) DO UPDATE SET thread_id=EXCLUDED.thread_id RETURNING id`,
    [randomUUID(), context.workspace.id, mailboxId, threadId],
  );
  return found.rows[0].id;
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
    targetType: "inbox_conversation",
    targetId: id,
    metadata,
  });
}
async function editableThread(
  context: DashboardContext,
  mailboxId: string,
  threadId: string,
) {
  await authorizeInbox(context, true);
  await requireInboxMailbox(context, mailboxId);
  return getMailThread(context, mailboxId, threadId);
}
export async function saveConversation(
  context: DashboardContext,
  raw: unknown,
) {
  const input = conversationSchema.parse(raw);
  await editableThread(context, input.mailboxId, input.threadId);
  await transaction(context, async (db) => {
    if (
      input.ownerId &&
      !(
        await db.query(
          "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin','member')",
          [context.workspace.id, input.ownerId],
        )
      ).rowCount
    )
      throw new InboxInputError(
        "Choose an active teammate with editing access.",
      );
    if (
      input.businessId &&
      !(
        await db.query(
          "SELECT 1 FROM crm_businesses WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",
          [context.workspace.id, input.businessId],
        )
      ).rowCount
    )
      throw new InboxInputError(
        "Choose an available business in this workspace.",
      );
    if (
      input.leadId &&
      !(
        await db.query(
          "SELECT 1 FROM leads WHERE workspace_id=$1 AND id=$2 AND status<>'archived'",
          [context.workspace.id, input.leadId],
        )
      ).rowCount
    )
      throw new InboxInputError("Choose an available lead in this workspace.");
    const id = await ensureConversation(
      db,
      context,
      input.mailboxId,
      input.threadId,
    );
    await db.query(
      "UPDATE inbox_conversations SET status=$1,owner_user_id=$2,business_id=$3,lead_id=$4,updated_at=now() WHERE id=$5 AND workspace_id=$6",
      [
        input.status,
        input.ownerId || null,
        input.businessId || null,
        input.leadId || null,
        id,
        context.workspace.id,
      ],
    );
    await audit(db, context, "inbox.conversation_updated", id, {
      status: input.status,
    });
  });
}
export async function addInboxNote(context: DashboardContext, raw: unknown) {
  const input = noteSchema.parse(raw);
  await editableThread(context, input.mailboxId, input.threadId);
  await transaction(context, async (db) => {
    const id = await ensureConversation(
      db,
      context,
      input.mailboxId,
      input.threadId,
    );
    await db.query(
      "INSERT INTO inbox_notes(id,workspace_id,conversation_id,author_user_id,body) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), context.workspace.id, id, context.user.id, input.body],
    );
    await audit(db, context, "inbox.note_added", id);
  });
}
export async function saveDraft(context: DashboardContext, raw: unknown) {
  const input = draftSchema.parse(raw);
  await authorizeInbox(context, true);
  await requireInboxMailbox(context, input.mailboxId);
  if (input.threadId)
    await getMailThread(context, input.mailboxId, input.threadId);
  await transaction(context, async (db) => {
    await db.query(
      `INSERT INTO inbox_drafts(id,workspace_id,mailbox_id,thread_key,author_user_id,recipient,subject,body,reply_to_message_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,mailbox_id,thread_key,author_user_id) DO UPDATE SET recipient=EXCLUDED.recipient,subject=EXCLUDED.subject,body=EXCLUDED.body,reply_to_message_id=EXCLUDED.reply_to_message_id,updated_at=now()`,
      [
        randomUUID(),
        context.workspace.id,
        input.mailboxId,
        input.threadId || "",
        context.user.id,
        input.to,
        input.subject,
        input.text,
        input.replyToMessageId || null,
      ],
    );
  });
}
export async function markInboxRead(context: DashboardContext, raw: unknown) {
  const input = threadSchema.parse(raw);
  await authorizeInbox(context);
  await requireInboxMailbox(context, input.mailboxId);
  const thread = await getMailThread(context, input.mailboxId, input.threadId);
  const latest = thread.messages.at(-1)?.id;
  if (!latest)
    throw new InboxInputError("This conversation has no message to mark read.");
  // Read receipts are the sole mutation allowed to an active viewer. The action
  // still rechecks database membership and the live provider grant above.
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await authorizeInbox(context);
    const id = await ensureConversation(
      db,
      context,
      input.mailboxId,
      input.threadId,
    );
    await db.query(
      `INSERT INTO inbox_read_receipts(workspace_id,conversation_id,user_id,latest_message_id) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,conversation_id,user_id) DO UPDATE SET latest_message_id=EXCLUDED.latest_message_id,read_at=now()`,
      [context.workspace.id, id, context.user.id, latest],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
type Intent = {
  actor_user_id: string | null;
  mailbox_id: string;
  request_hash: string;
  state: "pending" | "accepted" | "unknown" | "failed";
  message_id: string | null;
  thread_id: string | null;
  provider_status: "accepted" | "pending" | null;
  updated_at: Date;
};
function sendState(requestId: string, intent: Intent): InboxActionState {
  if (intent.state === "accepted")
    return {
      status: "success",
      message:
        intent.provider_status === "pending"
          ? "Mail has queued this message. Delivery is not yet confirmed."
          : "Mail accepted this message. Delivery is not yet confirmed.",
      requestId,
      sendState: "accepted",
      threadId: intent.thread_id!,
    };
  return {
    status: "error",
    message:
      "The send is still being checked. Keep this message unchanged and use the same request to check again.",
    requestId,
    sendState: intent.state === "pending" ? "pending" : "unknown",
  };
}
function providerKey(workspaceId: string, requestId: string) {
  const bytes = createHash("sha256")
    .update(`tailored-agents-inbox:${workspaceId}:${requestId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function sendInboxMessage(
  context: DashboardContext,
  raw: unknown,
): Promise<InboxActionState> {
  const input = sendSchema.parse(raw);
  // Drafts preserve the editor's whitespace, while the send payload is trimmed.
  // Cleanup must compare the original editor value so an accepted message does
  // not leave its saved draft behind, without deleting a newer tab's draft.
  const submittedDraftText = draftSchema.pick({ text: true }).parse(raw).text;
  const mailbox = await requireInboxMailbox(context, input.mailboxId, true);
  let recipients: string[];
  if (input.threadId || input.replyToMessageId) {
    if (!input.threadId || !input.replyToMessageId)
      throw new InboxInputError(
        "Choose a message in this conversation to reply to.",
      );
    const thread = await getMailThread(
      context,
      input.mailboxId,
      input.threadId,
    );
    const original = thread.messages.find(
      (message) => message.id === input.replyToMessageId,
    );
    if (!original)
      throw new InboxInputError(
        "The message being replied to is no longer available.",
      );
    recipients = original.replyTargets.map((address) =>
      address.trim().toLowerCase(),
    );
    if (
      !recipients.length ||
      recipients.length > 20 ||
      recipients.some(
        (address) => !z.string().email().max(254).safeParse(address).success,
      )
    )
      throw new InboxInputError(
        "Mail could not establish safe reply recipients. Compose a new message with a verified email address.",
      );
  } else {
    recipients = [
      z
        .string()
        .trim()
        .toLowerCase()
        .email("Enter a valid recipient email.")
        .max(254)
        .parse(input.to),
    ];
    if (!input.subject) throw new InboxInputError("Enter a subject.");
  }
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        actor: context.user.id,
        mailbox: mailbox.id,
        thread: input.threadId ?? null,
        reply: input.replyToMessageId ?? null,
        recipients: [...recipients].sort(),
        subject: input.subject,
        text: input.text,
      }),
    )
    .digest("hex");
  const reservation = await transaction(context, async (db) => {
    const existing = await db.query<Intent>(
      "SELECT * FROM inbox_outbound_intents WHERE workspace_id=$1 AND request_id=$2 FOR UPDATE",
      [context.workspace.id, input.requestId],
    );
    let intent = existing.rows[0];
    if (intent) {
      if (
        intent.actor_user_id !== context.user.id ||
        intent.mailbox_id !== input.mailboxId ||
        intent.request_hash !== requestHash
      )
        throw new InboxInputError(
          "This send request belongs to a different message. Keep its contents unchanged while checking the send status.",
        );
      if (
        intent.state === "accepted" ||
        (intent.state === "pending" &&
          Date.now() - intent.updated_at.getTime() < 90000)
      )
        return { send: false, intent, uncertain: false };
    }
    const blocked = await db.query(
      "SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='email' AND status='blocked' AND normalized_address=ANY($2::text[]) LIMIT 1",
      [context.workspace.id, recipients],
    );
    if (blocked.rowCount)
      throw new InboxInputError(
        "A recipient is marked Do not email. Resolve the recorded preference before sending.",
      );
    if (intent)
      await db.query(
        "UPDATE inbox_outbound_intents SET state='pending',updated_at=now() WHERE workspace_id=$1 AND request_id=$2",
        [context.workspace.id, input.requestId],
      );
    else {
      const created = await db.query<Intent>(
        "INSERT INTO inbox_outbound_intents(workspace_id,request_id,actor_user_id,mailbox_id,request_hash) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [
          context.workspace.id,
          input.requestId,
          context.user.id,
          input.mailboxId,
          requestHash,
        ],
      );
      intent = created.rows[0];
    }
    return {
      send: true,
      intent,
      uncertain:
        !!existing.rows[0] &&
        ["unknown", "pending"].includes(existing.rows[0].state),
    };
  });
  if (!reservation.send) return sendState(input.requestId, reservation.intent);
  try {
    // The gateway must revalidate current Mail permission and honor this exact
    // idempotency key. Unknown/crashed calls never create a fresh provider key.
    const result = await sendMail(context, {
      mailboxId: input.mailboxId,
      fromAddressId: mailbox.id,
      threadId: input.threadId,
      replyToMessageId: input.replyToMessageId,
      to: input.threadId ? undefined : recipients[0],
      subject: input.subject,
      text: input.text,
      idempotencyKey: providerKey(context.workspace.id, input.requestId),
    });
    const resultRow = await transaction(context, async (db) => {
      const updated = await db.query<Intent>(
        "UPDATE inbox_outbound_intents SET state='accepted',message_id=$1,thread_id=$2,provider_status=$3,updated_at=now() WHERE workspace_id=$4 AND request_id=$5 RETURNING *",
        [
          result.messageId,
          result.threadId,
          result.status,
          context.workspace.id,
          input.requestId,
        ],
      );
      const id = await ensureConversation(
        db,
        context,
        input.mailboxId,
        result.threadId,
      );
      await db.query(
        "DELETE FROM inbox_drafts WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_key=$3 AND author_user_id=$4 AND body=$5 AND recipient=$6 AND subject=$7 AND reply_to_message_id IS NOT DISTINCT FROM $8",
        [
          context.workspace.id,
          input.mailboxId,
          input.threadId || "",
          context.user.id,
          submittedDraftText,
          input.to,
          input.subject,
          input.replyToMessageId || null,
        ],
      );
      await audit(db, context, "inbox.message_accepted", id, {
        requestId: input.requestId,
        status: result.status,
      });
      return updated.rows[0];
    });
    return sendState(input.requestId, resultRow);
  } catch (error) {
    // Keep safe operational state even when an administrator revoked access
    // during the send. No message/body/address is persisted in the receipt.
    const rejected =
      error instanceof MailProviderError &&
      error.outcome === "rejected" &&
      !reservation.uncertain;
    await getDatabasePool().query(
      "UPDATE inbox_outbound_intents SET state=$3,updated_at=now() WHERE workspace_id=$1 AND request_id=$2 AND state='pending'",
      [context.workspace.id, input.requestId, rejected ? "failed" : "unknown"],
    );
    if (rejected)
      return {
        status: "error",
        message: error.message,
        requestId: input.requestId,
        sendState: "rejected",
      };
    return {
      status: "error",
      message:
        "Mail has not confirmed this send. Keep this message unchanged and check again using the same request. It may already have been accepted.",
      requestId: input.requestId,
      sendState: "unknown",
    };
  }
}
