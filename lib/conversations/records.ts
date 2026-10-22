import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { getMailThreadHistory } from "@/lib/inbox/mail-provider";
import { listSmsWorkspace } from "@/lib/sms/data";
import type { InboxRecord } from "@/lib/inbox/types";
import { requireSource, type Scopes, type SourceRow } from "./access";
import type { ConversationSource, ConversationTimelineItem } from "./types";
import { listVoiceCalls } from "@/lib/voice/data";
export async function hydrateSource(
  context: DashboardContext,
  s: SourceRow,
  scope: Scopes,
): Promise<{ source: ConversationSource; items: ConversationTimelineItem[] }> {
  const pool = getDatabasePool();
  let source: ConversationSource = {
    id: s.id,
    channel: s.channel,
    label: "",
    mailboxId: s.mailbox_id,
    threadId: s.thread_id,
    numberId: s.number_id,
    smsConversationId: s.sms_conversation_id,
    externalAddresses: s.external_addresses,
    canSend: false,
    mailbox: null,
    mailRecord: null,
    number: null,
    smsRecord: null,
    line: null,
    voiceConversationId: s.voice_conversation_id,
    voiceCalls: [],
    hasOlder: false,
    before: null,
  };
  const items: ConversationTimelineItem[] = [];
  if (s.channel === "email") {
    const mailbox = scope.mailboxes.find((m) => m.id === s.mailbox_id)!;
    const page = await getMailThreadHistory(context, mailbox.id, s.thread_id!, {
      limit: 50,
    });
    const liveLatest = page.messages.at(-1);
    if (liveLatest) {
      const newestInbound = [...page.messages]
        .reverse()
        .find((m) => m.direction === "inbound");
      const newestOutbound = [...page.messages]
        .reverse()
        .find(
          (m) =>
            m.direction === "outbound" &&
            ["sent", "delivered", "delayed"].includes(m.deliveryStatus ?? ""),
        );
      s.latest_message_id = liveLatest.id;
      s.last_activity_at = new Date(liveLatest.createdAt);
      const oldestLoaded = new Date(page.messages[0].createdAt);
      s.last_inbound_at = newestInbound
        ? new Date(newestInbound.createdAt)
        : page.hasOlder && s.last_inbound_at && s.last_inbound_at < oldestLoaded
          ? s.last_inbound_at
          : null;
      s.last_outbound_at = newestOutbound
        ? new Date(newestOutbound.createdAt)
        : page.hasOlder &&
            s.last_outbound_at &&
            s.last_outbound_at < oldestLoaded
          ? s.last_outbound_at
          : null;
      await pool.query(
        "UPDATE crm_conversation_sources SET latest_message_id=$3,last_activity_at=$4,last_inbound_at=$5,last_outbound_at=$6 WHERE workspace_id=$1 AND id=$2",
        [
          context.workspace.id,
          s.id,
          s.latest_message_id,
          s.last_activity_at,
          s.last_inbound_at,
          s.last_outbound_at,
        ],
      );
    }
    const [notes, draft] = await Promise.all([
      pool.query<{
        id: string;
        body: string;
        authorName: string;
        createdAt: Date;
      }>(
        `SELECT n.id,n.body,COALESCE(u.name,'Former teammate') AS "authorName",n.created_at AS "createdAt" FROM inbox_notes n JOIN inbox_conversations c ON c.id=n.conversation_id AND c.workspace_id=n.workspace_id LEFT JOIN "user" u ON u.id=n.author_user_id WHERE c.workspace_id=$1 AND c.mailbox_id=$2 AND c.thread_id=$3 AND n.created_at>now()-interval '24 months' ORDER BY n.created_at DESC LIMIT 200`,
        [context.workspace.id, mailbox.id, s.thread_id],
      ),
      pool.query<{
        id: string;
        text: string;
        to: string;
        subject: string;
        replyToMessageId: string | null;
      }>(
        `SELECT id,body AS text,recipient AS "to",subject,reply_to_message_id AS "replyToMessageId" FROM inbox_drafts WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_key=$3 AND author_user_id=$4 AND updated_at>now()-interval '90 days'`,
        [context.workspace.id, mailbox.id, s.thread_id, context.user.id],
      ),
    ]);
    const latest = page.messages.at(-1);
    const record: InboxRecord = {
      conversation: {
        id: s.thread_id!,
        latestMessageId: s.latest_message_id ?? latest?.id ?? "",
        mailboxId: mailbox.id,
        subject: page.subject,
        preview: latest?.text.slice(0, 180) ?? "",
        participants: s.external_addresses,
        messageCount: page.messages.length,
        isRead: false,
        hasAttachments: page.messages.some((m) => m.attachments.length),
        deliveryStatus: latest?.deliveryStatus ?? null,
        updatedAt: s.last_activity_at.toISOString(),
        status: "open",
        ownerId: null,
        ownerName: null,
        businessId: null,
        leadId: null,
      },
      messages: page.messages,
      notes: notes.rows
        .reverse()
        .map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      draft: draft.rows[0] ?? null,
    };
    source = {
      ...source,
      label: mailbox.email,
      mailbox,
      mailRecord: record,
      canSend: scope.role !== "viewer" && mailbox.canSend,
      hasOlder: page.hasOlder,
      before: page.before,
    };
    items.push(
      ...page.messages.map((m) => ({
        id: `email:${s.id}:${m.id}`,
        sourceId: s.id,
        channel: "email" as const,
        direction: m.direction,
        text: m.text,
        subject: m.subject,
        status: m.deliveryStatus,
        authorName: m.fromName ?? m.from,
        createdAt: m.createdAt,
        emailMessage: m,
      })),
      ...record.notes.map((n) => ({
        id: `legacy-mail-note:${n.id}`,
        sourceId: s.id,
        channel: "note" as const,
        direction: null,
        text: n.body,
        subject: null,
        status: null,
        authorName: n.authorName,
        createdAt: n.createdAt,
      })),
    );
  } else if (s.channel === "sms") {
    const number = scope.numbers.find((n) => n.id === s.number_id)!;
    const found = await listSmsWorkspace(context, {
      number: number.id,
      thread: s.sms_conversation_id!,
    });
    if (!found.selected) throw new Error("SMS source no longer available");
    const record = found.selected;
    const first = record.messages[0];
    let hasOlder = false,
      before: string | null = null;
    if (first) {
      const row = (
        await pool.query<{ time: string; id: string }>(
          `SELECT created_at::text AS time,id FROM sms_messages WHERE workspace_id=$1 AND id=$2`,
          [context.workspace.id, first.id],
        )
      ).rows[0];
      if (row) {
        hasOlder = !!(
          await pool.query(
            "SELECT 1 FROM sms_messages WHERE workspace_id=$1 AND conversation_id=$2 AND (created_at,id)<($3::timestamptz,$4::uuid) LIMIT 1",
            [context.workspace.id, s.sms_conversation_id, row.time, row.id],
          )
        ).rowCount;
        before = Buffer.from(JSON.stringify(row)).toString("base64url");
      }
    }
    source = {
      ...source,
      label: number.phone,
      number,
      smsRecord: record,
      canSend: number.canSend,
      hasOlder,
      before,
    };
    items.push(
      ...record.messages.map((m) => ({
        id: `sms:${m.id}`,
        sourceId: s.id,
        channel: "sms" as const,
        direction: m.direction,
        text: m.text,
        subject: null,
        status: m.status,
        authorName: null,
        createdAt: m.createdAt,
        mediaCount: m.mediaCount,
      })),
      ...record.notes.map((n) => ({
        id: `legacy-sms-note:${n.id}`,
        sourceId: s.id,
        channel: "note" as const,
        direction: null,
        text: n.body,
        subject: null,
        status: null,
        authorName: n.authorName,
        createdAt: n.createdAt,
      })),
    );
  } else {
    const line = scope.lines.find((l) => l.id === s.line_id)!;
    const calls = await listVoiceCalls(context, s.voice_conversation_id!);
    const oldest = calls.items[0];
    source = {
      ...source,
      label: line.phone,
      line,
      voiceCalls: calls.items,
      canSend: line.canCall,
      hasOlder: calls.hasOlder,
      before: oldest
        ? Buffer.from(
            JSON.stringify({ time: oldest.createdAt, id: oldest.id }),
          ).toString("base64url")
        : null,
    };
    items.push(
      ...calls.items.map((c) => ({
        id: `call:${c.id}`,
        sourceId: s.id,
        channel: "call" as const,
        direction: c.direction,
        text: c.voicemail
          ? "Voicemail"
          : c.direction === "inbound"
            ? "Incoming call"
            : "Outgoing call",
        subject: null,
        status: c.status,
        authorName: null,
        createdAt: c.createdAt,
        voiceCall: c,
      })),
    );
  }
  return { source, items };
}
export async function loadConversationSourceHistory(
  context: DashboardContext,
  input: { sourceId: string; before?: string },
) {
  const source = await requireSource(context, input.sourceId);
  if (source.channel === "email") {
    const page = await getMailThreadHistory(
      context,
      source.mailbox_id!,
      source.thread_id!,
      { before: input.before, limit: 50 },
    );
    await requireSource(context, source.id);
    return {
      items: page.messages.map((m) => ({
        id: `email:${source.id}:${m.id}`,
        sourceId: source.id,
        channel: "email" as const,
        direction: m.direction,
        text: m.text,
        subject: m.subject,
        status: m.deliveryStatus,
        authorName: m.fromName ?? m.from,
        createdAt: m.createdAt,
        emailMessage: m,
      })),
      before: page.before,
      hasOlder: page.hasOlder,
    };
  }
  let cursor: { time: string; id: string };
  try {
    cursor = JSON.parse(
      Buffer.from(input.before ?? "", "base64url").toString(),
    );
    if (!/^\d{4}-/.test(cursor.time) || !/^[0-9a-f-]{36}$/.test(cursor.id))
      throw new Error();
  } catch {
    throw new Error("Refresh the conversation history.");
  }
  if (source.channel === "call") {
    const { readCalls } = await import("@/lib/voice/data");
    const current = await scopesForVoice(context, source.id);
    const rows = await getDatabasePool().query<{ id: string; time: string }>(
      "SELECT id,created_at::text AS time FROM voice_calls WHERE workspace_id=$1 AND voice_conversation_id=$2 AND (created_at,id)<($3::timestamptz,$4::uuid) ORDER BY created_at DESC,id DESC LIMIT 51",
      [
        context.workspace.id,
        source.voice_conversation_id,
        cursor.time,
        cursor.id,
      ],
    );
    const page = rows.rows.slice(0, 50),
      oldest = page.at(-1),
      calls = await readCalls(
        getDatabasePool(),
        context.workspace.id,
        page.map((c) => c.id),
        current.canManageVoicemail,
      );
    await requireSource(context, source.id);
    return {
      items: calls.map((c) => ({
        id: `call:${c.id}`,
        sourceId: source.id,
        channel: "call" as const,
        direction: c.direction,
        text: c.voicemail
          ? "Voicemail"
          : c.direction === "inbound"
            ? "Incoming call"
            : "Outgoing call",
        subject: null,
        status: c.status,
        authorName: null,
        createdAt: c.createdAt,
        voiceCall: c,
      })),
      before: oldest
        ? Buffer.from(
            JSON.stringify({ time: oldest.time, id: oldest.id }),
          ).toString("base64url")
        : null,
      hasOlder: rows.rows.length > 50,
    };
  }
  const rows = await getDatabasePool().query<{
    id: string;
    direction: "inbound" | "outbound";
    body: string;
    status: string;
    created_at: Date;
    time: string;
    media_count: number;
  }>(
    `SELECT id,direction,CASE WHEN body_removed_at IS NULL AND body_expires_at>now() THEN body ELSE '[Expired message content removed]' END AS body,status,created_at,created_at::text AS time,media_count FROM sms_messages WHERE workspace_id=$1 AND conversation_id=$2 AND (created_at,id)<($3::timestamptz,$4::uuid) ORDER BY created_at DESC,id DESC LIMIT 51`,
    [context.workspace.id, source.sms_conversation_id, cursor.time, cursor.id],
  );
  const page = rows.rows.slice(0, 50),
    oldest = page.at(-1);
  await requireSource(context, source.id);
  return {
    items: page.reverse().map((m) => ({
      id: `sms:${m.id}`,
      sourceId: source.id,
      channel: "sms" as const,
      direction: m.direction,
      text: m.body,
      subject: null,
      status: m.status,
      authorName: null,
      createdAt: m.created_at.toISOString(),
      mediaCount: m.media_count,
    })),
    before: oldest
      ? Buffer.from(
          JSON.stringify({ time: oldest.time, id: oldest.id }),
        ).toString("base64url")
      : null,
    hasOlder: rows.rows.length > 50,
  };
}
async function scopesForVoice(context: DashboardContext, id: string) {
  const source = await requireSource(context, id);
  const { getVoiceWorkspace } = await import("@/lib/voice/data");
  const line = (await getVoiceWorkspace(context)).lines.find(
    (l) => l.id === source.line_id,
  );
  if (!line) throw new Error("Call history is unavailable.");
  return line;
}
