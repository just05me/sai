import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем Redis — он недоступен (selfhost-режим)
vi.mock('@/server/redis', () => ({
  redis: {
    multi: () => {
      throw new Error('Redis unavailable');
    },
  },
}));

describe('Rate Limiter', () => {
  let rateLimit: typeof import('@/server/ratelimit').rateLimit;
  let rateLimitHeaders: typeof import('@/server/ratelimit').rateLimitHeaders;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/server/ratelimit');
    rateLimit = mod.rateLimit;
    rateLimitHeaders = mod.rateLimitHeaders;
  });

  it('fail-open: пропускает запрос когда Redis недоступен', async () => {
    const result = await rateLimit({
      key: 'test:user:1',
      limit: 5,
      windowSec: 60,
    });

    expect(result.ok).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(5);
  });

  it('возвращает валидный resetAt даже без Redis', async () => {
    const result = await rateLimit({
      key: 'test:user:2',
      limit: 10,
      windowSec: 30,
    });

    expect(result.resetAt).toBeInstanceOf(Date);
    const resetIn = result.resetAt.getTime() - Date.now();
    expect(resetIn).toBeGreaterThan(0);
    expect(resetIn).toBeLessThanOrEqual(30_000);
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
    expect(headers['X-RateLimit-Reset']).toBeTruthy();
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(0);
  });
});
