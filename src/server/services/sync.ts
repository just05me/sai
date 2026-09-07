/**
 * SyncService — синхронизация трёх деревьев (DEV / FUNC / BIZ).
 */
import { prisma } from '@/server/prisma';
import { TreeKind } from '@prisma/client';

export interface SyncIssue {
  kind: 'missing_in_tree' | 'title_mismatch' | 'orphan_bridge';
  nodeId?: string;
  nodeTitle: string;
  sourceTree: TreeKind;
  targetTree?: TreeKind;
  description: string;
}

export interface SyncResult {
  issues: SyncIssue[];
  summary: {
    totalNodes: number;
    devCount: number;
    funcCount: number;
    bizCount: number;
    bridgeCount: number;
  };
}

export class SyncService {
  static async analyze(projectId: string): Promise<SyncResult> {
    const trees = await prisma.tree.findMany({
      where: { projectId },
      include: {
        nodes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const devTree = trees.find((t) => t.kind === 'DEV');
    const funcTree = trees.find((t) => t.kind === 'FUNC');
    const bizTree = trees.find((t) => t.kind === 'BIZ');

    const devNodes = devTree?.nodes ?? [];
    const funcNodes = funcTree?.nodes ?? [];
    const bizNodes = bizTree?.nodes ?? [];

    const bridges = await prisma.edge.findMany({
      where: { projectId, kind: 'BRIDGE' },
    });

    const bridgeNodeIds = [...new Set(bridges.flatMap((b) => [b.sourceId, b.targetId]))];
    const bridgeNodes = await prisma.node.findMany({
      where: { id: { in: bridgeNodeIds }, deletedAt: null },
      select: { id: true, title: true, treeId: true },
    });
    const nodeById = new Map(bridgeNodes.map((n) => [n.id, n]));

    const issues: SyncIssue[] = [];

    for (const devNode of devNodes) {
      const hasFuncBridge = bridges.some(
        (b) =>
          b.sourceId === devNode.id && funcNodes.some((fn) => fn.id === b.targetId),
      );
      if (!hasFuncBridge && funcNodes.length > 0) {
        issues.push({
          kind: 'missing_in_tree',
          nodeId: devNode.id,
          nodeTitle: devNode.title,
          sourceTree: 'DEV',
          targetTree: 'FUNC',
          description: `«${devNode.title}» (DEV) не имеет связанного узла в FUNC`,
        });
      }
    }

    for (const bizNode of bizNodes) {
      const hasDevBridge = bridges.some(
        (b) =>
          b.sourceId === bizNode.id && devNodes.some((dn) => dn.id === b.targetId),
      );
      if (!hasDevBridge && devNodes.length > 0) {
        issues.push({
          kind: 'missing_in_tree',
          nodeId: bizNode.id,
          nodeTitle: bizNode.title,
          sourceTree: 'BIZ',
          targetTree: 'DEV',
          description: `«${bizNode.title}» (BIZ) не имеет связанного узла в DEV`,
        });
      }
    }

    for (const bridge of bridges) {
      const source = nodeById.get(bridge.sourceId);
      const target = nodeById.get(bridge.targetId);
      if (!source || !target) {
        issues.push({
          kind: 'orphan_bridge',
          nodeTitle: source?.title ?? target?.title ?? '???',
          sourceTree: 'DEV',
          description: 'Bridge-связь ведёт на удалённый узел',
        });
        continue;
      }
      if (source.title !== target.title) {
        issues.push({
          kind: 'title_mismatch',
          nodeId: bridge.sourceId,
          nodeTitle: `${source.title} ↔ ${target.title}`,
          sourceTree: 'DEV',
          description: `Названия расходятся: «${source.title}» ↔ «${target.title}»`,
        });
      }
    }

    return {
      issues,
      summary: {
        totalNodes: devNodes.length + funcNodes.length + bizNodes.length,
        devCount: devNodes.length,
        funcCount: funcNodes.length,
        bizCount: bizNodes.length,
        bridgeCount: bridges.length,
      },
    };
  }

  static async createBridge(projectId: string, sourceNodeId: string, targetNodeId: string) {
    return prisma.edge.create({
      data: {
        projectId,
        sourceId: sourceNodeId,
        targetId: targetNodeId,
        kind: 'BRIDGE',
      },
    });
  }
}
