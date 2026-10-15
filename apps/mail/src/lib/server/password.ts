import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFC'), salt, 32, options, (error, key) => error ? reject(error) : resolve(key));
  });
}
export function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < 15 || password.length > 128) {
    throw new Error('Use a password or phrase between 15 and 128 characters.');
  }
}
export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  return `scrypt:32768:8:3:${salt.toString('base64')}:${(await derive(password, salt)).toString('base64')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [algorithm, n, r, p, salt, expected] = stored.split(':');
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !salt || !expected) return false;
  const bytes = Buffer.from(expected, 'base64');
  if (bytes.length !== 32 || Buffer.from(salt, 'base64').length !== 16) return false;
  return timingSafeEqual(await derive(password, Buffer.from(salt, 'base64')), bytes);
}
