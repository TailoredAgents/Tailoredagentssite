import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { EmailRow } from "$lib/types";
import { CRM_ADDRESS_SCOPE, type CrmAddressScope } from "./crm-mail-store";
import {
  CrmMailPageError,
  decodeCrmCursor,
  encodeCrmCursor,
  pageLimit,
} from "./crm-mail-pagination";
import { parseEmailIdentities } from "./email-address";
import { hydrateContent } from "./content";
import { stripHtml } from "./html";
import { CRM_TEAM_COPY_SQL, crmInternalAddresses, crmMessagePerspective } from "./crm-mail-perspective";
import { displaySubject } from "./threads";

const args = (scope: CrmAddressScope) => [
  scope.ownerId,
  scope.addressId,
  scope.addressId,
  scope.address,
];
const timeSql = "strftime('%Y-%m-%dT%H:%M:%fZ',e.created_at)";
const identity = (
  scope: CrmAddressScope,
  kind: "index" | "history",
  thread?: string,
) => ({
  kind,
  owner: scope.ownerId,
  address: scope.addressId,
  ...(thread ? { thread } : {}),
});
type IndexRow = {
  thread_id: string;
  latest_message_id: string;
  last_message_at: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  has_attachments: number;
};
type ReplyMessage = Pick<
  EmailRow,
  | "id"
  | "direction"
  | "from_addr"
  | "to_addr"
  | "cc_addr"
  | "status"
  | "reply_to_addr"
  | "subject"
  | "message_id"
  | "references_header"
> & { team_copy: number };
export async function crmReplyContext(
  db: D1Database,
  scope: CrmAddressScope,
  threadId: string,
  messageId: string,
  excludeId?: string,
) {
  const columns =
    `e.id,e.direction,e.from_addr,e.to_addr,e.cc_addr,e.status,e.reply_to_addr,e.subject,e.message_id,e.references_header,${CRM_TEAM_COPY_SQL} AS team_copy`;
  const original = await db
    .prepare(
      `SELECT ${columns} FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND COALESCE(e.thread_id,e.id)=? AND e.id=?`,
    )
    .bind(...args(scope), threadId, messageId)
    .first<ReplyMessage>();
  const latest = await db
    .prepare(
      `SELECT ${columns} FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND COALESCE(e.thread_id,e.id)=? AND (? IS NULL OR e.id<>?)
    ORDER BY julianday(e.created_at) DESC,e.id DESC LIMIT 1`,
    )
    .bind(...args(scope), threadId, excludeId ?? null, excludeId ?? null)
    .first<ReplyMessage>();
  return { original, latest };
}

/** Full address-scope discovery. Thread-ID ordering does not shift with replies. */
export async function crmConversationIndex(
  db: D1Database,
  scope: CrmAddressScope,
  input: { cursor?: unknown; limit?: unknown },
  secret: string,
) {
  // Participant expansion needs one bounded query per thread. Leave room for
  // identity, rate-limit and live-grant checks within D1's Free invocation cap.
  const limit = Math.min(pageLimit(input.limit), 25),
    cursor = decodeCrmCursor(input.cursor, identity(scope, "index"), secret);
  const rows = (
    await db
      .prepare(
        `WITH scoped AS (
    SELECT e.id,COALESCE(e.thread_id,e.id) AS thread_id,e.direction,e.status,${CRM_TEAM_COPY_SQL} AS team_copy,${timeSql} AS created_at,
      EXISTS(SELECT 1 FROM email_attachments a WHERE a.email_id=e.id) AS has_attachments,
      row_number() OVER(PARTITION BY COALESCE(e.thread_id,e.id) ORDER BY julianday(e.created_at) DESC,e.id DESC) AS recency
    FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND COALESCE(e.thread_id,e.id)>?
  ) SELECT thread_id,max(CASE WHEN recency=1 THEN id END) AS latest_message_id,max(created_at) AS last_message_at,
    max(CASE WHEN direction='inbound' AND NOT team_copy THEN created_at END) AS last_inbound_at,
    max(CASE WHEN team_copy OR (direction='outbound' AND status IN ('sent','delivered','delayed')) THEN created_at END) AS last_outbound_at,max(has_attachments) AS has_attachments
    FROM scoped GROUP BY thread_id ORDER BY thread_id LIMIT ?`,
      )
      .bind(...args(scope), cursor?.id ?? "", limit + 1)
      .all<IndexRow>()
  ).results;
  const selected = rows.slice(0, limit);
  const internal = await crmInternalAddresses(db);
  internal.add(scope.address.toLowerCase());
  const items = [];
  let bytes = 0;
  for (const row of selected) {
    if (!row.last_message_at)
      throw new CrmMailPageError(422, "invalid_message_time");
    // Read only bounded visible participant headers, never message bodies,
    // private BCC, subjects, provider payloads or R2 objects during discovery.
    const headers = (
      await db
        .prepare(
          `SELECT DISTINCT substr(e.from_addr,1,4097) AS sender,substr(e.to_addr,1,4097) AS recipients,
      substr(e.cc_addr,1,4097) AS copies,substr(e.reply_to_addr,1,4097) AS reply_to
      FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND COALESCE(e.thread_id,e.id)=? LIMIT 257`,
        )
        .bind(...args(scope), row.thread_id)
        .all<{
          sender: string;
          recipients: string;
          copies: string | null;
          reply_to: string | null;
        }>()
    ).results;
    if (headers.length > 256)
      throw new CrmMailPageError(422, "participant_review_required");
    const external = new Set<string>();
    for (const header of headers)
      for (const field of [
        header.sender,
        header.recipients,
        header.copies,
        header.reply_to,
      ]) {
        if ((field?.length ?? 0) > 4096)
          throw new CrmMailPageError(422, "participant_review_required");
        for (const person of parseEmailIdentities(field)) {
          const address = person.address.toLowerCase();
          if (
            address.length <= 254 &&
            /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(address) &&
            !internal.has(address)
          )
            external.add(address);
        }
      }
    if (external.size > 200)
      throw new CrmMailPageError(422, "participant_review_required");
    const item = {
      threadId: row.thread_id,
      latestMessageId: row.latest_message_id,
      lastMessageAt: row.last_message_at,
      lastInboundAt: row.last_inbound_at,
      lastOutboundAt: row.last_outbound_at,
      externalAddresses: [...external].sort(),
      hasAttachments: row.has_attachments === 1,
    };
    const size = new TextEncoder().encode(JSON.stringify(item)).byteLength;
    if (items.length && bytes + size > 3 * 1024 * 1024) break;
    items.push(item);
    bytes += size;
  }
  const more = rows.length > items.length;
  return {
    items,
    cursor: more
      ? encodeCrmCursor(
          {
            ...identity(scope, "index"),
            v: 1,
            id: items[items.length - 1].threadId,
          },
          secret,
        )
      : null,
    complete: !more,
  };
}

/** Latest-first keyset selection, returned chronologically for timeline merging. */
export async function crmThreadHistory(
  db: D1Database,
  bucket: R2Bucket,
  scope: CrmAddressScope,
  threadId: string,
  input: { before?: unknown; limit?: unknown },
  secret: string,
) {
  const limit = pageLimit(input.limit),
    cursor = decodeCrmCursor(
      input.before,
      identity(scope, "history", threadId),
      secret,
    );
  const subject = await db
    .prepare(
      `SELECT e.subject FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND COALESCE(e.thread_id,e.id)=?
    ORDER BY julianday(e.created_at),e.id LIMIT 1`,
    )
    .bind(...args(scope), threadId)
    .first<{ subject: string }>();
  if (!subject) throw new CrmMailPageError(404, "not_found");
  const rows = (
    await db
      .prepare(
        `SELECT e.*,${CRM_TEAM_COPY_SQL} AS team_copy,${timeSql} AS sort_at FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND COALESCE(e.thread_id,e.id)=?
    ${cursor ? "AND (julianday(e.created_at)<julianday(?) OR (julianday(e.created_at)=julianday(?) AND e.id<?))" : ""}
    ORDER BY julianday(e.created_at) DESC,e.id DESC LIMIT ?`,
      )
      .bind(
        ...args(scope),
        threadId,
        ...(cursor ? [cursor.at, cursor.at, cursor.id] : []),
        limit + 1,
      )
      .all<EmailRow & { sort_at: string; team_copy: number }>()
  ).results;
  const candidates = rows.slice(0, limit),
    files = [];
  for (let i = 0; i < candidates.length; i += 80) {
    const group = candidates.slice(i, i + 80);
    if (!group.length) continue;
    files.push(
      ...(
        await db
          .prepare(
            `SELECT a.id,a.email_id,a.filename,a.content_type,a.size_bytes FROM email_attachments a JOIN emails e ON e.id=a.email_id
      WHERE ${CRM_ADDRESS_SCOPE} AND e.id IN (${group.map(() => "?").join(",")}) LIMIT 8001`,
          )
          .bind(...args(scope), ...group.map((row) => row.id))
          .all<{
            id: string;
            email_id: string;
            filename: string;
            content_type: string;
            size_bytes: number;
          }>()
      ).results,
    );
  }
  const internal = await crmInternalAddresses(db);
  const messages = [];
  let bytes = 0;
  for (const row of candidates) {
    const message = await hydrateContent(bucket, row);
    const body =
      message.body_text?.trim() ||
      (message.body_html ? stripHtml(message.body_html) : "");
    const attachments = files
      .filter((file) => file.email_id === message.id)
      .map(({ email_id: _, ...file }) => file);
    if (
      !row.sort_at ||
      body.length > 200000 ||
      attachments.length > 100 ||
      attachments.some(
        (file) =>
          file.filename.length > 500 ||
          file.content_type.length > 200 ||
          file.size_bytes > 30 * 1024 * 1024,
      )
    )
      throw new CrmMailPageError(422, "message_too_large");
    const item = {
      id: message.id,
      ...crmMessagePerspective({ ...message, team_copy: row.team_copy }, internal),
      from_addr: message.from_addr,
      from_name: message.from_name,
      to_addr: message.to_addr,
      cc_addr: message.cc_addr,
      subject: message.subject,
      body_text: body,
      status_detail: message.status_detail,
      is_read: message.is_read === 1,
      created_at: row.sort_at,
      attachments,
    };
    const size = new TextEncoder().encode(JSON.stringify(item)).byteLength;
    if (messages.length && bytes + size > 3 * 1024 * 1024) break;
    messages.push(item);
    bytes += size;
  }
  const hasOlder = rows.length > messages.length;
  const oldest = messages.at(-1);
  return {
    threadId,
    subject: displaySubject(subject.subject),
    messages: messages.reverse(),
    hasOlder,
    before:
      hasOlder && oldest
        ? encodeCrmCursor(
            {
              ...identity(scope, "history", threadId),
              v: 1,
              id: oldest.id,
              // Keep the original SQLite timestamp in the opaque boundary.
              // The public ISO timestamp is rounded to milliseconds and could
              // otherwise skip messages stored with finer precision.
              at: candidates[messages.length - 1].created_at,
            },
            secret,
          )
        : null,
  };
}
