import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '@/server/services/sync';

const mockFindMany = vi.fn();
const mockEdgeFindMany = vi.fn();
const mockNodeFindMany = vi.fn();
const mockEdgeCreate = vi.fn();

vi.mock('@/server/prisma', () => ({
  prisma: {
    tree: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    node: { findMany: (...args: unknown[]) => mockNodeFindMany(...args) },
    edge: {
      findMany: (...args: unknown[]) => mockEdgeFindMany(...args),
      create: (...args: unknown[]) => mockEdgeCreate(...args),
    },
  },
}));

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('analyze находит DEV-узел без bridge в FUNC', async () => {
    mockFindMany.mockResolvedValue([
      {
        kind: 'DEV',
        nodes: [{ id: 'dev-1', title: 'API', order: 0, deletedAt: null }],
      },
      {
        kind: 'FUNC',
        nodes: [{ id: 'func-1', title: 'Auth', order: 0, deletedAt: null }],
      },
      { kind: 'BIZ', nodes: [] },
    ]);
    mockEdgeFindMany.mockResolvedValue([]);
    mockNodeFindMany.mockResolvedValue([]);

    const result = await SyncService.analyze('proj-1');
    expect(result.summary.devCount).toBe(1);
    expect(result.summary.funcCount).toBe(1);
    expect(result.issues.some((i) => i.kind === 'missing_in_tree' && i.sourceTree === 'DEV')).toBe(
      true,
    );
  });

  it('analyze сообщает title_mismatch для bridge с разными названиями', async () => {
    mockFindMany.mockResolvedValue([
      { kind: 'DEV', nodes: [{ id: 'd1', title: 'Alpha', order: 0 }] },
      { kind: 'FUNC', nodes: [{ id: 'f1', title: 'Beta', order: 0 }] },
      { kind: 'BIZ', nodes: [] },
    ]);
    mockEdgeFindMany.mockResolvedValue([
      {
        sourceId: 'd1',
        targetId: 'f1',
        source: { id: 'd1', title: 'Alpha', treeId: 't-dev' },
        target: { id: 'f1', title: 'Beta', treeId: 't-func' },
      },
    ]);
    mockNodeFindMany.mockResolvedValue([
      { id: 'd1', title: 'Alpha', treeId: 't-dev' },
      { id: 'f1', title: 'Beta', treeId: 't-func' },
    ]);

    const result = await SyncService.analyze('proj-1');
    expect(result.issues.some((i) => i.kind === 'title_mismatch')).toBe(true);
  });

  it('createBridge создаёт BRIDGE-связь', async () => {
    mockEdgeCreate.mockResolvedValue({ id: 'edge-1', kind: 'BRIDGE' });

    const edge = await SyncService.createBridge('proj-1', 'src', 'tgt');

    expect(mockEdgeCreate).toHaveBeenCalledWith({
      data: {
        projectId: 'proj-1',
        sourceId: 'src',
        targetId: 'tgt',
        kind: 'BRIDGE',
      },
    });
    expect(edge.kind).toBe('BRIDGE');
  });
});
