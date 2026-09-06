/**
 * MutationService — все AI-мутации проходят через generateObject (структурированный output)
 * и НЕ применяются автоматически. Возвращают preview, который пользователь подтверждает.
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import { ProviderManager } from './provider-manager';
import { PROMPTS } from '@/server/ai/prompts';
import { prisma } from '@/server/prisma';

const expandSchema = z.object({
  nodes: z.array(
    z.object({
      title: z.string().min(1).max(120),
      description: z.string().max(300).optional(),
    }),
  ).min(1).max(8),
});

const bridgeSchema = z.object({
  bridges: z.array(
    z.object({
      targetTreeKind: z.enum(['DEV', 'FUNC', 'BIZ']),
      targetTitle: z.string(),
      rationale: z.string(),
    }),
  ).max(5),
});

const refactorSchema = z.object({
  operations: z.array(
    z.discriminatedUnion('op', [
      z.object({ op: z.literal('rename'), nodeId: z.string(), newTitle: z.string() }),
      z.object({ op: z.literal('split'), nodeId: z.string(), into: z.array(z.string()) }),
      z.object({ op: z.literal('merge'), nodeIds: z.array(z.string()), intoTitle: z.string() }),
    ]),
  ),
  rationale: z.string(),
});

const ideaScoreSchema = z.object({
  feasibility: z.number().min(0).max(100),
  marketPotential: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  blindSpots: z.array(z.string()).max(10),
});

/** Узел дерева, который AI создаёт прямо на холсте (propose_tree / build_tree). */
export type TreeSpec = {
  title: string;
  description?: string;
  children?: TreeSpec[];
};

/** Как применить предложенное дерево относительно уже существующих узлов. */
export type TreeMutationMode = 'append' | 'replace_subtree' | 'replace_tree' | 'rewrite_all';

const MAX_TREE_NODES = 60;
// Раскладка сверху-вниз: глубина увеличивает Y (вниз), соседние узлы расходятся по X.
const X_GAP = 280; // горизонтальный шаг между соседними узлами
const Y_GAP = 160; // вертикальный шаг между уровнями

function countTreeNodes(n: TreeSpec): number {
  return 1 + (n.children?.reduce((sum, c) => sum + countTreeNodes(c), 0) ?? 0);
}

async function collectSubtreeIds(projectId: string, rootId: string): Promise<string[]> {
  const ids = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const children = await prisma.node.findMany({
      where: { projectId, parentId: { in: frontier }, deletedAt: null },
      select: { id: true },
    });
    frontier = [];
    for (const c of children) {
      if (!ids.has(c.id)) {
        ids.add(c.id);
        frontier.push(c.id);
      }
    }
  }
  return [...ids];
}

async function softDeleteNodes(nodeIds: string[]): Promise<number> {
  if (!nodeIds.length) return 0;
  const now = new Date();
  const result = await prisma.node.updateMany({
    where: { id: { in: nodeIds }, deletedAt: null },
    data: { deletedAt: now },
  });
  return result.count;
}

/** Проверяем, что узел живой и (опционально) в нужном дереве. */
async function resolveLiveNode(
  nodeId: string | null | undefined,
  projectId: string,
  treeId?: string,
): Promise<string | null> {
  if (!nodeId) return null;
  const node = await prisma.node.findFirst({
    where: { id: nodeId, projectId, deletedAt: null, ...(treeId ? { treeId } : {}) },
    select: { id: true },
  });
  return node?.id ?? null;
}

export const MutationService = {
  async expand(opts: { workspaceId: string; userId: string; nodeId: string }) {
    const node = await prisma.node.findUniqueOrThrow({
      where: { id: opts.nodeId },
      include: { tree: true },
    });
    const provider = await ProviderManager.resolve({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
    });
    const { object } = await generateObject({
      model: provider.client(provider.model),
      schema: expandSchema,
      prompt: PROMPTS.expand(node.title, node.description ?? undefined, node.tree.kind),
    });
    return { preview: object, nodeId: opts.nodeId, treeKind: node.tree.kind };
  },

  async bridgeSuggest(opts: { workspaceId: string; userId: string; nodeId: string }) {
    const node = await prisma.node.findUniqueOrThrow({
      where: { id: opts.nodeId },
      include: { tree: true, project: { include: { trees: true } } },
    });
    const otherTrees = node.project.trees.filter((t) => t.kind !== node.tree.kind);
    const provider = await ProviderManager.resolve({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
    });
    const { object } = await generateObject({
      model: provider.client(provider.model),
      schema: bridgeSchema,
      prompt: PROMPTS.bridgeSuggest(node.title, otherTrees.map((t) => t.kind)),
    });
    return object;
  },

  async refactor(opts: { workspaceId: string; userId: string; nodeIds: string[] }) {
    const nodes = await prisma.node.findMany({
      where: { id: { in: opts.nodeIds } },
      select: { id: true, title: true },
    });
    const provider = await ProviderManager.resolve({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
    });
    const { object } = await generateObject({
      model: provider.client(provider.model),
      schema: refactorSchema,
      prompt: PROMPTS.refactor(nodes.map((n) => n.title)),
    });
    return object;
  },

  async ideaScore(opts: { workspaceId: string; userId: string; projectId: string }) {
    const nodes = await prisma.node.findMany({
      where: { projectId: opts.projectId, deletedAt: null },
      include: { tree: true },
      take: 200,
    });
    const summary = nodes
      .map((n) => `[${n.tree.kind}] ${n.title}${n.description ? ` — ${n.description}` : ''}`)
      .join('\n');
    const provider = await ProviderManager.resolve({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
    });
    const { object } = await generateObject({
      model: provider.client(provider.model),
      schema: ideaScoreSchema,
      prompt: PROMPTS.ideaScore(summary),
    });
    const saved = await prisma.ideaScore.create({
      data: {
        projectId: opts.projectId,
        feasibility: object.feasibility,
        marketPotential: object.marketPotential,
        completeness: object.completeness,
        blindSpots: object.blindSpots,
        details: object,
      },
    });
    return saved;
  },

  /** Считает узлы проекта (для решения — показывать ли диалог подтверждения). */
  async countProjectNodes(projectId: string, treeKind?: 'DEV' | 'FUNC' | 'BIZ') {
    return prisma.node.count({
      where: {
        projectId,
        deletedAt: null,
        ...(treeKind ? { tree: { kind: treeKind } } : {}),
      },
    });
  },

  /**
   * Создаёт дерево узлов прямо в проекте по структуре, которую сгенерировал AI.
   * Раскладывает узлы tidy-layout'ом, создаёт PARENT_CHILD-рёбра.
   * mutationMode управляет тем, удалять ли существующие узлы перед созданием.
   */
  async buildTree(opts: {
    workspaceId: string;
    userId: string;
    projectId: string;
    treeKind: 'DEV' | 'FUNC' | 'BIZ';
    root: TreeSpec;
    parentNodeId?: string | null;
    /** Узел, чьё поддерево заменяем (для replace_subtree). */
    replaceAtNodeId?: string | null;
    mutationMode?: TreeMutationMode;
  }) {
    const total = countTreeNodes(opts.root);
    if (total > MAX_TREE_NODES) {
      throw new Error(`Слишком большое дерево (${total} узлов, максимум ${MAX_TREE_NODES})`);
    }

    const project = await prisma.project.findUnique({
      where: { id: opts.projectId },
      select: { workspaceId: true },
    });
    if (!project || project.workspaceId !== opts.workspaceId) {
      throw new Error('Проект не принадлежит воркспейсу');
    }

    const tree = await prisma.tree.findUniqueOrThrow({
      where: { projectId_kind: { projectId: opts.projectId, kind: opts.treeKind } },
    });

    const mode = opts.mutationMode ?? 'append';
    let deletedCount = 0;
    let treeRootId: string | null = tree.rootId;
    let attachParentId: string | null = opts.parentNodeId ?? null;
    let replaceAnchorId: string | null = opts.replaceAtNodeId ?? null;
    let layoutBase: { x: number; y: number } | null = null;

    // Для append — parent должен существовать и быть в том же дереве.
    if (mode === 'append') {
      attachParentId = await resolveLiveNode(attachParentId, opts.projectId, tree.id);
    } else {
      // Для destructive-режимов не цепляемся к старым id — они могут быть удалены.
      attachParentId = null;
    }

    if (mode === 'rewrite_all') {
      const all = await prisma.node.findMany({
        where: { projectId: opts.projectId, deletedAt: null },
        select: { id: true },
      });
      deletedCount = await softDeleteNodes(all.map((n) => n.id));
      await prisma.tree.updateMany({
        where: { projectId: opts.projectId },
        data: { rootId: null },
      });
      attachParentId = null;
      treeRootId = null;
    } else if (mode === 'replace_tree') {
      const inTree = await prisma.node.findMany({
        where: { projectId: opts.projectId, treeId: tree.id, deletedAt: null },
        select: { id: true },
      });
      deletedCount = await softDeleteNodes(inTree.map((n) => n.id));
      await prisma.tree.update({ where: { id: tree.id }, data: { rootId: null } });
      attachParentId = null;
      treeRootId = null;
    } else if (mode === 'replace_subtree') {
      replaceAnchorId = await resolveLiveNode(
        replaceAnchorId ?? attachParentId ?? treeRootId,
        opts.projectId,
        tree.id,
      );
      const anchor = replaceAnchorId;
      if (anchor) {
        const anchorNode = await prisma.node.findUnique({
          where: { id: anchor },
          select: { parentId: true, projectId: true, position: true },
        });
        if (anchorNode && anchorNode.projectId === opts.projectId) {
          attachParentId = anchorNode.parentId;
          const pos = (anchorNode.position as { x?: number; y?: number } | null) ?? {};
          layoutBase = { x: pos.x ?? 0, y: pos.y ?? 0 };
        }
        const subtree = await collectSubtreeIds(opts.projectId, anchor);
        deletedCount = await softDeleteNodes(subtree);
        if (treeRootId && subtree.includes(treeRootId)) {
          await prisma.tree.update({ where: { id: tree.id }, data: { rootId: null } });
          treeRootId = null;
        }
      }
    }

    let baseX = 0;
    let baseY = 0;
    const parentId = attachParentId;
    if (layoutBase) {
      baseX = layoutBase.x;
      baseY = layoutBase.y;
    } else if (parentId) {
      const parent = await prisma.node.findUnique({
        where: { id: parentId },
        select: { projectId: true, position: true },
      });
      if (!parent || parent.projectId !== opts.projectId) {
        throw new Error('Родительский узел не в этом проекте');
      }
      const pos = (parent.position as { x?: number; y?: number } | null) ?? {};
      baseX = pos.x ?? 0;
      baseY = (pos.y ?? 0) + Y_GAP;
    }

    // Tidy-layout сверху-вниз: y — по глубине, x — лист увеличивает курсор, родитель центрируется по детям.
    const posMap = new Map<TreeSpec, { x: number; y: number }>();
    let leafCursor = 0;
    const layout = (n: TreeSpec, depth: number): number => {
      const y = baseY + depth * Y_GAP;
      let x: number;
      if (!n.children || n.children.length === 0) {
        x = baseX + leafCursor * X_GAP;
        leafCursor += 1;
      } else {
        const xs = n.children.map((c) => layout(c, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      posMap.set(n, { x, y });
      return x;
    };
    layout(opts.root, 0);

    let created = 0;
    const createRec = async (n: TreeSpec, parent: string | null): Promise<string> => {
      const node = await prisma.node.create({
        data: {
          projectId: opts.projectId,
          treeId: tree.id,
          parentId: parent,
          title: n.title.slice(0, 200),
          description: n.description?.slice(0, 2000),
          position: posMap.get(n) ?? { x: 0, y: 0 },
          origin: { type: 'ai_generate', created_at: new Date().toISOString() },
        },
      });
      created += 1;
      if (parent) {
        await prisma.edge.create({
          data: {
            projectId: opts.projectId,
            sourceId: parent,
            targetId: node.id,
            kind: 'PARENT_CHILD',
          },
        });
      }
      for (const child of n.children ?? []) await createRec(child, node.id);
      return node.id;
    };

    const rootId = await createRec(opts.root, parentId);
    if (!parentId && !treeRootId) {
      await prisma.tree.update({ where: { id: tree.id }, data: { rootId } });
    }

    return { count: created, deletedCount, rootId, treeKind: opts.treeKind, mutationMode: mode };
  },
};
