import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger', () => {
  let consoleLogCalls: unknown[][] = [];

  beforeEach(() => {
    consoleLogCalls = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleLogCalls.push(args);
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getLogger() {
    // Re-import to get fresh module state (respects NODE_ENV)
    vi.resetModules();
    const mod = await import('@/server/logger');
    return mod.logger;
  }

  it('вызывает console.log с уровнем info', async () => {
    const logger = await getLogger();
    logger.info({ action: 'test' }, 'test message');

    expect(consoleLogCalls.length).toBeGreaterThan(0);
    const [prefix, data] = consoleLogCalls[0];
    expect(String(prefix)).toContain('INFO');
    expect(String(prefix)).toContain('test message');
    expect(data).toEqual({ service: 'sai', action: 'test' });
  });

  it('краснечит (redacts) чувствительные поля', async () => {
    const logger = await getLogger();
    logger.info({ apiKey: 'sk-secret-12345', name: 'test' }, 'with secret');

    const [, data] = consoleLogCalls[0];
    expect((data as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((data as Record<string, unknown>).name).toBe('test');
  });

  it('создаёт дочерний логгер с дополнительными bindings', async () => {
    const logger = await getLogger();
    const child = logger.child({ requestId: 'req-123' });
    child.info({ action: 'test' });

    const [, data] = consoleLogCalls[0];
    expect((data as Record<string, unknown>).requestId).toBe('req-123');
    expect((data as Record<string, unknown>).action).toBe('test');
  });

  it('requestLogger создаёт логгер с requestId', async () => {
    vi.resetModules();
    const mod = await import('@/server/logger');
    const reqLogger = mod.requestLogger('abc-123');
    reqLogger.warn({ code: 'RATE_LIMIT' });

    const [prefix, data] = consoleLogCalls[0];
    expect(String(prefix)).toContain('WARN');
    expect((data as Record<string, unknown>).requestId).toBe('abc-123');
    expect((data as Record<string, unknown>).code).toBe('RATE_LIMIT');
  });

  it('поддерживает все уровни', async () => {
    const logger = await getLogger();
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

    for (const level of levels) {
      logger[level]({ level });
      const [prefix] = consoleLogCalls.at(-1)!;
      expect(String(prefix)).toContain(level.toUpperCase());
    }
  });

  it('краснечит вложенные чувствительные поля', async () => {
    const logger = await getLogger();
    logger.info({
      config: { password: 'secret123', host: 'localhost' },
    });

    const [, data] = consoleLogCalls[0];
    const config = (data as Record<string, unknown>).config as Record<string, unknown>;
    expect(config.password).toBe('[REDACTED]');
    expect(config.host).toBe('localhost');
  });

  it('log без сообщения работает', async () => {
    const logger = await getLogger();
    logger.info({ action: 'no-message' });

    expect(consoleLogCalls.length).toBeGreaterThan(0);
  });
});
