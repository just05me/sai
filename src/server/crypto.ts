/**
 * Серверные крипто-утилиты.
 *
 * 1. Зеркало BYOK: для AI-запросов сервер расшифровывает blob.
 *    passphrase = HKDF(BYOK_SERVER_SECRET || userId).
 *    Никогда не логируется, не кешируется между запросами.
 * 2. HMAC для webhook-подписи (X-Sai-Signature).
 */
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual, webcrypto } from 'node:crypto';
import { env } from '@/env';

const subtle = webcrypto.subtle;
const ITER = 250_000;
const KEY_LEN = 32;

function te(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function deriveBYOKPassphrase(userId: string): string {
  return createHash('sha256').update(`${env.BYOK_SERVER_SECRET}|${userId}`).digest('base64');
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', te(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: KEY_LEN * 8 },
    false,
    ['decrypt'],
  );
}

/**
 * Расшифровывает зашифрованный ключ в строку. Результат держим в памяти минимально.
 */
export async function decryptByokKey(
  encrypted: Uint8Array,
  iv: Uint8Array,
  salt: Uint8Array,
  userId: string,
): Promise<string> {
  const pass = deriveBYOKPassphrase(userId);
  const key = await deriveKey(pass, salt);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(plain);
}

/* ---------- WEBHOOK SIGNING ---------- */

export function webhookSignature(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = webhookSignature(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ---------- API TOKEN ---------- */

export function generateApiToken() {
  const raw = randomBytes(32).toString('base64url');
  const prefix = 'sai_' + raw.slice(0, 7);
  const fullToken = `${prefix}_${raw}`;
  const hashedKey = createHash('sha256').update(fullToken).digest('hex');
  return { fullToken, prefix, hashedKey };
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/* ---------- PASSWORD-BASED SHARE-LINK ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 32);
  return timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}
