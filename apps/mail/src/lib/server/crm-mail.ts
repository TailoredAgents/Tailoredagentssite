import { timingSafeEqual } from "node:crypto";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { checkRateLimit, getUserById } from "./auth";
import { inspectDashboardGrant } from "./dashboard-auth";
import { BodyLimitError, readLimitedText } from "./request-body";
import { getAddressForUser } from "./domains";
import {
  crmMailbox,
  crmThreadRows,
  crmMessageVisible,
  crmThreadAttachments,
} from "./crm-mail-store";
import { getAttachmentForUser, readAttachmentBytes } from "./attachments";
import { replyTarget, sendAndStore, type ComposeInput } from "./outbox";
import { buildReferences, displaySubject } from "./threads";
import { stripHtml } from "./html";
import { SendAttemptError, sha256Hex } from "./send-attempts";
import type { EmailProvider } from "./email-provider";
import {
  CRM_MAIL_GRANT_SCOPE,
  CrmMailAccessError,
  requireCrmMailboxGrant,
} from "./crm-mail-grants";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });
const id = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 200 &&
  !/[\x00-\x20\x7f]/.test(value);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Env = {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  CRM_MAIL_SECRET?: string;
  DASHBOARD_AUTH_SECRET?: string;
};

/** A separate service capability plus a live identity grant plus explicit mailbox approval. */
export async function handleCrmMail(
  request: Request,
  env: Env,
  provider: () => EmailProvider,
) {
  const secret = env.CRM_MAIL_SECRET;
  if (!secret || secret.length < 32 || secret === env.DASHBOARD_AUTH_SECRET)
    return json({ error: "unavailable" }, 503);
  const expected = new TextEncoder().encode(`Bearer ${secret}`),
    supplied = new TextEncoder().encode(
      request.headers.get("authorization") ?? "",
    );
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return json({ error: "unauthorized" }, 401);
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  let body: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length")) > 65536)
      throw new BodyLimitError("too large");
    const parsed: unknown = JSON.parse(
      await readLimitedText(request.body, 65536),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "invalid_request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch (error) {
    return json(
      { error: "invalid_request" },
      error instanceof BodyLimitError ? 413 : 400,
    );
  }
  if (
    typeof body.token !== "string" ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(body.token)
  )
    return json({ error: "invalid_request" }, 400);
  const actor = await inspectDashboardGrant(env.DB, body.token);
  if (!actor) return json({ error: "session_expired" }, 401);
  if (!(await checkRateLimit(env.DB, `crm-mail:${actor.id}`, 180, 60)))
    return json({ error: "rate_limited" }, 429);
  try {
    if (body.action === "mailboxes") {
      const rows = await env.DB.prepare(
        `SELECT address.id,address.user_id AS owner_id,address.address,g.can_send ${CRM_MAIL_GRANT_SCOPE}
        ORDER BY lower(address.address),address.id`,
      )
        .bind(actor.id)
        .all<{
          id: string;
          owner_id: string;
          address: string;
          can_send: number;
        }>();
      const mailboxes = rows.results.map((row) => ({
        id: row.id,
        name: row.address,
        email: row.address,
        canSend: row.can_send === 1,
        addresses: [{ id: row.id, address: row.address }],
      }));
      return json({ mailboxes });
    }
    if (!id(body.mailboxId)) return json({ error: "invalid_request" }, 400);
    const mailboxId = body.mailboxId;
    const grant = await requireCrmMailboxGrant(
      env.DB,
      actor.id,
      mailboxId,
      body.action === "send",
    );
    const scope = {
      ownerId: grant.owner_id,
      addressId: grant.id,
      address: grant.address,
    };
    if (body.action === "threads") {
      if (
        !["inbox", "sent", "archive"].includes(String(body.view)) ||
        (body.q !== undefined &&
          (typeof body.q !== "string" || body.q.length > 200)) ||
        (body.page !== undefined &&
          (!Number.isInteger(body.page) ||
            Number(body.page) < 1 ||
            Number(body.page) > 10000)) ||
        (body.unreadOnly !== undefined && typeof body.unreadOnly !== "boolean")
      )
        return json({ error: "invalid_request" }, 400);
      return json(
        await crmMailbox(env.DB, scope, {
          view: body.view as "inbox" | "sent" | "archive",
          q: body.q as string | undefined,
          page: body.page as number | undefined,
          unreadOnly: body.unreadOnly === true,
        }),
      );
    }
    if (body.action === "thread") {
      if (!id(body.threadId)) return json({ error: "invalid_request" }, 400);
      const originals = await crmThreadRows(
        env.DB,
        scope,
        body.threadId,
        env.ATTACHMENTS,
      );
      if (!originals) return json({ error: "open_in_mail" }, 422);
      if (!originals.length) return json({ error: "not_found" }, 404);
      if (originals.length > 200) return json({ error: "open_in_mail" }, 422);
      const messages = originals;
      const files = await crmThreadAttachments(env.DB, scope, body.threadId);
      return json({
        threadId: body.threadId,
        subject: displaySubject(messages[0].subject),
        messages: messages.map((message) => ({
          id: message.id,
          direction: message.direction,
          from_addr: message.from_addr,
          from_name: message.from_name,
          to_addr: message.to_addr,
          cc_addr: message.cc_addr,
          subject: message.subject,
          body_text:
            message.body_text?.trim() ||
            (message.body_html ? stripHtml(message.body_html) : ""),
          status: message.status,
          status_detail: message.status_detail,
          is_read: message.is_read === 1,
          created_at: message.created_at,
          reply_target: replyTarget(message),
          attachments: files
            .filter((file) => file.email_id === message.id)
            .map((file) => ({
              id: file.id,
              filename: file.filename,
              content_type: file.content_type,
              size_bytes: file.size_bytes,
            })),
        })),
      });
    }
    if (body.action === "attachment") {
      if (!id(body.messageId) || !id(body.attachmentId))
        return json({ error: "invalid_request" }, 400);
      // Attachments on drafts, trash and another mailbox never become CRM downloads.
      const visible = await crmMessageVisible(env.DB, scope, body.messageId);
      if (!visible) return json({ error: "not_found" }, 404);
      const attachment = await getAttachmentForUser(
        env.DB,
        scope.ownerId,
        body.messageId,
        body.attachmentId,
      );
      if (!attachment) return json({ error: "not_found" }, 404);
      const stored = attachment.storage_key
        ? await env.ATTACHMENTS.get(attachment.storage_key)
        : null;
      const bytes = attachment.storage_key
        ? null
        : await readAttachmentBytes(env.ATTACHMENTS, attachment);
      if (!stored && !bytes) return json({ error: "file_pending" }, 503);
      return new Response(
        stored
          ? (stored.body as unknown as ReadableStream<Uint8Array>)
          : new Uint8Array(bytes!),
        {
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
            "Content-Length": String(stored?.size ?? bytes!.length),
            "Content-Security-Policy": "sandbox; default-src 'none'",
          },
        },
      );
    }
    if (body.action === "send") {
      if (
        !id(body.fromAddressId) ||
        typeof body.text !== "string" ||
        !body.text.trim() ||
        body.text.length > 12000 ||
        typeof body.idempotencyKey !== "string" ||
        !uuid.test(body.idempotencyKey)
      )
        return json({ error: "invalid_request" }, 400);
      if (!(await checkRateLimit(env.DB, `crm-send:${actor.id}`, 30, 3600)))
        return json({ error: "rate_limited" }, 429);
      const user = await getUserById(env.DB, scope.ownerId);
      if (!user) return json({ error: "mailbox_not_approved" }, 403);
      const from = await getAddressForUser(
        env.DB,
        scope.ownerId,
        body.fromAddressId,
      );
      if (!from || from.id !== mailboxId)
        return json({ error: "invalid_sender" }, 400);
      // Actor-scoped UUID prevents two staff reusing a key from replaying one another's sends.
      const key = `crm:${actor.id}:${body.idempotencyKey}`;
      const input: ComposeInput = {
        fromAddress: from,
        to: "",
        subject: "",
        text: body.text,
        idempotencyKey: key,
        crmAuthorization: { actorId: actor.id, mailboxAddressId: mailboxId },
      };
      if (body.threadId !== undefined) {
        if (
          !id(body.threadId) ||
          !id(body.replyToMessageId) ||
          body.to !== undefined ||
          body.subject !== undefined
        )
          return json({ error: "invalid_request" }, 400);
        const originals = await crmThreadRows(
          env.DB,
          scope,
          body.threadId,
          env.ATTACHMENTS,
        );
        if (!originals) return json({ error: "open_in_mail" }, 422);
        const original = originals.find(
          (message) => message.id === body.replyToMessageId,
        );
        if (!original) return json({ error: "not_found" }, 404);
        const recipients = replyTarget(original);
        // A successful repeat should replay even after its own sent message advanced the thread.
        const prior = await env.DB.prepare(
          `SELECT email_id FROM send_attempts WHERE user_id=? AND id=? AND status='sent'`,
        )
          .bind(scope.ownerId, await sha256Hex(`${scope.ownerId}\u0000${key}`))
          .first();
        if (!prior && originals[originals.length - 1].id !== original.id)
          return json({ error: "conversation_advanced" }, 409);
        if (!recipients.length)
          return json({ error: "invalid_recipient" }, 400);
        input.to = recipients.join(", ");
        input.subject = `Re: ${displaySubject(original.subject)}`;
        input.replyToEmailId = original.id;
        input.inReplyTo = original.message_id;
        input.references = buildReferences(
          original.references_header,
          original.message_id,
        );
      } else {
        if (
          typeof body.to !== "string" ||
          !body.to.trim() ||
          body.to.length > 254 ||
          typeof body.subject !== "string" ||
          !body.subject.trim() ||
          body.subject.length > 500 ||
          body.replyToMessageId !== undefined
        )
          return json({ error: "invalid_request" }, 400);
        // First increment is one explicit recipient. No CC/BCC or batch outreach.
        if (!/^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/.test(body.to))
          return json({ error: "invalid_recipient" }, 400);
        input.to = body.to;
        input.subject = body.subject;
      }
      // Recheck after all reads, then again immediately before provider delivery.
      const authorize = async () => {
        const current = await inspectDashboardGrant(
          env.DB,
          body.token as string,
        );
        if (!current || current.id !== actor.id)
          throw new CrmMailAccessError(401, "session_expired");
        await requireCrmMailboxGrant(env.DB, actor.id, mailboxId, true);
      };
      await authorize();
      input.beforeDelivery = async () => {
        await authorize();
        if (typeof body.threadId === "string") {
          const attempt = await env.DB.prepare(
            "SELECT email_id FROM send_attempts WHERE id=? AND user_id=?",
          )
            .bind(
              await sha256Hex(`${scope.ownerId}\u0000${key}`),
              scope.ownerId,
            )
            .first<{ email_id: string }>();
          const rows = await crmThreadRows(env.DB, scope, body.threadId);
          const reviewed = rows?.filter((row) => row.id !== attempt?.email_id);
          if (
            !reviewed?.length ||
            reviewed[reviewed.length - 1].id !== body.replyToMessageId ||
            replyTarget(reviewed[reviewed.length - 1]).join(", ") !== input.to
          ) {
            throw new CrmMailAccessError(409, "conversation_advanced");
          }
        }
      };
      try {
        const sent = await sendAndStore(env, provider(), user, input);
        const row = await env.DB.prepare(
          "SELECT COALESCE(thread_id,id) AS thread_id FROM emails WHERE id=? AND user_id=?",
        )
          .bind(sent.emailId, scope.ownerId)
          .first<{ thread_id: string }>();
        await env.DB.prepare(
          `INSERT OR IGNORE INTO crm_mail_audit(id,actor_id,mailbox_address_id,action,message_id)
          VALUES(?,?,?,'send',?)`,
        )
          .bind(`send:${sent.emailId}`, actor.id, mailboxId, sent.emailId)
          .run();
        return json({
          messageId: sent.emailId,
          threadId: row?.thread_id ?? sent.emailId,
          providerId: sent.providerId,
          status: "accepted",
        });
      } catch (error) {
        if (error instanceof CrmMailAccessError) throw error;
        const attempt = await env.DB.prepare(
          `SELECT email_id,status FROM send_attempts WHERE user_id=? AND id=?`,
        )
          .bind(scope.ownerId, await sha256Hex(`${scope.ownerId}\u0000${key}`))
          .first<{ email_id: string | null; status: string }>();
        if (
          error instanceof SendAttemptError &&
          error.code === "idempotency_conflict"
        )
          return json({ error: error.code }, 409);
        if (attempt?.email_id && attempt.status === "sending") {
          const row = await env.DB.prepare(
            "SELECT COALESCE(thread_id,id) AS thread_id FROM emails WHERE id=? AND user_id=?",
          )
            .bind(attempt.email_id, scope.ownerId)
            .first<{ thread_id: string }>();
          return json(
            {
              messageId: attempt.email_id,
              threadId: row?.thread_id ?? attempt.email_id,
              status: "pending",
            },
            202,
          );
        }
        if (error instanceof SendAttemptError)
          return json({ error: error.code }, 409);
        // The durable outbox marks failed only when no provider delivery can
        // have occurred. Expose this definite rejection without turning it
        // into an unknown outcome that would lock the CRM composer.
        if (attempt?.status === "failed")
          return json({ error: "send_rejected" }, 422);
        return json({ error: "send_failed" }, 502);
      }
    }
    return json({ error: "invalid_request" }, 400);
  } catch (error) {
    if (error instanceof CrmMailAccessError)
      return json({ error: error.code }, error.status);
    if (error instanceof Error && error.name === "ReplyGuardError")
      return json({ error: "conversation_advanced" }, 409);
    console.error(JSON.stringify({ event: "crm_mail_unavailable" }));
    return json({ error: "unavailable" }, 503);
  }
}
