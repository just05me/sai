/**
 * Единая точка запуска BullMQ-воркеров.
 * Запуск: `tsx src/workers/index.ts` (или sai-worker docker сервис).
 */
import { Worker } from 'bullmq';
import { redis } from '@/server/redis';
import { WebhookService } from '@/server/services/webhook';
import { sendEmail } from './email';
import { exportPdf } from './pdf';

console.log('[worker] starting…');

new Worker(
  'webhooks',
  async (job) => {
    await WebhookService.deliver(
      job.data.endpointId,
      (job.data.event as string) ?? job.name,
      job.data.payload,
    );
  },
  { connection: redis, concurrency: 10 },
).on('failed', (job, err) => console.error('[webhook]', job?.id, err.message));

new Worker(
  'email',
  async (job) => {
    await sendEmail(job.data);
  },
  { connection: redis, concurrency: 5 },
).on('failed', (job, err) => console.error('[email]', job?.id, err.message));

new Worker(
  'export-pdf',
  async (job) => {
    await exportPdf(job.data);
  },
  { connection: redis, concurrency: 2 },
).on('failed', (job, err) => console.error('[pdf]', job?.id, err.message));

console.log('[worker] running');
