import { describe, it, expect, vi } from 'vitest';
import type { Node, Project, Tree } from '@prisma/client';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  StyleSheet: { create: (s: unknown) => s },
  renderToBuffer: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));

function makeProject(): Project {
  return {
    id: 'p1',
    name: 'PDF Test',
    emoji: '📄',
    description: 'Desc',
    workspaceId: 'ws',
    settings: {},
    createdById: 'u1',
    publicSlug: null,
    archivedAt: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('PDF Export', () => {
  it('генерирует PDF buffer для проекта с узлами', async () => {
    const { exportPdf } = await import('@/lib/exporters/pdf');
    const project = makeProject();
    const trees: Tree[] = [
      {
        id: 't1',
        projectId: 'p1',
        kind: 'DEV',
        rootId: null,
        createdAt: new Date(),
      },
    ];
    const nodes: Node[] = [
      {
        id: 'n1',
        projectId: 'p1',
        treeId: 't1',
        parentId: null,
        title: 'Root',
        description: 'Node desc',
        tags: [],
        status: 'IDEA',
        position: { x: 0, y: 0 },
        hypothesisStatus: 'NONE',
        healthScore: 0,
        origin: {},
        decisionLog: [],
        collapsed: false,
        assigneeId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const buf = await exportPdf(project, trees, nodes, 'human', []);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x25);
    expect(String.fromCharCode(buf[0], buf[1], buf[2], buf[3])).toBe('%PDF');
  });
});
