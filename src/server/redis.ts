import IORedis, { type Redis } from 'ioredis';
import { env } from '@/env';

declare global {
  // eslint-disable-next-line no-var
  var __redis__: Redis | undefined;
  // eslint-disable-next-line no-var
  var __redis_sub__: Redis | undefined;
}

function create(): Redis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
}

export const redis = globalThis.__redis__ ?? create();
export const redisSub = globalThis.__redis_sub__ ?? create();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis__ = redis;
  globalThis.__redis_sub__ = redisSub;
}
