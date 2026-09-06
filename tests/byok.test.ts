import { describe, it, expect } from 'vitest';
import { encryptKey, decryptKey, maskKey } from '@/lib/byok';

describe('BYOK Web Crypto round-trip', () => {
  it('шифрует и расшифровывает API-ключ', async () => {
    const original = 'sk-abc-very-secret-key-1234567890';
    const pass = 'sai:user-abc';
    const blob = await encryptKey(original, pass);
    expect(blob.ciphertext).toBeTruthy();
    const decrypted = await decryptKey(blob, pass);
    expect(decrypted).toBe(original);
  });

  it('расшифровка с неверным паролем падает', async () => {
    const blob = await encryptKey('sk-secret', 'good-pass');
    await expect(decryptKey(blob, 'wrong-pass')).rejects.toBeTruthy();
  });

  it('maskKey показывает только префикс и суффикс', () => {
    expect(maskKey('sk-1234567890abcdef')).toBe('sk-1…cdef');
    expect(maskKey('short')).toBe('••••••••');
  });
});
