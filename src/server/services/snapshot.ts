import { createHash } from 'node:crypto';
import { prisma } from '@/server/prisma';

const AUTO_THRESHOLD = 50;

interface ProjectSnapshotPayload {
  version: 1;
  project: { name: string; description: string | null; emoji: string | null };
  trees: Array<{ id: string; kind: string; rootId: string | null }>;
  nodes: Array<{
    id: string;
    treeId: string;
    parentId: string | null;
    title: string;
    description: string | null;
    status: string;
    hypothesisStatus: string;
    position: unknown;
    tags: string[];
  }>;
  edges: Array<{ sourceId: string; targetId: string; kind: string; label: string | null }>;
}

async function captureProjectState(projectId: string): Promise<Buffer> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      trees: true,
      nodes: { where: { deletedAt: null } },
      edges: true,
    },
  });
  const payload: ProjectSnapshotPayload = {
    version: 1,
    project: {
      name: project.name,
      description: project.description,
      emoji: project.emoji,
    },
    trees: project.trees.map((t) => ({ id: t.id, kind: t.kind, rootId: t.rootId })),
    nodes: project.nodes.map((n) => ({
      id: n.id,
      treeId: n.treeId,
      parentId: n.parentId,
      title: n.title,
      description: n.description,
      status: n.status,
      hypothesisStatus: n.hypothesisStatus,
      position: n.position,
      tags: n.tags,
    })),
    edges: project.edges.map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      kind: e.kind,
      label: e.label,
    })),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

export const SnapshotService = {
  async takeManual(projectId: string, label: string | undefined, authorId: string) {
    const data = await captureProjectState(projectId);
    return this.persist(projectId, data, label, 'manual', authorId);
  },

  async autoSnapshotIfNeeded(projectId: string) {
    const nodeCount = await prisma.node.count({ where: { projectId, deletedAt: null } });
    if (nodeCount === 0 || nodeCount % AUTO_THRESHOLD !== 0) return null;
    const data = await captureProjectState(projectId);
    return this.persist(projectId, data, undefined, 'auto', null);
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

  async restoreAsBranch(snapshotId: string, userId: string) {
    const snap = await prisma.snapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      include: { project: true },
    });
    const payload = JSON.parse(Buffer.from(snap.yjsState).toString('utf8')) as ProjectSnapshotPayload;

    const branch = await prisma.project.create({
      data: {
        workspaceId: snap.project.workspaceId,
        name: `${snap.project.name} @ ${snap.createdAt.toISOString().slice(0, 16)}`,
        description: payload.project.description,
        emoji: payload.project.emoji,
        createdById: userId,
      },
    });

    const treeMap = new Map<string, string>();
    for (const t of payload.trees) {
      const newTree = await prisma.tree.create({
        data: { projectId: branch.id, kind: t.kind as 'DEV' | 'FUNC' | 'BIZ', rootId: null },
      });
      treeMap.set(t.id, newTree.id);
    }

    const nodeMap = new Map<string, string>();
    const remaining = [...payload.nodes];
    let safety = remaining.length * 2 + 1;
    while (remaining.length && safety-- > 0) {
      for (let i = remaining.length - 1; i >= 0; i--) {
        const n = remaining[i];
        if (n.parentId && !nodeMap.has(n.parentId)) continue;
        const newNode = await prisma.node.create({
          data: {
            projectId: branch.id,
            treeId: treeMap.get(n.treeId)!,
            parentId: n.parentId ? nodeMap.get(n.parentId)! : null,
            title: n.title,
            description: n.description,
            tags: n.tags,
            status: n.status as 'IDEA' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED',
            hypothesisStatus: n.hypothesisStatus as
              | 'NONE'
              | 'UNTESTED'
              | 'TESTING'
              | 'VALIDATED'
              | 'INVALIDATED',
            position: n.position as object,
            origin: { type: 'snapshot_restore' },
          },
        });
        nodeMap.set(n.id, newNode.id);
        remaining.splice(i, 1);
      }
    }

    for (const e of payload.edges) {
      const src = nodeMap.get(e.sourceId);
      const tgt = nodeMap.get(e.targetId);
      if (src && tgt) {
        await prisma.edge.create({
          data: {
            projectId: branch.id,
            sourceId: src,
            targetId: tgt,
            kind: e.kind as 'PARENT_CHILD' | 'RELATES_TO' | 'DEPENDS_ON' | 'BRIDGE',
            label: e.label,
          },
        });
      }
    }

    return branch;
  },
};
