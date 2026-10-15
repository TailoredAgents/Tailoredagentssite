import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { imageSize } from 'image-size';
import { MAX_EMAIL_SIGNATURE_LENGTH, MAX_SIGNATURE_BANNER_BYTES, normalizeBannerLink, normalizeEmailSignature, type SignatureBanner } from '$lib/email-signature';
import { base64ToBytes, bytesToBase64 } from './attachments';
import { retainObject } from './content';
import type { OutboundAttachmentInput } from '$lib/types';

type StoredBanner = SignatureBanner & { storage_key: string };

export async function getSignatureBanner(db: D1Database, userId: string): Promise<StoredBanner | null> {
	return db.prepare('SELECT id,storage_key,filename,content_type,size_bytes,width,height,alt,link FROM signature_banners WHERE user_id=?').bind(userId).first<StoredBanner>();
}

export function publicSignatureBanner(banner: StoredBanner | null): SignatureBanner | null {
	if (!banner) return null;
	const { storage_key, ...metadata } = banner;
	return metadata;
}

export class SignatureInputError extends Error {}

/** Only inspect PNG/JPEG bytes, never trust a filename or browser MIME type. */
function readBannerUpload(value: unknown) {
	if (!value || typeof value !== 'object') throw new SignatureInputError('Choose a PNG or JPG banner.');
	const { content, filename } = value as Record<string, unknown>;
	if (typeof content !== 'string' || !content || content.length > Math.ceil(MAX_SIGNATURE_BANNER_BYTES / 3) * 4) {
		throw new SignatureInputError('Choose a banner no larger than 1 MB.');
	}
	if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
		throw new SignatureInputError('The image could not be read. Choose it again.');
	}
	const bytes = base64ToBytes(content);
	if (bytes.length > MAX_SIGNATURE_BANNER_BYTES) throw new SignatureInputError('Choose a banner no larger than 1 MB.');
	const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
	const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	if (!png && !jpg) throw new SignatureInputError('Choose a PNG or JPG image. Other file types are not supported.');
	let dimensions;
	try { dimensions = imageSize(bytes); }
	catch { throw new SignatureInputError('This image could not be read. Try another PNG or JPG.'); }
	const { width, height, type } = dimensions;
	if (!['png', 'jpg'].includes(type ?? '') || !width || !height || width > 6000 || height > 6000 || width * height > 16000000) {
		throw new SignatureInputError('Choose a smaller image, up to 6,000 pixels per side and 16 million pixels in total.');
	}
	const extension = type === 'png' ? 'png' : 'jpg';
	const name = typeof filename === 'string' ? filename.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9 _-]/g, '_').slice(0, 80) : '';
	return { bytes, width, height, filename: `${name || 'email-signature'}.${extension}`, content_type: type === 'png' ? 'image/png' : 'image/jpeg' };
}

/** Text, image and link are saved together; omitted banner preserves the current image. */
export async function saveEmailSignature(db: D1Database, bucket: R2Bucket, userId: string, input: unknown) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignatureInputError('Invalid signature.');
	const body = input as Record<string, unknown>;
	if (typeof body.signature !== 'string' || body.signature.length > MAX_EMAIL_SIGNATURE_LENGTH) {
		throw new SignatureInputError(`Keep signature text at ${MAX_EMAIL_SIGNATURE_LENGTH} characters or fewer.`);
	}
	if (body.bannerAlt !== undefined && (typeof body.bannerAlt !== 'string' || body.bannerAlt.length > 160)) throw new SignatureInputError('Keep the image description at 160 characters or fewer.');
	if (body.bannerLink !== undefined && typeof body.bannerLink !== 'string') throw new SignatureInputError('Enter a website link for your banner.');
	const current = await getSignatureBanner(db, userId);
	const alt = typeof body.bannerAlt === 'string' ? body.bannerAlt.trim() || 'Email signature' : current?.alt ?? 'Email signature';
	let link: string;
	try { link = normalizeBannerLink(typeof body.bannerLink === 'string' ? body.bannerLink : current?.link ?? ''); }
	catch (error) { throw new SignatureInputError(error instanceof Error ? error.message : 'Invalid banner link.'); }
	const signature = normalizeEmailSignature(body.signature);
	const statements = [db.prepare('UPDATE users SET email_signature=? WHERE id=?').bind(signature, userId)];
	if (body.banner === null) {
		statements.push(db.prepare('DELETE FROM signature_banners WHERE user_id=?').bind(userId));
	} else if (body.banner !== undefined) {
		const upload = readBannerUpload(body.banner);
		const id = crypto.randomUUID(), key = `signatures/${userId}/${id}`;
		// Schedule orphan cleanup before R2 writes. Active references protect saved files.
		await retainObject(db, key);
		await bucket.put(key, upload.bytes, { httpMetadata: { contentType: upload.content_type } });
		statements.push(db.prepare(`INSERT INTO signature_banners(user_id,id,storage_key,filename,content_type,size_bytes,width,height,alt,link)
		 VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
		 id=excluded.id,storage_key=excluded.storage_key,filename=excluded.filename,content_type=excluded.content_type,
		 size_bytes=excluded.size_bytes,width=excluded.width,height=excluded.height,alt=excluded.alt,link=excluded.link`)
			.bind(userId,id,key,upload.filename,upload.content_type,upload.bytes.length,upload.width,upload.height,alt,link));
	} else if (current) {
		statements.push(db.prepare('UPDATE signature_banners SET alt=?,link=? WHERE user_id=?').bind(alt,link,userId));
	}
	await db.batch(statements);
	return { signature, banner: publicSignatureBanner(await getSignatureBanner(db,userId)) };
}

export async function signatureBannerAttachment(bucket: R2Bucket, banner: StoredBanner, contentId: string): Promise<OutboundAttachmentInput> {
	const file = await bucket.get(banner.storage_key);
	if (!file || file.size !== banner.size_bytes || file.size > MAX_SIGNATURE_BANNER_BYTES) {
		throw new Error('Your signature banner is unavailable. Please try again or upload it again in Settings.');
	}
	return { filename: banner.filename, type: banner.content_type, content: bytesToBase64(new Uint8Array(await file.arrayBuffer())), disposition: 'inline', contentId };
}

export async function getEmailSignature(db: D1Database, userId: string): Promise<string> {
	const row = await db
		.prepare('SELECT email_signature FROM users WHERE id = ?')
		.bind(userId)
		.first<{ email_signature: string }>();

	return row?.email_signature ?? '';
}

export async function updateEmailSignature(
	db: D1Database,
	userId: string,
	value: string
): Promise<string> {
	const signature = normalizeEmailSignature(value);
	await db
		.prepare('UPDATE users SET email_signature = ? WHERE id = ?')
		.bind(signature, userId)
		.run();

	return signature;
}
