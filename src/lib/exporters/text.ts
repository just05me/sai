import type { Edge, Node, Project, Tree } from '@prisma/client';
import { buildSpecMarkdown, markdownToPlainText, type ExportAudience } from './spec';

export function exportText(
  project: Project,
  trees: Tree[],
  nodes: Node[],
  audience: ExportAudience = 'human',
  edges: Edge[] = [],
): string {
  return markdownToPlainText(buildSpecMarkdown(project, trees, nodes, { audience, edges }));
}
