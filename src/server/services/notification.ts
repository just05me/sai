/**
 * NotificationService — in-app + email через BullMQ.
 * Self-host: если SMTP не настроен — email gracefully отключается.
 */
import { prisma } from '@/server/prisma';
import { redis } from '@/server/redis';
import { Queue } from 'bullmq';
import type { NotificationKind } from '@prisma/client';
import { env } from '@/env';

const emailQueue = new Queue('email', { connection: redis });

const isEmailEnabled = !!(env.RESEND_API_KEY || env.EMAIL_SERVER_HOST);

export const NotificationService = {
  async push(opts: {
    userId: string;
    kind: NotificationKind;
    payload: Record<string, unknown>;
    sendEmail?: boolean;
  }) {
    const n = await prisma.notification.create({
      data: { userId: opts.userId, kind: opts.kind, payload: opts.payload as object },
    });
    if (opts.sendEmail && isEmailEnabled) {
      await emailQueue.add('immediate', { userId: opts.userId, kind: opts.kind, payload: opts.payload });
    }
    return n;
  },

  async markRead(userId: string, ids: string[]) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { readAt: new Date() },
    });
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },
};
