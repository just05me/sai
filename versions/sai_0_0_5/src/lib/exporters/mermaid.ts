import type { Edge, Node, Project, Tree, TreeKind } from '@prisma/client';

const TREE_LABEL: Record<TreeKind, string> = {
  DEV: 'Development',
  FUNC: 'Features',
  BIZ: 'Business',
};

/**
 * Три отдельных flowchart внутри subgraph, плюс CrossTreeEdge как BRIDGE с -.-> стрелками.
 * F-404.
 */
export function exportMermaid(
  project: Project,
  trees: Tree[],
  nodes: Node[],
  edges: Edge[],
): string {
  const lines: string[] = [`%% ${project.name} — экспорт Sai`, 'flowchart TD'];
  const nodeIdToTree: Record<string, TreeKind> = {};
  for (const n of nodes) {
    const tk = trees.find((t) => t.id === n.treeId)?.kind;
    if (tk) nodeIdToTree[n.id] = tk;
  }
  for (const tree of trees) {
    const treeNodes = nodes.filter((n) => n.treeId === tree.id);
    if (!treeNodes.length) continue;
    lines.push(`  subgraph ${tree.kind}[${TREE_LABEL[tree.kind]}]`);
    for (const n of treeNodes) {
      lines.push(`    ${esc(n.id)}["${escTitle(n.title)}"]`);
    }
    lines.push('  end');
  }
  for (const e of edges) {
    const fromTree = nodeIdToTree[e.sourceId];
    const toTree = nodeIdToTree[e.targetId];
    const isBridge = fromTree && toTree && fromTree !== toTree;
    // Mermaid syntax: A -->|label| B  /  A -.->|label| B
    const arrow = isBridge
      ? e.label
        ? `-.->|${escLabel(e.label)}|`
        : '-.->'
      : e.label
        ? `-->|${escLabel(e.label)}|`
        : '-->';
    lines.push(`  ${esc(e.sourceId)} ${arrow} ${esc(e.targetId)}`);
  }
  return lines.join('\n');
}

function esc(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}
function escTitle(t: string) {
  return t.replace(/"/g, "'").slice(0, 80);
}
function escLabel(l: string) {
  return l.replace(/[|\n\r]/g, ' ').slice(0, 60);
}
