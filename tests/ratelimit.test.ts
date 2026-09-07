import { describe, it, expect, beforeEach } from 'vitest';

describe('Rate Limiter', () => {
  let rateLimit: typeof import('@/server/ratelimit').rateLimit;
  let rateLimitHeaders: typeof import('@/server/ratelimit').rateLimitHeaders;

  beforeEach(async () => {
    const mod = await import('@/server/ratelimit');
    rateLimit = mod.rateLimit;
    rateLimitHeaders = mod.rateLimitHeaders;
  });

  it('пропускает запросы в пределах лимита', async () => {
    const key = `test:${Date.now()}`;
    const r1 = await rateLimit({ key, limit: 3, windowSec: 60 });
    const r2 = await rateLimit({ key, limit: 3, windowSec: 60 });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('блокирует при превышении лимита', async () => {
    const key = `test:block:${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await rateLimit({ key, limit: 2, windowSec: 60 });
    }
    const blocked = await rateLimit({ key, limit: 2, windowSec: 60 });
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('rateLimitHeaders возвращает правильные заголовки', () => {
    const result = {
      ok: true,
      limit: 10,
      remaining: 7,
      resetAt: new Date(Date.now() + 60_000),
    };
    const headers = rateLimitHeaders(result);
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('7');
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(0);
  });
});
