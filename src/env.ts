/**
 * Безопасный доступ к env с runtime-валидацией.
 * Парсится один раз при старте процесса.
 */
import { z } from 'zod';

const schema = z.object({
  SAI_MODE: z.enum(['cloud', 'selfhost']).default('selfhost'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_COLLAB_URL: z.string().default('ws://localhost:3001'),
  APP_PORT: z.coerce.number().default(3000),
  COLLAB_PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('sai-attachments'),
  S3_PUBLIC_URL: z.string().optional(),

  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  EMAIL_FROM: z.string().default('Sai <no-reply@sai.local>'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().default(587),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),

  BYOK_SERVER_SECRET: z.string().min(16),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_TEAM: z.string().optional(),
  STRIPE_PRICE_SELFHOST_PRO: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),

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
    return schema.parse({ ...process.env, AUTH_SECRET: 'dev-only-not-secure-32-chars-min', BYOK_SERVER_SECRET: 'dev-only-not-secure-32-chars-min', DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://sai:sai@localhost:5432/sai' });
  }
  globalThis.__sai_env__ = parsed.data;
  return parsed.data;
}

export const env = loadEnv();
export const isCloud = env.SAI_MODE === 'cloud';
export const isSelfHost = env.SAI_MODE === 'selfhost';
