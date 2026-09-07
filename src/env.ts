/**
 * Безопасный доступ к env с runtime-валидацией.
 * Sai 1.0 — только selfhost-режим.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  APP_PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  BYOK_SERVER_SECRET: z.string().min(16),

  DEFAULT_LOCALE: z.enum(['ru', 'en']).default('ru'),
});

type Env = z.infer<typeof schema>;

declare global {
  var __sai_env__: Env | undefined;
}

function loadEnv(): Env {
  if (globalThis.__sai_env__) return globalThis.__sai_env__;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`✗ env validation failed:\n${issues}`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
    return schema.parse({
      ...process.env,
      AUTH_SECRET: 'dev-only-not-secure-32-chars-min',
      BYOK_SERVER_SECRET: 'dev-only-not-secure-32-chars-min',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://sai:sai@localhost:5432/sai',
    });
  }
  globalThis.__sai_env__ = parsed.data;
  return parsed.data;
}

export const env = loadEnv();
