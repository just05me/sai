/**
 * MindMapService — генерация skeleton проекта из идеи / файла / URL.
 * F-217 + F-218 + Quick Capture (F-127).
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import { ProviderManager } from './provider-manager';
import { PROMPTS } from '@/server/ai/prompts';
import { prisma } from '@/server/prisma';

const skeletonSchema = z.object({
  trees: z.array(
    z.object({
      kind: z.enum(['DEV', 'FUNC', 'BIZ']),
      root: z.object({ title: z.string(), description: z.string().optional() }),
      children: z.array(
        z.object({ title: z.string(), description: z.string().optional() }),
      ).min(2).max(5),
    }),
  ).length(3),
});

export type MindMapSkeleton = z.infer<typeof skeletonSchema>;

export const MindMapService = {
  async generateFromIdea(opts: {
    workspaceId: string;
    userId: string;
    idea: string;
  }): Promise<MindMapSkeleton> {
    const provider = await ProviderManager.resolve({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
    });
    const { object } = await generateObject({
      model: provider.client(provider.model),
      schema: skeletonSchema,
      prompt: PROMPTS.quickCapture(opts.idea),
    });
    return object;
  },

  /**
   * Применяет skeleton к проекту, создавая узлы и рёбра parent-child.
   */
  async applySkeleton(projectId: string, skeleton: MindMapSkeleton) {
    const trees = await prisma.tree.findMany({ where: { projectId } });
    const created: Record<string, string> = {};
    for (const tree of skeleton.trees) {
      const dbTree = trees.find((t) => t.kind === tree.kind);
      if (!dbTree) continue;
      const root = await prisma.node.create({
        data: {
          projectId,
          treeId: dbTree.id,
          title: tree.root.title,
          description: tree.root.description,
          position: { x: 0, y: 0 },
          origin: { type: 'ai_generate', created_at: new Date().toISOString() },
        },
      });
      await prisma.tree.update({ where: { id: dbTree.id }, data: { rootId: root.id } });
      created[`${tree.kind}-root`] = root.id;
      for (const [i, child] of tree.children.entries()) {
        const cn = await prisma.node.create({
          data: {
            projectId,
            treeId: dbTree.id,
            parentId: root.id,
            title: child.title,
            description: child.description,
            position: { x: (i - tree.children.length / 2) * 220, y: 150 },
            origin: { type: 'ai_generate', created_at: new Date().toISOString() },
          },
        });
        await prisma.edge.create({
          data: { projectId, sourceId: root.id, targetId: cn.id, kind: 'PARENT_CHILD' },
        });
      }
    }
    return created;
  },
};
