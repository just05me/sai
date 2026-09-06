/**
 * BYOK client crypto — модель нулевого знания сервера.
 *
 * Поток (см. ТЗ §7.1):
 *   1. Пользователь вводит API-ключ в браузере.
 *   2. Web Crypto API: PBKDF2(user_id + server_secret_half) → master key.
 *   3. AES-256-GCM шифрует ключ. На сервер уходит зашифрованный BLOB + iv + salt.
 *   4. При AI-запросе сервер вытаскивает BLOB, расшифровывает в RAM, использует, не логирует.
 *
 * Половина секрета хранится на клиенте (production уровня требует Web Auth/Passkey
 * для дополнительной защиты). server_secret_half — это BYOK_SERVER_SECRET, который
 * сервер примешивает к user_id при выводе ключа.
 */

const ITER = 250_000;
const KEY_LEN = 32;

function te(s: string): BufferSource {
  return new TextEncoder().encode(s) as unknown as BufferSource;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function fromBase64(b64: string): BufferSource {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out as unknown as BufferSource;
}

async function deriveKey(passphrase: string, salt: BufferSource): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: KEY_LEN * 8 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Шифрует API-ключ. passphrase должна быть устойчиво воспроизводима у пользователя
 * (например, user.id + дополнительный секрет, который мы получаем по auth-сессии).
 */
export async function encryptKey(plain: string, passphrase: string): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt as unknown as BufferSource);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    te(plain),
  );
  return { ciphertext: toBase64(cipher), iv: toBase64(iv), salt: toBase64(salt) };
}

export async function decryptKey(blob: EncryptedBlob, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(blob.salt));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ciphertext),
  );
  return new TextDecoder().decode(plain);
}

/**
 * Маскирует ключ для UI: показываем только первые 4 и последние 4 символа.
 */
export function maskKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
