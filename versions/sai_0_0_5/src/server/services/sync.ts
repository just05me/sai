/**
 * SyncService — синхронизация трёх деревьев (DEV / FUNC / BIZ).
 *
 * Центральная механика Sai: при нажатии «Синхронизировать» анализирует узлы
 * всех трёх деревьев, находит несоответствия и предлагает изменения.
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
  /**
   * Анализирует проект и находит несоответствия между тремя деревьями.
   *
   * Правила синхронизации:
   * 1. Если узел DEV не имеет связанного узла в FUNC — предложить создать.
   * 2. Если узел BIZ не имеет связанного узла в DEV — предложить создать.
   * 3. Если bridge-связи ведут на удалённые узлы — пометить.
   * 4. Если названия связанных узлов расходятся — предупредить.
   */
  static async analyze(projectId: string): Promise<SyncResult> {
    const trees = await prisma.tree.findMany({
      where: { projectId },
      include: {
        nodes: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });

    const devTree = trees.find((t) => t.kind === 'DEV');
    const funcTree = trees.find((t) => t.kind === 'FUNC');
    const bizTree = trees.find((t) => t.kind === 'BIZ');

    const devNodes = devTree?.nodes ?? [];
    const funcNodes = funcTree?.nodes ?? [];
    const bizNodes = bizTree?.nodes ?? [];

    // Все bridge-связи (между деревьями)
    const bridges = await prisma.edge.findMany({
      where: {
        projectId,
        kind: 'BRIDGE',
        source: { deletedAt: null },
        target: { deletedAt: null },
      },
      include: {
        source: { select: { id: true, title: true, treeId: true } },
        target: { select: { id: true, title: true, treeId: true } },
      },
    });

    const issues: SyncIssue[] = [];

    // Правило 1: DEV → FUNC (каждый dev-узел должен иметь функциональный эквивалент)
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

    // Правило 2: BIZ → DEV (каждый biz-узел должен иметь технический эквивалент)
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

    // Правило 3: расхождение названий у bridge-связей
    for (const bridge of bridges) {
      if (bridge.source.title !== bridge.target.title) {
        issues.push({
          kind: 'title_mismatch',
          nodeId: bridge.sourceId,
          nodeTitle: `${bridge.source.title} ↔ ${bridge.target.title}`,
          sourceTree: 'DEV',
          description: `Названия расходятся: «${bridge.source.title}» ↔ «${bridge.target.title}»`,
        });
      }
    }

    // Правило 4: сиротские bridge-связи
    const orphanBridges = bridges.filter(
      (b) => !b.source || !b.target,
    );
    for (const bridge of orphanBridges) {
      issues.push({
        kind: 'orphan_bridge',
        nodeTitle: bridge.source?.title ?? bridge.target?.title ?? '???',
        sourceTree: 'DEV',
        description: 'Bridge-связь ведёт на удалённый узел',
      });
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

  /**
   * Создаёт bridge-связь между существующими узлами.
   */
  static async createBridge(
    projectId: string,
    sourceNodeId: string,
    targetNodeId: string,
    createdById: string,
  ) {
    return prisma.edge.create({
      data: {
        projectId,
        sourceId: sourceNodeId,
        targetId: targetNodeId,
        kind: 'BRIDGE',
        createdById,
      },
    });
  }
}
