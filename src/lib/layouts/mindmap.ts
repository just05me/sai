/**
 * Mind Map layout engine на базе d3-hierarchy.
 *
 * Преобразует плоский список узлов и рёбер в иерархическую структуру
 * и вычисляет координаты для mindmap-отображения (дерево сверху вниз).
 */
import { hierarchy, tree } from 'd3-hierarchy';
import type { TreeKind } from '@/lib/utils';

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

/**
 * Вычисляет позиции узлов для mindmap-отображения (иерархическое дерево).
 *
 * Возвращает Map<nodeId, {x, y}> с новыми позициями.
 * Узлы без parent становятся корневыми и размещаются слева направо.
 */
export function computeMindMapLayout(
  nodes: RawNode[],
  edges: RawEdge[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;

  // Строим карту children: parentId → childIds
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
    // Также учитываем parentId из модели
    if (!parentMap.get(edge.targetId)) {
      parentMap.set(edge.targetId, edge.sourceId);
    }
  }

  // Также добавляем parent-child связи из parentId
  for (const node of nodes) {
    if (node.parentId) {
      const children = childrenMap.get(node.parentId);
      if (children && !children.includes(node.id)) {
        children.push(node.id);
      }
    }
  }

  // Находим корневые узлы (без родителя в данном дереве)
  const allChildIds = new Set<string>();
  for (const [, children] of childrenMap) {
    for (const c of children) allChildIds.add(c);
  }

  const rootIds = nodes
    .filter((n) => !allChildIds.has(n.id) || !parentMap.get(n.id))
    .map((n) => n.id);

  // Если нет корневых — берём первый узел как корень
  const effectiveRoots =
    rootIds.length > 0 ? rootIds : [nodes[0]?.id].filter(Boolean);

  // Для каждого корневого дерева вычисляем позиции d3-деревом
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

    // Извлекаем координаты
    const extractPositions = (node: { data: typeof hierarchyData; x: number; y: number }) => {
      positions.set(node.data.id, {
        x: offsetX + node.x,
        y: node.y,
      });
      if (node.data.children) {
        for (const child of node.data.children as typeof hierarchyData[]) {
          extractPositions({
            data: child,
            x: (node as { x: number }).x + (child as unknown as { _x?: number })._x! || 0,
            y: (node as { y: number }).y + (child as unknown as { _y?: number })._y! || 0,
          } as { data: typeof hierarchyData; x: number; y: number });
        }
      }
    };

    // Рекурсивно собираем позиции из d3-дерева
    laidOut.each((d) => {
      positions.set(d.data.id, {
        x: offsetX + (d.y ?? 0),
        y: d.x ?? 0,
      });
    });

    offsetX += (SPACING_Y * 4);
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
