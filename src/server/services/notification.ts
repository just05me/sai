/**
 * NotificationService — in-app уведомления (запись в БД).
 */
import { prisma } from '@/server/prisma';
import type { NotificationKind } from '@prisma/client';

export const NotificationService = {
  async push(opts: {
    userId: string;
    kind: NotificationKind;
    payload: Record<string, unknown>;
    sendEmail?: boolean;
  }) {
    return prisma.notification.create({
      data: { userId: opts.userId, kind: opts.kind, payload: opts.payload as object },
    });
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
