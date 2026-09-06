import { createHash } from 'node:crypto';
import { prisma } from '@/server/prisma';

const AUTO_THRESHOLD = 50; // F-306: каждые 50 изменений

export const SnapshotService = {
  async takeManual(projectId: string, label: string | undefined, authorId: string) {
    const yjs = await prisma.yjsDocument.findUnique({ where: { projectId } });
    if (!yjs) throw new Error('no yjs document');
    return this.persist(projectId, yjs.data, label, 'manual', authorId);
  },

  async autoSnapshotIfNeeded(projectId: string) {
    const yjs = await prisma.yjsDocument.findUnique({ where: { projectId } });
    if (!yjs) return null;
    if (yjs.version % AUTO_THRESHOLD !== 0) return null;
    return this.persist(projectId, yjs.data, undefined, 'auto', null);
  },

  async persist(
    projectId: string,
    data: Uint8Array | Buffer,
    label: string | undefined,
    reason: string,
    authorId: string | null,
  ) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const hash = createHash('sha256').update(buf).digest('hex');
    const existing = await prisma.snapshot.findFirst({ where: { projectId, hash } });
    if (existing) return existing;
    return prisma.snapshot.create({
      data: {
        projectId,
        label,
        reason,
        yjsState: buf,
        hash,
        size: buf.length,
        authorId: authorId ?? undefined,
      },
    });
  },

  /**
   * Простейший diff: считаем количество узлов / рёбер до и после.
   * Real diff требует загрузки Y.Doc и применения апдейтов.
   */
  async diff(aId: string, bId: string) {
    const a = await prisma.snapshot.findUnique({ where: { id: aId } });
    const b = await prisma.snapshot.findUnique({ where: { id: bId } });
    if (!a || !b) throw new Error('snapshot not found');
    return {
      a: { id: a.id, size: a.size, hash: a.hash, createdAt: a.createdAt },
      b: { id: b.id, size: b.size, hash: b.hash, createdAt: b.createdAt },
      sizeDelta: b.size - a.size,
    };
  },

  /**
   * F-307: восстановление создаёт новую ветку (новый проект), не перезаписывает.
   */
  async restoreAsBranch(snapshotId: string, userId: string) {
    const snap = await prisma.snapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      include: { project: true },
    });
    const branch = await prisma.project.create({
      data: {
        workspaceId: snap.project.workspaceId,
        name: `${snap.project.name} @ ${snap.createdAt.toISOString().slice(0, 16)}`,
        createdById: userId,
      },
    });
    await prisma.yjsDocument.create({
      data: { projectId: branch.id, data: snap.yjsState },
    });
    await prisma.tree.createMany({
      data: ['DEV', 'FUNC', 'BIZ'].map((k) => ({
        projectId: branch.id,
        kind: k as 'DEV' | 'FUNC' | 'BIZ',
      })),
    });
    return branch;
  },
};
