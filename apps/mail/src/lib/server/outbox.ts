import { indexFullText } from './search';
import { cleanComposedHtml, saveContent } from './content';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { EmailRow, MailAddress, OutboundAttachmentInput, User } from '$lib/types';
import { appendEmailSignature, pickEmailSignature } from '$lib/email-signature';
import { base64ByteLength, insertAttachments } from './attachments';
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENTS_PER_EMAIL,
	MAX_TOTAL_ATTACHMENT_BYTES
} from './constants';
import {
	getAddressForUser,
	getDefaultAddress,
	getDomainByName,
	listAddressesForUser
} from './domains';
import { parseEmailAddress, parseEmailAddresses } from './email-address';
import { getEmailSignature, getSignatureBanner, signatureBannerAttachment } from './email-signature';
import { stripHtml } from './html';
import { insertEmail, listThreadMessages } from './mail-store';
import { initialOutboundStatus, ProviderError, type EmailProvider } from './email-provider';
import {
	claimSendAttempt,
	completeSendAttempt,
	failSendAttempt,
	markSendUncertain,
	recordProviderAccepted,
	sha256Hex
} from './send-attempts';
import {
	claimDailySend,
	refundDailySend,
	SendPolicyError,
	utcDay,
	type ApiSendPolicy
} from './send-policy';
import { escapeHtml, parseRecipients, sendOutboundEmail, validateSubject } from './send-mail';

export type ComposeInput = {
	fromAddressId?: string | null;
	/** Pre-resolved identity — used by replies so we can send from the received mailbox. */
	fromAddress?: MailAddress | null;
	to: string;
	cc?: string | null;
	bcc?: string | null;
	subject: string;
	text?: string | null;
	html?: string | null;
	inReplyTo?: string | null;
	references?: string | null;
	replyToEmailId?: string | null;
	attachments?: OutboundAttachmentInput[];
	/** Forward-all can legitimately combine the per-message attachment sets. */
	allowCombinedAttachments?: boolean;
	/** Disable subject fallback for messages that intentionally start a thread. */
	subjectMatch?: boolean;
	/** Retries with the same key return the first result instead of sending again. */
	idempotencyKey?: string | null;
	/** Set when an API key or OAuth token is sending, never for a browser session. */
	apiPolicy?: ApiSendPolicy;
	/** Server-only authorization recheck immediately before delivery. */
	beforeDelivery?: () => Promise<void>;
	/** Server-only CRM origin, saved before any recoverable provider payload. */
	crmAuthorization?: { actorId: string; mailboxAddressId: string };
};

export function assertTotalAttachmentBytes(totalBytes: number): void {
	if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
		throw new Error('Attachments exceed the total size limit of 20 MB.');
	}
}

/** Reject attachment sets before provider delivery or Sent-folder persistence. */
export function assertOutboundAttachments(
	attachments: OutboundAttachmentInput[],
	allowCombinedAttachments = false
): void {
	if (!allowCombinedAttachments && attachments.length > MAX_ATTACHMENTS_PER_EMAIL) {
		throw new Error(`Maximum ${MAX_ATTACHMENTS_PER_EMAIL} attachments allowed`);
	}

	for (const attachment of attachments) {
		const bytes = base64ByteLength(attachment.content);
		if (bytes > MAX_ATTACHMENT_BYTES) {
			const limitMb = MAX_ATTACHMENT_BYTES / (1024 * 1024);
			throw new Error(`"${attachment.filename}" exceeds ${limitMb}MB limit`);
		}
	}

	assertTotalAttachmentBytes(
		attachments.reduce((sum, attachment) => sum + base64ByteLength(attachment.content), 0)
	);
}

/**
 * Pick the identity a message is sent from: the one the composer chose, or the
 * user's default. Only addresses the user actually owns are accepted.
 */
export async function resolveFromAddress(
	db: D1Database,
	user: User,
	addressId?: string | null
): Promise<MailAddress> {
	const address = addressId
		? await getAddressForUser(db, user.id, addressId)
		: await getDefaultAddress(db, user.id);

	if (!address) {
		throw new Error('No sending address configured. Add one in Settings first.');
	}

	return address;
}

/**
 * Replies come from the mailbox that received the original, not the default
 * sending identity. Catch-all mail uses that exact recipient if the user owns
 * the domain, even when the local-part is not a saved address.
 *
 * Returns null when the user has no sending identity, so the thread page can
 * still load.
 */
/**
 * Catch-all replies send from an address that has no `addresses` row, so the id
 * below is synthetic. `emails.address_id` has a foreign key onto `addresses`,
 * so it must be stored as NULL — the address itself is still kept in `from_addr`.
 */
const SYNTHETIC_ADDRESS_ID_PREFIX = 'reply:';

export function persistableAddressId(id: string | null | undefined): string | null {
	if (!id || id.startsWith(SYNTHETIC_ADDRESS_ID_PREFIX)) return null;
	return id;
}

export async function resolveReplyFromAddress(
	db: D1Database,
	user: User,
	original: { direction: 'inbound' | 'outbound'; to_addr: string; from_addr: string }
): Promise<MailAddress | null> {
	const mailbox = parseEmailAddress(
		original.direction === 'inbound' ? original.to_addr : original.from_addr
	);

	const owned = await listAddressesForUser(db, user.id);
	const exact = owned.find((address) => address.address.toLowerCase() === mailbox);
	if (exact) return exact;

	const domainName = mailbox.split('@')[1];
	const domain = domainName ? await getDomainByName(db, domainName) : null;
	const canSendOnDomain =
		domain &&
		(domain.catchall_user_id === user.id ||
			owned.some((address) => address.domain_id === domain.id));

	if (domain && canSendOnDomain && mailbox.includes('@')) {
		return {
			id: `reply:${mailbox}`,
			user_id: user.id,
			domain_id: domain.id,
			domain_name: domain.name,
			address: mailbox,
			label: null,
			signature: null,
			is_default: false,
			created_at: new Date().toISOString()
		};
	}

	return getDefaultAddress(db, user.id);
}

/** Who a reply goes to: the sender, or — replying to our own message — its recipients. */
export function replyTarget(message: Pick<EmailRow, 'direction' | 'from_addr' | 'to_addr' | 'reply_to_addr'>): string[] {
	return parseEmailAddresses(message.direction === 'inbound' ? message.reply_to_addr || message.from_addr : message.to_addr);
}

export type ReplyGuardErrorCode = 'conversation_advanced' | 'recipient_changed';

export class ReplyGuardError extends Error {
	readonly status = 409;

	constructor(
		readonly code: ReplyGuardErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ReplyGuardError';
	}
}

function sameAddresses(left: string[], right: string[]): boolean {
	const normalize = (values: string[]) =>
		[...new Set(values.map((value) => parseEmailAddress(value)).filter(Boolean))].sort();
	const a = normalize(left);
	const b = normalize(right);
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * An agent replies from what it last read. Refuse when that is stale: the
 * conversation has moved past the message it is answering — a new message from
 * them, or a reply someone else sent meanwhile — or the reply would reach
 * someone other than the recipients it reviewed.
 */
export async function assertReplyReviewed(
	db: D1Database,
	userId: string,
	original: EmailRow,
	recipients: string[],
	expectedRecipients: string[]
): Promise<void> {
	const messages = await listThreadMessages(db, userId, original);
	const index = messages.findIndex((message) => message.id === original.id);
	if (index >= 0 && index < messages.length - 1) {
		throw new ReplyGuardError(
			'conversation_advanced',
			'This conversation has a newer message than the one you are replying to. Read it again and reply to the latest message.'
		);
	}
	if (!sameAddresses(recipients, expectedRecipients)) {
		throw new ReplyGuardError(
			'recipient_changed',
			`This reply would go to ${recipients.join(', ') || 'nobody'}, not the expected recipients. Read the conversation again before replying.`
		);
	}
}

/** What the recipient would receive — a reused Idempotency-Key must match it. */
async function composeFingerprint(from: MailAddress, input: ComposeInput): Promise<string> {
	// Each attachment is hashed on its own: joining up to 25 MB of base64 into
	// one string, then encoding it, would hold several copies in memory at once.
	const attachments: string[][] = [];
	for (const attachment of input.attachments ?? []) {
		attachments.push([
			attachment.filename,
			attachment.type,
			attachment.disposition ?? '',
			attachment.contentId ?? '',
			await sha256Hex(attachment.content)
		]);
	}
	return sha256Hex(
		JSON.stringify({
			from: from.address,
			to: parseRecipients(input.to),
			cc: parseRecipients(input.cc),
			bcc: parseRecipients(input.bcc),
			subject: input.subject.trim(),
			text: input.text?.trim() ?? '',
			html: input.html?.trim() ?? '',
			inReplyTo: input.inReplyTo ?? null,
			attachments
		})
	);
}

/**
 * Whether the provider refused the message, so it certainly was not sent.
 * Lost responses, timeouts and server errors are ambiguous: it may be out.
 * Cloudflare binding errors that carry no code (`send_failed`) count as ambiguous.
 */
export function providerRefused(error: unknown): boolean {
	if (!(error instanceof ProviderError)) return false;
	if (error.code === 'E_RATE_LIMIT_EXCEEDED') return true;
	return error.status >= 400 && error.status < 500 && error.status !== 409 && error.code !== 'send_failed';
}

/** Persist the complete outgoing message before any provider side effect. */
export async function sendAndStore(
  env: { DB: D1Database; ATTACHMENTS: R2Bucket }, provider: EmailProvider, user: User, input: ComposeInput
): Promise<{ emailId: string; providerId: string; from: MailAddress }> {
  const from = input.fromAddress ?? await resolveFromAddress(env.DB,user,input.fromAddressId);
  const owned = await getAddressForUser(env.DB,user.id,from.id);
  if (!owned || owned.address !== from.address) throw new Error('This sending address does not belong to you.');
  const bodyHtml = input.html ? cleanComposedHtml(input.html) : null;
  const bodyText = input.text?.trim() || (bodyHtml ? stripHtml(bodyHtml) : '');
  if (!bodyText && !bodyHtml) throw new Error('Message body is required');
  const banner = await getSignatureBanner(env.DB,user.id);
  // Stable per message, distinct from banners in quoted/forwarded conversations.
  const contentId = banner ? `signature-${banner.id}-${(await sha256Hex(user.id+':'+input.idempotencyKey)).slice(0,32)}@tailoredagents` : '';
  const { text, html } = appendEmailSignature({ text:bodyText,html:bodyHtml,signature:pickEmailSignature(from.signature,await getEmailSignature(env.DB,user.id)),banner:banner ? {...banner,contentId} : undefined });
  assertOutboundAttachments(input.attachments ?? [],input.allowCombinedAttachments);
  const attachments = [...(input.attachments ?? []),...(banner ? [await signatureBannerAttachment(env.ATTACHMENTS,banner,contentId)] : [])];
  // The automatic image can be one extra file, but still counts toward 20 MB.
  assertOutboundAttachments(attachments,true);
  if (input.apiPolicy) throw new SendPolicyError('api_sending_disabled',403,'External sending is disabled.');
  const subjectError = validateSubject(input.subject); if (subjectError) throw new Error(subjectError);
  if (!parseRecipients(input.to).length) throw new Error('At least one valid recipient is required');
  if (!input.idempotencyKey) throw new Error('Please reload the composer before sending.');
  const fingerprint = await composeFingerprint(from,{...input,text,html:html ?? undefined,attachments});
  const attempt = await claimSendAttempt(env.DB,user.id,input.idempotencyKey,fingerprint);
  if (attempt.kind === 'replay') return {emailId:attempt.emailId,providerId:attempt.providerId,from};
  if (input.crmAuthorization) await env.DB.prepare(`INSERT OR IGNORE INTO crm_mail_send_authorizations(attempt_id,actor_id,mailbox_address_id)
    VALUES(?,?,?)`).bind(attempt.id,input.crmAuthorization.actorId,input.crmAuthorization.mailboxAddressId).run();
  const emailId = 'sent-' + await sha256Hex(attempt.id+':'+fingerprint);
  const contentKey = `messages/${user.id}/${emailId}.json`;
  const payloadKey = `outgoing/${attempt.id}/${fingerprint}.json`;
  const messageId = `${emailId}@${from.domain_name}`;
  let providerCalled = false;
  try {
    await saveContent(env.ATTACHMENTS,contentKey,{text,html:html ?? null});
    await insertEmail(env.DB,{id:emailId,userId:user.id,direction:'outbound',from:from.address,fromName:from.label || user.name,
      to:parseRecipients(input.to).join(', '),cc:parseRecipients(input.cc).join(', ') || null,bcc:parseRecipients(input.bcc).join(', ') || null,
      subject:input.subject,bodyText:text,bodyHtml:html,messageId,inReplyTo:input.inReplyTo,references:input.references,
      replyToEmailId:input.replyToEmailId,domainId:from.domain_id,addressId:from.id,status:'queued',isRead:true,subjectMatch:false});
    await env.DB.prepare('UPDATE emails SET content_key=?,status=\'queued\',status_detail=NULL WHERE id=?').bind(contentKey,emailId).run();
    await indexFullText(env.DB,user.id,emailId,text);
    if (attachments.length) await insertAttachments(env.DB,env.ATTACHMENTS,emailId,attachments,{enforceCountLimit:!input.allowCombinedAttachments && !banner});
    const payload = {from,senderName:from.label || user.name,to:input.to,cc:input.cc,bcc:input.bcc,subject:input.subject,text,html:html ?? undefined,
      inReplyTo:input.inReplyTo,references:input.references,headers:{'Message-ID':`<${messageId}>`},idempotencyKey:`${attempt.id}:${fingerprint}`};
    await env.ATTACHMENTS.put(payloadKey,JSON.stringify(payload));
    await env.DB.prepare("UPDATE send_attempts SET email_id=?,payload_key=?,first_provider_call_at=NULL WHERE id=?").bind(emailId,payloadKey,attempt.id).run();
    await input.beforeDelivery?.();
    // Start the safety window BEFORE calling Resend. Recovery reuses the exact saved request.
    await env.DB.prepare("UPDATE send_attempts SET first_provider_call_at=datetime('now') WHERE id=?").bind(attempt.id).run();
    providerCalled = true;
    const result = await sendOutboundEmail(provider,{...payload,cc:input.cc ?? undefined,bcc:input.bcc ?? undefined,attachments});
    await env.DB.batch([
      env.DB.prepare("UPDATE emails SET provider_id=?,message_id=COALESCE(?,message_id),status='sent',status_at=datetime('now'),status_detail=NULL WHERE id=?").bind(result.providerId,result.messageId ?? null,emailId),
      env.DB.prepare("UPDATE send_attempts SET provider_id=?,status='sent',error=NULL,updated_at=datetime('now') WHERE id=?").bind(result.providerId,attempt.id)
    ]);
    return {emailId,providerId:result.providerId,from};
  } catch (error) {
    const refused = !providerCalled || providerRefused(error);
    await (refused ? failSendAttempt : markSendUncertain)(env.DB,attempt.id,new Error(refused ? 'Message was not sent.' : 'Waiting to confirm delivery.'));
    await env.DB.prepare('UPDATE emails SET status=?,status_detail=? WHERE id=?').bind(refused?'failed':'queued',refused?'Message was not sent. Your draft is still available.':'Checking whether this message was sent. Please do not send a second copy.',emailId).run();
    throw error;
  }
}
