import { leadOptionLabel } from "@/lib/operations/format";
import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  getMailThread,
  listMailboxes,
  listMailThreads,
  MailProviderError,
} from "./mail-provider";
import type {
  InboxConversation,
  InboxDraft,
  InboxFilters,
  InboxMailbox,
  InboxRecord,
  InboxWorkspace,
  MailThread,
} from "./types";

export class InboxAccessError extends Error {}
export async function authorizeInbox(
  context: DashboardContext,
  mutate = false,
) {
  const result = await getDatabasePool().query<{ role: string }>(
    "SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",
    [context.workspace.id, context.user.id],
  );
  const role = result.rows[0]?.role;
  if (!role || (mutate && !["owner", "admin", "member"].includes(role)))
    throw new InboxAccessError(
      "Your workspace access does not allow this action.",
    );
  return role;
}
export async function requireInboxMailbox(
  context: DashboardContext,
  mailboxId: string,
  sending = false,
): Promise<InboxMailbox> {
  await authorizeInbox(context, sending);
  const mailbox = (await listMailboxes(context)).find(
    (item) => item.id === mailboxId,
  );
  if (!mailbox)
    throw new InboxAccessError(
      "This mailbox is not available to your account.",
    );
  if (sending && !mailbox.canSend)
    throw new InboxAccessError(
      "Your Mail permission allows reading this mailbox, but not sending from it.",
    );
  return mailbox;
}
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
type Metadata = {
  deleted_at: Date | null;
  thread_id: string;
  status: "open" | "waiting" | "done";
  owner_id: string | null;
  owner_name: string | null;
  business_id: string | null;
  lead_id: string | null;
  latest_message_id: string | null;
};
function conversation(
  thread: MailThread,
  mailboxId: string,
  row?: Metadata,
): InboxConversation {
  return {
    ...thread,
    mailboxId,
    isRead: row?.latest_message_id === thread.latestMessageId,
    status: row?.status ?? "open",
    ownerId: row?.owner_id ?? null,
    ownerName: row?.owner_name ?? null,
    businessId: row?.business_id ?? null,
    leadId: row?.lead_id ?? null,
  };
}
async function getPrivateInboxDraft(
  context: DashboardContext,
  mailboxId: string,
  threadId = "",
): Promise<InboxDraft | null> {
  // Callers must have just verified live Mail access; this helper is not an action.
  const found = await getDatabasePool().query<{
    id: string;
    text: string;
    to: string;
    subject: string;
    replyToMessageId: string | null;
  }>(
    `SELECT id,body AS text,recipient AS "to",subject,reply_to_message_id AS "replyToMessageId" FROM inbox_drafts WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_key=$3 AND author_user_id=$4 AND updated_at>now()-interval '90 days'`,
    [context.workspace.id, mailboxId, threadId, context.user.id],
  );
  return found.rows[0] ?? null;
}
export async function listInboxWorkspace(
  context: DashboardContext,
  filters: InboxFilters = {},
): Promise<InboxWorkspace> {
  await authorizeInbox(context);
  const view = ["sent", "archive"].includes(one(filters.view))
    ? (one(filters.view) as "sent" | "archive")
    : "inbox";
  const q = one(filters.q).slice(0, 120),
    unreadOnly = one(filters.unread) === "1";
  const requestedPage = Math.min(
    10000,
    Math.max(1, Number.parseInt(one(filters.page), 10) || 1),
  );
  const blank: InboxWorkspace = {
    connection: { state: "ready", message: "Connected to Tailored Mail." },
    mailboxes: [],
    mailbox: null,
    items: [],
    total: 0,
    page: requestedPage,
    pages: 1,
    q,
    view,
    unreadOnly,
    selected: null,
    members: [],
    links: { businesses: [], leads: [] },
  };
  try {
    const mailboxes = await listMailboxes(context);
    if (!mailboxes.length)
      return {
        ...blank,
        connection: {
          state: "grant_required",
          message:
            "A Tailored Mail administrator must grant your account access to the shared sales address.",
        },
      };
    const requestedMailbox = one(filters.mailbox);
    const mailbox = requestedMailbox
      ? mailboxes.find((item) => item.id === requestedMailbox)
      : mailboxes[0];
    if (!mailbox)
      return {
        ...blank,
        connection: {
          state: "grant_required",
          message: "This mailbox is not available to your account.",
        },
      };
    // Unread is actor-specific CRM metadata, not Mail's shared global read flag.
    // Provider applies folder/search/pagination. Filter the current page only.
    const listed = await listMailThreads(context, mailbox.id, {
      view,
      q,
      page: requestedPage,
      unreadOnly: false,
    });
    const selectedId = one(filters.thread).slice(0, 200);
    const selectedThread = selectedId
      ? await getMailThread(context, mailbox.id, selectedId)
      : null;
    const ids = [
      ...new Set([
        ...listed.items.map((item) => item.id),
        ...(selectedThread ? [selectedThread.threadId] : []),
      ]),
    ];
    const pool = getDatabasePool();
    const [metadata, members, businesses, leads] = await Promise.all([
      pool.query<Metadata>(
        `SELECT c.deleted_at,c.thread_id,c.status,c.owner_user_id AS owner_id,u.name AS owner_name,c.business_id,c.lead_id,r.latest_message_id FROM inbox_conversations c LEFT JOIN "user" u ON u.id=c.owner_user_id LEFT JOIN inbox_read_receipts r ON r.conversation_id=c.id AND r.workspace_id=c.workspace_id AND r.user_id=$4 WHERE c.workspace_id=$1 AND c.mailbox_id=$2 AND c.thread_id=ANY($3::text[])`,
        [context.workspace.id, mailbox.id, ids, context.user.id],
      ),
      pool.query<{ id: string; name: string; email: string }>(
        `SELECT u.id,u.name,u.email FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' AND m.role IN ('owner','admin','member') ORDER BY u.name LIMIT 200`,
        [context.workspace.id],
      ),
      pool.query<{ id: string; name: string; clientId: string | null }>(
        `SELECT id,name,client_id AS "clientId" FROM crm_businesses WHERE workspace_id=$1 AND anonymized_at IS NULL ORDER BY name LIMIT 500`,
        [context.workspace.id],
      ),
      pool.query<{ id: string; name: string; organization: string; phone: string | null; email: string | null }>(
        `SELECT id,name,organization,phone,email FROM leads WHERE workspace_id=$1 AND status<>'archived' ORDER BY created_at DESC LIMIT 500`,
        [context.workspace.id],
      ),
    ]);
    const rows = new Map(metadata.rows.map((row) => [row.thread_id, row]));
    const items = listed.items.filter(item => !rows.get(item.id)?.deleted_at).map((item) =>
      conversation(item, mailbox.id, rows.get(item.id)),
    );
    let selected: InboxRecord | null = null;
    if (selectedThread && !rows.get(selectedThread.threadId)?.deleted_at) {
      const latest = selectedThread.messages.at(-1);
      const listItem = listed.items.find(
        (item) => item.id === selectedThread.threadId,
      ) ?? {
        id: selectedThread.threadId,
        latestMessageId: latest?.id ?? "",
        subject: selectedThread.subject,
        preview: latest?.text.slice(0, 200) ?? "",
        participants: [
          ...new Set(
            selectedThread.messages.flatMap((message) => [
              message.from,
              message.to,
            ]),
          ),
        ],
        messageCount: selectedThread.messages.length,
        isRead: false,
        hasAttachments: selectedThread.messages.some(
          (message) => message.attachments.length > 0,
        ),
        deliveryStatus: latest?.deliveryStatus ?? null,
        updatedAt: latest?.createdAt ?? new Date(0).toISOString(),
      };
      const notes = await pool.query<{
        id: string;
        authorName: string;
        body: string;
        createdAt: Date;
      }>(
        `SELECT n.id,COALESCE(u.name,'Former teammate') AS "authorName",n.body,n.created_at AS "createdAt" FROM inbox_notes n JOIN inbox_conversations c ON c.id=n.conversation_id AND c.workspace_id=n.workspace_id LEFT JOIN "user" u ON u.id=n.author_user_id WHERE c.workspace_id=$1 AND c.mailbox_id=$2 AND c.thread_id=$3 AND n.created_at>now()-interval '24 months' ORDER BY n.created_at DESC,n.id DESC LIMIT 200`,
        [context.workspace.id, mailbox.id, selectedThread.threadId],
      );
      selected = {
        conversation: conversation(
          listItem,
          mailbox.id,
          rows.get(selectedThread.threadId),
        ),
        messages: selectedThread.messages,
        notes: notes.rows.reverse().map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
        })),
        draft: await getPrivateInboxDraft(
          context,
          mailbox.id,
          selectedThread.threadId,
        ),
      };
    }
    // Recheck the live grant before exposing any local collaboration data. A Mail
    // administrator can revoke access while the independent SQL queries run.
    await requireInboxMailbox(context, mailbox.id);
    return {
      ...blank,
      mailboxes,
      mailbox,
      items: unreadOnly ? items.filter((item) => !item.isRead) : items,
      total: listed.total,
      page: listed.page,
      pages: listed.pages,
      selected,
      members: members.rows,
      links: { businesses: businesses.rows, leads: leads.rows.map(lead => ({ id: lead.id, name: leadOptionLabel(lead) })) },
      composeDraft: await getPrivateInboxDraft(context, mailbox.id),
    };
  } catch (error) {
    if (error instanceof MailProviderError)
      return {
        ...blank,
        connection: { state: error.state, message: error.message },
      };
    if (error instanceof InboxAccessError)
      return {
        ...blank,
        connection: { state: "grant_required", message: error.message },
      };
    throw error;
  }
}
