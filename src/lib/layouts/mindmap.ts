/**
 * Mind Map layout engine на базе d3-hierarchy.
 */
import { hierarchy, tree } from 'd3-hierarchy';

export interface LayoutNode {
  id: string;
  title: string;
  treeKind: string;
  x: number;
  y: number;
  parentId: string | null;
  children: LayoutNode[];
}

export interface LayoutEdge {
  sourceId: string;
  targetId: string;
}

interface RawNode {
  id: string;
  title: string;
  parentId: string | null;
  treeKind?: string;
  positionX?: number | null;
  positionY?: number | null;
}

interface RawEdge {
  sourceId: string;
  targetId: string;
}

export function computeMindMapLayout(
  nodes: RawNode[],
  edges: RawEdge[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;

  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string | null>();

  for (const node of nodes) {
    childrenMap.set(node.id, []);
    parentMap.set(node.id, node.parentId);
  }

  for (const edge of edges) {
    const children = childrenMap.get(edge.sourceId);
    if (children && !children.includes(edge.targetId)) {
      children.push(edge.targetId);
    }
    if (!parentMap.get(edge.targetId)) {
      parentMap.set(edge.targetId, edge.sourceId);
    }
  }

  for (const node of nodes) {
    if (node.parentId) {
      const children = childrenMap.get(node.parentId);
      if (children && !children.includes(node.id)) {
        children.push(node.id);
      }
    }
  }

  const allChildIds = new Set<string>();
  for (const [, children] of childrenMap) {
    for (const c of children) allChildIds.add(c);
  }

  const rootIds = nodes
    .filter((n) => !allChildIds.has(n.id) || !parentMap.get(n.id))
    .map((n) => n.id);

  const effectiveRoots = rootIds.length > 0 ? rootIds : [nodes[0]?.id].filter(Boolean);

  const SPACING_X = 180;
  const SPACING_Y = 80;
  let offsetX = 0;

  for (const rootId of effectiveRoots) {
    const hierarchyData = buildHierarchy(rootId, nodes, childrenMap);
    if (!hierarchyData) continue;

    const root = hierarchy(hierarchyData);
    const layout = tree<typeof hierarchyData>()
      .nodeSize([SPACING_X, SPACING_Y])
      .separation(() => 1);

    const laidOut = layout(root);

    laidOut.each((d) => {
      positions.set(d.data.id, {
        x: offsetX + (d.y ?? 0),
        y: d.x ?? 0,
      });
    });

    offsetX += SPACING_Y * 4;
  }

  return positions;
}

interface HierarchyNode {
  id: string;
  title: string;
  children?: HierarchyNode[];
}

function buildHierarchy(
  nodeId: string,
  nodes: RawNode[],
  childrenMap: Map<string, string[]>,
  visited = new Set<string>(),
): HierarchyNode | null {
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const childIds = childrenMap.get(nodeId) ?? [];
  const children = childIds
    .map((cid) => buildHierarchy(cid, nodes, childrenMap, visited))
    .filter(Boolean) as HierarchyNode[];

  return {
    id: node.id,
    title: node.title,
    children: children.length > 0 ? children : undefined,
  };
}
