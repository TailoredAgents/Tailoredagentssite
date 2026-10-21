import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type {
  EmailRow,
  MailboxPage,
  ThreadSummary,
  EmailAttachmentMeta,
} from "$lib/types";
import { hydrateContent } from "./content";
import { searchClauses } from "./search";
import { displaySubject } from "./threads";
import { buildThreadParticipants } from "./thread-participants";
import { stripHtml } from "./html";
import { stripQuotedText } from "$lib/utils/quotes";

// email.address_id is the server's routed envelope identity, not a To-header
// guess. Exclude manual reassignment where that address was only a fallback.
// Every query (not just thread discovery) applies this boundary.
export const CRM_ADDRESS_SCOPE = `e.user_id=? AND (e.address_id=? OR (e.direction='inbound' AND EXISTS(
    SELECT 1 FROM email_address_deliveries d WHERE d.email_id=e.id AND d.address_id=?)))
  AND e.deleted_at IS NULL AND e.spam_at IS NULL
  AND (e.status IS NULL OR e.status<>'draft') AND (
    (e.direction='outbound' AND lower(e.from_addr)=lower(?)) OR
    (e.direction='inbound' AND NOT EXISTS(SELECT 1 FROM unassigned_mail u
      WHERE u.provider_id=e.provider_id AND u.assigned_user_id=e.user_id)))`;
export type CrmAddressScope = {
  ownerId: string;
  addressId: string;
  address: string;
};
const scopeArgs = (scope: CrmAddressScope) => [
  scope.ownerId,
  scope.addressId,
  scope.addressId,
  scope.address,
];

export async function crmThreadRows(
  db: D1Database,
  scope: CrmAddressScope,
  threadId: string,
  bucket?: R2Bucket,
) {
  const rows = await db
    .prepare(
      `SELECT e.* FROM emails e WHERE ${CRM_ADDRESS_SCOPE}
    AND COALESCE(e.thread_id,e.id)=? ORDER BY datetime(e.created_at),e.id LIMIT 201`,
    )
    .bind(...scopeArgs(scope), threadId)
    .all<EmailRow>();
  if (rows.results.length > 200) return null;
  return Promise.all(rows.results.map((row) => hydrateContent(bucket, row)));
}

export async function crmMessageVisible(
  db: D1Database,
  scope: CrmAddressScope,
  messageId: string,
) {
  return Boolean(
    await db
      .prepare(
        `SELECT e.id FROM emails e WHERE ${CRM_ADDRESS_SCOPE} AND e.id=?`,
      )
      .bind(...scopeArgs(scope), messageId)
      .first(),
  );
}

export async function crmThreadAttachments(
  db: D1Database,
  scope: CrmAddressScope,
  threadId: string,
) {
  return (
    await db
      .prepare(
        `SELECT a.id,a.email_id,a.filename,a.content_type,a.size_bytes
    FROM email_attachments a JOIN emails e ON e.id=a.email_id WHERE ${CRM_ADDRESS_SCOPE}
    AND COALESCE(e.thread_id,e.id)=? ORDER BY a.created_at,a.id`,
      )
      .bind(...scopeArgs(scope), threadId)
      .all<
        Pick<
          EmailAttachmentMeta,
          "id" | "email_id" | "filename" | "content_type" | "size_bytes"
        >
      >()
  ).results;
}

export async function crmMailbox(
  db: D1Database,
  scope: CrmAddressScope,
  query: {
    view: "inbox" | "sent" | "archive";
    q?: string;
    page?: number;
    unreadOnly?: boolean;
  },
): Promise<MailboxPage> {
  // Never search BCC; it is not visible in the shared inbox.
  const filters: string[] = [],
    bindings: string[] = [];
  for (const token of (query.q ?? "").match(/(?:[^\s"]+|"[^"]*")+/g) ?? []) {
    const item = searchClauses(token);
    if (token.startsWith("to:")) {
      item.filters = item.filters.map((clause) =>
        clause.replace(" OR e.bcc_addr LIKE ? ESCAPE '\\'", ""),
      );
      item.bindings = item.bindings.slice(0, 2);
    }
    filters.push(...item.filters);
    bindings.push(...item.bindings);
  }
  const view =
    query.view === "inbox"
      ? "e.direction='inbound' AND e.archived_at IS NULL"
      : query.view === "sent"
        ? "e.direction='outbound'"
        : "e.archived_at IS NOT NULL";
  const where = [
    CRM_ADDRESS_SCOPE,
    view,
    ...(query.unreadOnly ? ["e.is_read=0"] : []),
    ...filters,
  ].join(" AND ");
  const args = [...scopeArgs(scope), ...bindings];
  const total =
    (
      await db
        .prepare(
          `SELECT count(DISTINCT COALESCE(e.thread_id,e.id)) AS n FROM emails e WHERE ${where}`,
        )
        .bind(...args)
        .first<{ n: number }>()
    )?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 25)),
    page = Math.min(query.page ?? 1, pageCount);
  const ids = (
    await db
      .prepare(
        `SELECT COALESCE(e.thread_id,e.id) AS thread_id FROM emails e WHERE ${where}
    GROUP BY COALESCE(e.thread_id,e.id) ORDER BY max(datetime(e.created_at)) DESC,thread_id LIMIT 25 OFFSET ?`,
      )
      .bind(...args, (page - 1) * 25)
      .all<{ thread_id: string }>()
  ).results;
  const threads: ThreadSummary[] = [];
  for (const item of ids) {
    const rows = await crmThreadRows(db, scope, item.thread_id);
    // An unusually long conversation can still be opened in Mail. Avoid
    // presenting an incomplete/misleading CRM summary.
    if (!rows?.length) continue;
    const oldest = rows[0],
      latest = rows[rows.length - 1];
    const files = await crmThreadAttachments(db, scope, item.thread_id);
    threads.push({
      thread_id: item.thread_id,
      latest_id: latest.id,
      subject: displaySubject(oldest.subject),
      preview: stripQuotedText(
        latest.body_text || stripHtml(latest.body_html ?? ""),
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180),
      participants: buildThreadParticipants(rows),
      message_count: rows.length,
      is_read: rows.every((row) => row.is_read === 1),
      is_starred: rows.some((row) => row.is_starred === 1),
      is_draft: false,
      is_archived: rows.every((row) => Boolean(row.archived_at)),
      is_spam: false,
      has_attachments: files.length > 0,
      domain_id: latest.domain_id,
      address_id: scope.addressId,
      status: latest.status === "draft" ? null : latest.status,
      category: "primary",
      labels: [],
      created_at: latest.created_at,
    });
  }
  return { threads, total, page, pageCount, pageSize: 25 };
}
