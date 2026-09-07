/**
 * ExportService — единая точка для всех форматов (F-400…F-410).
 * PNG/SVG генерится на клиенте. PDF — @react-pdf/renderer на сервере.
 */
import { prisma } from '@/server/prisma';
import { exportMarkdown } from '@/lib/exporters/markdown';
import { exportText } from '@/lib/exporters/text';
import { exportJSON } from '@/lib/exporters/json';
import { exportMermaid } from '@/lib/exporters/mermaid';
import { exportPdf } from '@/lib/exporters/pdf';
import type { ExportAudience } from '@/lib/exporters/spec';

export type ExportFormat = 'md' | 'txt' | 'pdf' | 'json' | 'mermaid';
export type { ExportAudience } from '@/lib/exporters/spec';

export type ExportResult = {
  contentType: string;
  body: string | Buffer;
  disposition: 'attachment' | 'inline';
  ext: string;
};

export const ExportService = {
  async build(
    projectId: string,
    format: ExportFormat,
    opts: { trees?: ('DEV' | 'FUNC' | 'BIZ')[]; audience?: ExportAudience } = {},
  ): Promise<ExportResult> {
    const audience: ExportAudience = opts.audience ?? 'human';
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        trees: true,
        nodes: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        edges: true,
      },
    });

    const filteredTrees = opts.trees
      ? project.trees.filter((t) => opts.trees!.includes(t.kind))
      : project.trees;
    const allowedTreeIds = new Set(filteredTrees.map((t) => t.id));
    const nodes = project.nodes.filter((n) => allowedTreeIds.has(n.treeId));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = project.edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

    switch (format) {
      case 'md':
        return {
          contentType: 'text/markdown; charset=utf-8',
          body: exportMarkdown(project, filteredTrees, nodes, audience, edges),
          disposition: 'attachment',
          ext: 'md',
        };
      case 'txt':
        return {
          contentType: 'text/plain; charset=utf-8',
          body: exportText(project, filteredTrees, nodes, audience, edges),
          disposition: 'attachment',
          ext: 'txt',
        };
      case 'pdf':
        return {
          contentType: 'application/pdf',
          body: await exportPdf(project, filteredTrees, nodes, audience, edges),
          disposition: 'attachment',
          ext: 'pdf',
        };
      case 'json':
        return {
          contentType: 'application/json',
          body: exportJSON(project, filteredTrees, nodes, edges),
          disposition: 'attachment',
          ext: 'json',
        };
      case 'mermaid':
        return {
          contentType: 'text/plain; charset=utf-8',
          body: exportMermaid(project, filteredTrees, nodes, edges),
          disposition: 'attachment',
          ext: 'mmd',
        };
      default: {
        const _exhaustive: never = format;
        throw new Error(`Unsupported format: ${_exhaustive}`);
      }
    }
  },
};
