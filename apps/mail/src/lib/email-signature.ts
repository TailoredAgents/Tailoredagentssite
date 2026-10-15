export const MAX_EMAIL_SIGNATURE_LENGTH = 1000;
export const MAX_SIGNATURE_BANNER_BYTES = 1024 * 1024;
export const MAX_SIGNATURE_REQUEST_BYTES = Math.ceil(MAX_SIGNATURE_BANNER_BYTES * 4 / 3) + 16 * 1024;

export type SignatureBanner = {
	id: string;
	filename: string;
	content_type: string;
	size_bytes: number;
	width: number;
	height: number;
	alt: string;
	link: string;
};

export function signatureBannerUrl(id: string): string {
	return `/api/settings/signature/banner/${encodeURIComponent(id)}`;
}

export function normalizeBannerLink(value: string): string {
	const link = value.trim();
	if (!link) return '';
	if (link.length > 2048) throw new Error('The banner link is too long.');
	let url: URL;
	try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(link) ? link : `https://${link}`); }
	catch { throw new Error('Enter a valid website link for your banner.'); }
	if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('Use a website link starting with https:// or http://.');
	}
	return url.href;
}

/** Keep intentional line breaks while removing transport and trailing whitespace noise. */
export function normalizeEmailSignature(value: string): string {
	return value
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Mailbox sign-off wins when set; otherwise the account signature. */
export function pickEmailSignature(
	mailbox: string | null | undefined,
	account: string | null | undefined
): string {
	return normalizeEmailSignature(mailbox ?? '') || normalizeEmailSignature(account ?? '');
}

/** Empty input becomes null so the mailbox falls back to the account signature. */
export function parseMailboxSignature(value: string): string | null {
	const signature = normalizeEmailSignature(value);
	if (signature.length > MAX_EMAIL_SIGNATURE_LENGTH) {
		throw new Error(`Signature must be ${MAX_EMAIL_SIGNATURE_LENGTH} characters or fewer`);
	}
	return signature || null;
}

/** Append the configured sign-off to both MIME alternatives exactly once at send time. */
export function appendEmailSignature(input: {
	text: string;
	html: string | null;
	signature: string;
	banner?: Pick<SignatureBanner, 'width' | 'height' | 'alt' | 'link'> & { contentId: string };
}): { text: string; html: string | null } {
	const signature = normalizeEmailSignature(input.signature);
	if (!signature && !input.banner) return { text: input.text, html: input.html };
	if (input.banner) {
		const banner = input.banner;
		const width = Math.min(banner.width, 600);
		const height = Math.max(1, Math.round(banner.height * width / banner.width));
		const link = normalizeBannerLink(banner.link);
		const image = `<img src="cid:${escapeHtml(banner.contentId)}" alt="${escapeHtml(banner.alt)}" width="${width}" height="${height}" style="display:block;border:0;width:${width}px;max-width:100%;height:auto;">`;
		const bannerHtml = link ? `<a href="${escapeHtml(link)}">${image}</a>` : image;
		const signatureHtml = signature ? `<div>${escapeHtml(signature).replaceAll('\n', '<br>\n')}</div>\n` : '';
		const fallback = [signature, banner.alt, link].filter(Boolean).join('\n');
		return {
			text: `${input.text.trimEnd()}\n\n${fallback}`,
			html: `${input.html?.trimEnd() || escapeHtml(input.text).replaceAll('\n', '<br>\n')}\n<div data-email-signature="true" style="margin-top:20px;">${signatureHtml}<div style="margin-top:12px;">${bannerHtml}</div></div>`
		};
	}

	const text = `${input.text.trimEnd()}\n\n${signature}`;
	const html = input.html
		? `${input.html.trimEnd()}\n<div><br></div>\n<div data-email-signature="true">${escapeHtml(signature).replaceAll('\n', '<br>\n')}</div>`
		: null;

	return { text, html };
}
