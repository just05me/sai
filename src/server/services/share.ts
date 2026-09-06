import { nanoid } from 'nanoid';
import { prisma } from '@/server/prisma';
import { hashPassword, verifyPassword } from '@/server/crypto';

export const ShareService = {
  async create(opts: {
    projectId: string;
    permission: 'VIEW' | 'COMMENT' | 'EDIT';
    password?: string;
    ttlDays: 7 | 30 | -1;
    createdById: string;
  }) {
    const token = nanoid(24);
    const expiresAt =
      opts.ttlDays === -1 ? null : new Date(Date.now() + opts.ttlDays * 24 * 3600 * 1000);
    return prisma.shareLink.create({
      data: {
        projectId: opts.projectId,
        token,
        permission: opts.permission,
        passwordHash: opts.password ? hashPassword(opts.password) : null,
        expiresAt,
        createdById: opts.createdById,
      },
    });
  },

  async resolve(token: string, providedPassword?: string) {
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: { project: true },
    });
    if (!link) return null;
    if (link.expiresAt && link.expiresAt < new Date()) return null;
    if (link.passwordHash) {
      if (!providedPassword) return { needsPassword: true as const, link: null };
      if (!verifyPassword(providedPassword, link.passwordHash)) {
        return { needsPassword: true as const, link: null };
      }
    }
    return { needsPassword: false as const, link };
  },
};
