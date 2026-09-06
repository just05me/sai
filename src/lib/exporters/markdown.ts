import type { Edge, Node, Project, Tree } from '@prisma/client';
import { buildSpecMarkdown, type ExportAudience, type SpecBuildOptions } from './spec';

export function exportMarkdown(
  project: Project,
  trees: Tree[],
  nodes: Node[],
  audience: ExportAudience = 'human',
  edges: Edge[] = [],
): string {
  const opts: SpecBuildOptions = { audience, edges };
  return buildSpecMarkdown(project, trees, nodes, opts);
}
