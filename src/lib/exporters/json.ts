import type { Edge, Node, Project, Tree } from '@prisma/client';

/**
 * Совместим с импортом обратно (round-trip). Версия схемы — для миграций.
 */
export function exportJSON(project: Project, trees: Tree[], nodes: Node[], edges: Edge[]): string {
  return JSON.stringify(
    {
      $schema: 'https://sai.app/schemas/project/1.json',
      version: '1.0',
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        emoji: project.emoji,
        createdAt: project.createdAt,
      },
      trees: trees.map((t) => ({ kind: t.kind, rootId: t.rootId })),
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        treeKind: trees.find((t) => t.id === n.treeId)?.kind,
        parentId: n.parentId,
        status: n.status,
        tags: n.tags,
        position: n.position,
        hypothesisStatus: n.hypothesisStatus,
        origin: n.origin,
      })),
      edges: edges.map((e) => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        kind: e.kind,
        label: e.label,
      })),
    },
    null,
    2,
  );
}
