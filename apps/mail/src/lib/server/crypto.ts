export { hashPassword, verifyPassword } from './password';

function toBase64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }

export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return toBase64(new Uint8Array(digest));
}

export function createSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return toBase64(bytes);
}
