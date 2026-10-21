import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDashboardAuth } from "@/lib/dashboard/auth";
import { readMailDashboardToken, readSmallJson } from "@/lib/dashboard/mail-identity";
import { inboxConfiguration } from "./config";
import type { InboxMailbox, MailThread, MailThreadRecord, MailSendInput, MailSendResult } from "./types";

export class MailProviderError extends Error {
  constructor(public state: "setup" | "grant_required" | "unavailable", message: string, public outcome: "rejected" | "unknown" = "rejected") { super(message); }
}
const identifier = z.string().min(1).max(128);
const safeText = (maximum: number) => z.string().max(maximum);
const mailboxSchema = z.object({ id: identifier, name: safeText(300), email: z.string().email().max(254), canSend: z.boolean(), addresses: z.array(z.object({ id: identifier, address: z.string().email().max(254) })).max(100) });
const pageSchema = z.object({
  threads: z.array(z.object({ thread_id: identifier, latest_id: identifier, subject: safeText(1000), preview: safeText(4000),
    participants: z.array(z.object({ address: z.string().max(500), name: z.string().max(500).nullable().optional() }).passthrough()).max(200),
    message_count: z.number().int().nonnegative(), is_read: z.boolean(), has_attachments: z.boolean(), status: z.string().max(100).nullable(), created_at: z.string().max(100) })).max(100),
  total: z.number().int().nonnegative(), page: z.number().int().positive(), pageCount: z.number().int().positive(),
});
const threadSchema = z.object({ threadId: identifier, subject: safeText(1000), messages: z.array(z.object({
  id: identifier, direction: z.enum(["inbound", "outbound"]), from_addr: safeText(500), from_name: safeText(500).nullable(), to_addr: safeText(4000), cc_addr: safeText(4000).nullable(),
  subject: safeText(1000), body_text: safeText(200_000), status: safeText(100).nullable(), status_detail: safeText(2000).nullable(), is_read: z.boolean(), created_at: safeText(100),
  reply_target: z.array(z.string().email().max(254)).max(100),
  attachments: z.array(z.object({ id: identifier, filename: safeText(500), content_type: safeText(200), size_bytes: z.number().int().nonnegative().max(30*1024*1024) })).max(100),
})).max(200) });
const sendSchema = z.object({ messageId: identifier, threadId: identifier, providerId: identifier.optional(), status: z.enum(["accepted", "pending"]) });

async function request(context: DashboardContext, body: Record<string, unknown>, binary = false) {
  const config = inboxConfiguration();
  if (!config.ready) throw new MailProviderError("setup", config.message);
  const auth = getDashboardAuth();
  const session = auth ? await auth.api.getSession({ headers: await headers() }) : null;
  if (!session || session.user.id !== context.user.id) throw new MailProviderError("grant_required", "Sign in again to open approved mailboxes.");
  const token = await readMailDashboardToken(session.session.id, context.user.id);
  if (!token) throw new MailProviderError("grant_required", "Sign in with your approved Tailored Mail account to open this inbox.");
  let response: Response;
  try {
    response = await fetch(config.url, { method: "POST", headers: { authorization: `Bearer ${config.secret}`, "content-type": "application/json" },
      body: JSON.stringify({ ...body, token }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(body.action === "send" ? 25_000 : 12_000) });
  } catch { throw new MailProviderError("unavailable", "Mail could not be reached. Refresh to try again; keep the same send attempt when retrying.", body.action === "send" ? "unknown" : "rejected"); }
  if (!response.ok) {
    await response.body?.cancel();
    if ([401, 403, 404].includes(response.status)) throw new MailProviderError("grant_required", "This mailbox or message is no longer available to your Mail account.");
    if ([400, 409, 422, 429].includes(response.status)) throw new MailProviderError("unavailable", response.status === 409 ? "The conversation or send attempt changed. Refresh and review it before sending again." : response.status === 429 ? "Too many mail requests. Wait a moment and try again." : "Mail could not accept this request. Review the recipients and message.");
    throw new MailProviderError("unavailable", "Mail is temporarily unavailable. Your saved work remains available.", body.action === "send" ? "unknown" : "rejected");
  }
  if (binary) return response;
  try { return await readSmallJson(response.body, 4*1024*1024); }
  catch { throw new MailProviderError("unavailable", "Mail returned an incomplete response. Refresh to try again.", body.action === "send" ? "unknown" : "rejected"); }
}
function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new MailProviderError("unavailable", "Mail returned a response that could not be displayed safely.");
  return result.data;
}
export async function listMailboxes(context: DashboardContext): Promise<InboxMailbox[]> {
  return checked(z.object({ mailboxes: z.array(mailboxSchema).max(100) }), await request(context, { action: "mailboxes" })).mailboxes;
}
export async function listMailThreads(context: DashboardContext, mailboxId: string, input: { view: "inbox" | "sent" | "archive"; q: string; page: number; unreadOnly: boolean }) {
  const page = checked(pageSchema, await request(context, { action: "threads", mailboxId, ...input }));
  const items: MailThread[] = page.threads.map(t => ({ id: t.thread_id, latestMessageId: t.latest_id, subject: t.subject, preview: t.preview, participants: t.participants.map(p => p.name ? `${p.name} <${p.address}>` : p.address), messageCount: t.message_count, isRead: t.is_read, hasAttachments: t.has_attachments, deliveryStatus: t.status, updatedAt: t.created_at }));
  return { items, total: page.total, page: page.page, pages: page.pageCount };
}
export async function getMailThread(context: DashboardContext, mailboxId: string, threadId: string): Promise<MailThreadRecord> {
  const t = checked(threadSchema, await request(context, { action: "thread", mailboxId, threadId }));
  return { threadId: t.threadId, subject: t.subject, messages: t.messages.map(m => ({ id: m.id, direction: m.direction, from: m.from_addr, fromName: m.from_name, to: m.to_addr, cc: m.cc_addr, subject: m.subject, text: m.body_text, deliveryStatus: m.status, deliveryDetail: m.status_detail, createdAt: m.created_at, replyTargets: m.reply_target, attachments: m.attachments.map(a => ({ id: a.id, filename: a.filename, contentType: a.content_type, size: a.size_bytes })) })) };
}
export async function sendMail(context: DashboardContext, input: MailSendInput): Promise<MailSendResult> {
  // Mail derives reply recipients and subject from the approved original message.
  // Never let a browser-supplied field override that address-scoped context.
  const { to, subject, ...message } = input;
  const value = await request(context, input.threadId
    ? { action: "send", ...message }
    : { action: "send", ...message, to, subject });
  const result = sendSchema.safeParse(value);
  if (!result.success) throw new MailProviderError("unavailable", "Mail is checking this send attempt. Keep its attempt ID when retrying.", "unknown");
  return result.data;
}
export async function downloadMailAttachment(context: DashboardContext, input: { mailboxId: string; messageId: string; attachmentId: string }) {
  return await request(context, { action: "attachment", ...input }, true) as Response;
}
