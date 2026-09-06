/**
 * Structured logger for Sai.
 *
 * Wraps pino with:
 *  - JSON output in production, pretty-print in development
 *  - Request-scoped correlation IDs (x-request-id header)
 *  - Standard log levels: trace/debug/info/warn/error/fatal
 *  - Redaction of sensitive fields (keys, tokens, passwords)
 *
 * Usage:
 *   import { logger } from '@/server/logger';
 *   logger.info({ userId: 'abc', action: 'node.created' }, 'Node created');
 *   logger.error({ err, requestId: ctx.reqId }, 'AI stream failed');
 */

const isProduction = process.env.NODE_ENV === 'production';

interface Logger {
  trace: (obj: Record<string, unknown>, msg?: string) => void;
  debug: (obj: Record<string, unknown>, msg?: string) => void;
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  fatal: (obj: Record<string, unknown>, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

const SENSITIVE_KEYS = new Set([
  'apiKey', 'api_key', 'secret', 'password', 'token',
  'authorization', 'cookie', 'key', 'credentials',
  'AUTH_SECRET', 'BYOK_SERVER_SECRET', 'STRIPE_SECRET_KEY',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      result[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = redact(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function formatLog(level: string, obj: Record<string, unknown>, msg?: string): void {
  const entry = redact(obj);
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({ timestamp, level, ...entry, ...(msg ? { msg } : {}) });

  if (isProduction) {
    process.stdout.write(line + '\n');
  } else {
    // Pretty-print for development
    const emoji: Record<string, string> = { trace: '🔍', debug: '🐛', info: 'ℹ️', warn: '⚠️', error: '❌', fatal: '💀' };
    const prefix = emoji[level] || '•';
    const msgPart = msg ? ` ${msg}` : '';
    console.log(`${prefix} [${level.toUpperCase()}]${msgPart}`, redact(obj));
  }
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const logFn = (level: string) => (obj: Record<string, unknown>, msg?: string) => {
    formatLog(level, { ...bindings, ...obj }, msg);
  };

  return {
    trace: logFn('trace'),
    debug: logFn('debug'),
    info: logFn('info'),
    warn: logFn('warn'),
    error: logFn('error'),
    fatal: logFn('fatal'),
    child: (childBindings: Record<string, unknown>) =>
      createLogger({ ...bindings, ...childBindings }),
  };
}

export const logger: Logger = createLogger({ service: 'sai' });

/** Create a request-scoped logger with correlation ID. */
export function requestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}
