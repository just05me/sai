'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import type { Edge as DbEdge } from '@prisma/client';
import { TREE_META, type TreeKey } from '@/lib/utils';
import { useCanvasStore } from '@/lib/store';
import { NodeCard, type SaiNodeData } from './node-card';
import { trpc } from '@/trpc-client';
import { Button } from '@/components/ui/button';
import {
  CornerDownRight,
  Crosshair,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

type ContextMenu = { clientX: number; clientY: number; flowX: number; flowY: number } | null;

/** Тип Node + treeKind поле, которое отдаёт sliced query. */
export type DbNodeWithTree = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: 'IDEA' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  hypothesisStatus: 'NONE' | 'UNTESTED' | 'TESTING' | 'VALIDATED' | 'INVALIDATED';
  healthScore: number;
  position: { x: number; y: number };
  treeKind: TreeKey;
};

interface CanvasProps {
  workspaceId: string;
  projectId: string;
  activeTree: TreeKey;
  dbNodes: DbNodeWithTree[];
  dbEdges: DbEdge[];
  onSelect: (nodeId: string | null) => void;
}

const nodeTypes = { sai: NodeCard };

function CanvasInner({ workspaceId, projectId, activeTree, dbNodes, dbEdges, onSelect }: CanvasProps) {
  const { focusedNodeId, showMinimap, selectedNodeIds, setFocused, setActiveTree, setSelection } =
    useCanvasStore();
  const utils = trpc.useUtils();
  const reactFlow = useReactFlow();

  const invalidateGraph = useCallback(() => {
    void utils.nodes.byProject.invalidate({ workspaceId, projectId });
    void utils.edges.byProject.invalidate({ workspaceId, projectId });
  }, [utils, workspaceId, projectId]);

  const updateNode = trpc.nodes.update.useMutation();
  const deleteNode = trpc.nodes.delete.useMutation({
    onSuccess: invalidateGraph,
  });
  const createEdge = trpc.edges.create.useMutation({
    onSuccess: invalidateGraph,
    onError: () => toast.error('Не удалось создать связь'),
  });
  const deleteEdge = trpc.edges.delete.useMutation({
    onSuccess: () => utils.edges.byProject.invalidate({ workspaceId, projectId }),
  });
  const createNodeMutation = trpc.nodes.create.useMutation({
    onSuccess: invalidateGraph,
  });
  const bulkInsert = trpc.nodes.bulkInsert.useMutation({
    onSuccess: invalidateGraph,
  });

  const treeNodes = useMemo(() => dbNodes.filter((n) => n.treeKind === activeTree), [dbNodes, activeTree]);
  const treeEdges = useMemo(() => {
    const ids = new Set(treeNodes.map((n) => n.id));
    return dbEdges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
  }, [dbEdges, treeNodes]);
  const crossEdges = useMemo(() => {
    const idsByTree = new Map<string, TreeKey>();
    for (const n of dbNodes) idsByTree.set(n.id, n.treeKind);
    return dbEdges.filter((e) => {
      const a = idsByTree.get(e.sourceId);
      const b = idsByTree.get(e.targetId);
      return a && b && a !== b && (a === activeTree || b === activeTree);
    });
  }, [dbEdges, dbNodes, activeTree]);

  const rfNodes: Node<SaiNodeData>[] = useMemo(() => {
    const positioned = treeNodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      position: n.position ?? { x: 0, y: 0 },
    }));
    const byId = new Map(treeNodes.map((n) => [n.id, n] as const));
    return positioned.map((p) => {
      const n = byId.get(p.id)!;
      return {
        id: n.id,
        type: 'sai',
        position: p.position,
        data: {
          title: n.title,
          description: n.description,
          status: n.status,
          treeKind: n.treeKind,
          hypothesisStatus: n.hypothesisStatus,
          healthScore: n.healthScore,
          isFocused: focusedNodeId === n.id,
        },
      };
    });
  }, [treeNodes, focusedNodeId]);

  const rfEdges: Edge[] = useMemo(() => {
    const treeKindById = new Map(dbNodes.map((n) => [n.id, n.treeKind] as const));
    return [
      ...treeEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: 'default',
        animated: e.kind === 'DEPENDS_ON',
      })),
      ...crossEdges.map((e) => {
        const srcTree = treeKindById.get(e.sourceId) ?? activeTree;
        return {
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          className: 'bridge',
          animated: true,
          style: { stroke: TREE_META[srcTree].color, strokeDasharray: '6 4' },
        };
      }),
    ];
  }, [treeEdges, crossEdges, dbNodes, activeTree]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SaiNodeData>>(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(rfEdges);

  // Помечаем next-обновление как «пришло с сервера» — handleNodesChange это увидит
  // и НЕ пошлёт пачку updateNode.mutate обратно (иначе будет цикл).
  const skipNextProgrammaticRef = useRef(false);
  useEffect(() => {
    skipNextProgrammaticRef.current = true;
    setNodes(rfNodes);
  }, [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  // При смене активного дерева подгоняем вид, иначе новое дерево может оказаться
  // за кадром и кажется, что «ничего не произошло».
  useEffect(() => {
    const t = setTimeout(() => reactFlow.fitView({ duration: 400, padding: 0.2 }), 80);
    return () => clearTimeout(t);
  }, [activeTree, reactFlow]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<SaiNodeData>>[]) => {
      onNodesChange(changes);
      if (skipNextProgrammaticRef.current) {
        skipNextProgrammaticRef.current = false;
        return;
      }
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateNode.mutate({ workspaceId, id: change.id, position: change.position });
        }
      }
    },
    [onNodesChange, updateNode, workspaceId],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) deleteEdge.mutate({ workspaceId, id: e.id });
    },
    [deleteEdge, workspaceId],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenu>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ id: string; clientX: number; clientY: number } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{ id: string; clientX: number; clientY: number } | null>(null);

  // Зеркалим мультивыделение React Flow в Zustand-стор, чтобы остальной UI
  // (например групповые действия) видел, какие узлы выбраны рамкой.
  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const ids = selected.map((n) => n.id);
      setSelection(ids);
      setSelectedId(ids[0] ?? null);
    },
    [setSelection],
  );

  // Delete/Backspace по выделенным нодам — React Flow отдаёт их сюда пачкой.
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const n of deleted) deleteNode.mutate({ workspaceId, id: n.id });
    },
    [deleteNode, workspaceId],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      createEdge.mutate({
        workspaceId,
        projectId,
        sourceId: conn.source,
        targetId: conn.target,
        kind: 'RELATES_TO',
      });
    },
    [createEdge, workspaceId, projectId],
  );

  const removeEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      deleteEdge.mutate({ workspaceId, id });
      setEdgeMenu(null);
    },
    [setEdges, deleteEdge, workspaceId],
  );

  useEffect(() => {
    if (!ctxMenu && !edgeMenu && !nodeMenu) return;
    const close = () => {
      setCtxMenu(null);
      setEdgeMenu(null);
      setNodeMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', close);
    };
  }, [ctxMenu, edgeMenu, nodeMenu]);

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const pos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCtxMenu({ clientX: e.clientX, clientY: e.clientY, flowX: pos.x, flowY: pos.y });
    },
    [reactFlow],
  );

  const createAtCursor = useCallback(() => {
    if (!ctxMenu) return;
    createNodeMutation.mutate({
      workspaceId,
      projectId,
      treeKind: activeTree,
      parentId: null,
      title: 'Новый узел',
      position: { x: ctxMenu.flowX, y: ctxMenu.flowY },
      origin: { type: 'manual' },
    });
    setCtxMenu(null);
  }, [ctxMenu, createNodeMutation, workspaceId, projectId, activeTree]);

  // Сервер сам создаёт PARENT_CHILD-ребро при create с parentId (см. nodes.create).
  const createChild = useCallback(
    (parentId: string) => {
      const parent = dbNodes.find((n) => n.id === parentId);
      if (!parent) return;
      createNodeMutation.mutate({
        workspaceId,
        projectId,
        treeKind: activeTree,
        parentId,
        title: 'Новый узел',
        position: { x: parent.position.x + 220, y: parent.position.y + 80 },
        origin: { type: 'manual' },
      });
    },
    [dbNodes, createNodeMutation, workspaceId, projectId, activeTree],
  );

  const deleteNodes = useCallback(
    (ids: string[]) => {
      for (const id of ids) deleteNode.mutate({ workspaceId, id });
    },
    [deleteNode, workspaceId],
  );

  // Переиспользуется хоткеем `e` и пунктом меню «Развернуть».
  const runExpand = useCallback(
    async (nodeId: string) => {
      const r = await fetch('/api/ai/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'expand', workspaceId, nodeId }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.message ?? 'Expand не удался');
        return;
      }
      const { preview } = await r.json();
      const parent = dbNodes.find((n) => n.id === nodeId);
      const basePos = parent?.position ?? { x: 0, y: 0 };
      toast.success(`AI предлагает ${preview.nodes.length} узлов`, {
        action: {
          label: 'Принять все',
          onClick: () => {
            bulkInsert.mutate({
              workspaceId,
              projectId,
              nodes: preview.nodes.map((p: { title: string; description?: string }, i: number) => ({
                treeKind: activeTree,
                parentId: nodeId,
                title: p.title,
                description: p.description,
                position: { x: basePos.x + (i - preview.nodes.length / 2) * 220, y: basePos.y + 160 },
              })),
            });
          },
        },
      });
    },
    [workspaceId, projectId, activeTree, dbNodes, bulkInsert],
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      setCtxMenu(null);
      setEdgeMenu(null);
      setSelectedId(node.id);
      // ПКМ по узлу ВНУТРИ мультивыделения — сохраняем группу (меню действует на всех).
      // ПКМ по узлу ВНЕ выделения — схлопываем выделение до него одного, чтобы
      // «Удалить выделенные (N)» не относилось к чужой группе.
      if (!selectedNodeIds.has(node.id)) {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
        setSelection([node.id]);
      }
      setNodeMenu({ id: node.id, clientX: e.clientX, clientY: e.clientY });
    },
    [selectedNodeIds, setNodes, setSelection],
  );

  useHotkeys('f', () => {
    if (focusedNodeId) setFocused(null);
    else reactFlow.fitView({ duration: 400, padding: 0.2 });
  });
  useHotkeys('0', () => reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 }));
  useHotkeys('1', () => setActiveTree('DEV'));
  useHotkeys('2', () => setActiveTree('FUNC'));
  useHotkeys('3', () => setActiveTree('BIZ'));

  useHotkeys('tab', (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const parent = dbNodes.find((n) => n.id === selectedId);
    if (!parent) return;
    createNodeMutation.mutate({
      workspaceId,
      projectId,
      treeKind: activeTree,
      parentId: parent.id,
      title: 'Новый узел',
      position: { x: parent.position.x + 220, y: parent.position.y + 80 },
      origin: { type: 'manual' },
    });
  }, { enableOnFormTags: false });

  useHotkeys(
    'e',
    () => {
      if (!selectedId) return toast.info('Выбери узел перед Expand');
      void runExpand(selectedId);
    },
    // react-hotkeys-hook v4: (keys, cb, options?, deps?). Третий аргумент — options.
    undefined,
    [selectedId, runExpand],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgesDelete={onEdgesDelete}
      onNodesDelete={onNodesDelete}
      onConnect={onConnect}
      onSelectionChange={onSelectionChange}
      deleteKeyCode={['Backspace', 'Delete']}
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      // Только средняя кнопка панорамирует. Правую (button 2) НЕ включаем в
      // panOnDrag, иначе React Flow перехватывает ПКМ под панорамирование и
      // contextmenu/onNodeContextMenu не срабатывает (особенно по выделенным узлам).
      panOnDrag={[1]}
      panOnScroll
      zoomOnScroll={false}
      zoomActivationKeyCode={['Meta', 'Control']}
      onEdgeContextMenu={(e, edge) => {
        e.preventDefault();
        setEdgeMenu({ id: edge.id, clientX: e.clientX, clientY: e.clientY });
      }}
      onNodeContextMenu={handleNodeContextMenu}
      onNodeClick={(e, n) => {
        // ЛКМ по узлу, который уже в мультивыделении, открывает мини-меню для
        // группы и НЕ схлопывает выделение (иначе React Flow оставил бы один узел).
        if (selectedNodeIds.size > 1 && selectedNodeIds.has(n.id)) {
          e.preventDefault();
          e.stopPropagation();
          setCtxMenu(null);
          setEdgeMenu(null);
          setSelectedId(n.id);
          const ids = new Set(selectedNodeIds);
          setNodes((nds) => nds.map((nd) => ({ ...nd, selected: ids.has(nd.id) })));
          setNodeMenu({ id: n.id, clientX: e.clientX, clientY: e.clientY });
          return;
        }
        setSelectedId(n.id);
        onSelect(n.id);
      }}
      onPaneClick={() => {
        setSelectedId(null);
        onSelect(null);
        setCtxMenu(null);
      }}
      onPaneContextMenu={handlePaneContextMenu}
      fitView
      colorMode="dark"
      style={{ backgroundColor: '#0d1b3a' }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
    >
      <Background gap={24} size={1} />
      {showMinimap && (
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(n) => TREE_META[(n.data as SaiNodeData).treeKind].color}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border bg-popover py-1 text-sm shadow-lg"
          style={{ left: ctxMenu.clientX, top: ctxMenu.clientY }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={createAtCursor}
          >
            <Plus className="h-3.5 w-3.5" />
            Создать узел
          </button>
          <div className="my-1 border-t" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={() => { reactFlow.fitView({ duration: 400, padding: 0.2 }); setCtxMenu(null); }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Вписать в экран
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={() => { reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 }); setCtxMenu(null); }}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Сброс масштаба
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={() => { useCanvasStore.getState().toggleMinimap(); setCtxMenu(null); }}
          >
            <MapIcon className="h-3.5 w-3.5" />
            {showMinimap ? 'Скрыть миникарту' : 'Показать миникарту'}
          </button>
        </div>
      )}

      {/* Edge context menu */}
      {edgeMenu && (
        <div
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border bg-popover py-1 text-sm shadow-lg"
          style={{ left: edgeMenu.clientX, top: edgeMenu.clientY }}
          onMouseLeave={() => setEdgeMenu(null)}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-destructive hover:bg-accent"
            onClick={() => removeEdge(edgeMenu.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Удалить связь
          </button>
        </div>
      )}

      {/* Node context menu */}
      {nodeMenu && (
        <div
          className="fixed z-50 min-w-[200px] overflow-hidden rounded-lg border bg-popover py-1 text-sm shadow-lg"
          style={{ left: nodeMenu.clientX, top: nodeMenu.clientY }}
          onMouseLeave={() => setNodeMenu(null)}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={() => { createChild(nodeMenu.id); setNodeMenu(null); }}
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            Создать дочерний узел
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={() => { setFocused(nodeMenu.id); setNodeMenu(null); }}
          >
            <Crosshair className="h-3.5 w-3.5" />
            Фокус на узле
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            onClick={() => { void runExpand(nodeMenu.id); setNodeMenu(null); }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Развернуть (Expand)
          </button>
          <div className="my-1 border-t" />
          {selectedNodeIds.size > 1 && selectedNodeIds.has(nodeMenu.id) ? (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-destructive hover:bg-accent"
              onClick={() => { deleteNodes([...selectedNodeIds]); setNodeMenu(null); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить выделенные ({selectedNodeIds.size})
            </button>
          ) : (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-destructive hover:bg-accent"
              onClick={() => { deleteNodes([nodeMenu.id]); setNodeMenu(null); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить узел
            </button>
          )}
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <Button
          size="icon"
          variant="secondary"
          aria-label="Focus / Fit"
          onClick={() => {
            if (selectedId) setFocused(focusedNodeId === selectedId ? null : selectedId);
            else reactFlow.fitView({ duration: 400, padding: 0.2 });
          }}
        >
          {focusedNodeId ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          aria-label="Добавить узел"
          onClick={() =>
            createNodeMutation.mutate({
              workspaceId,
              projectId,
              treeKind: activeTree,
              parentId: null,
              title: 'Новый узел',
              position: { x: 0, y: 0 },
              origin: { type: 'manual' },
            })
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </ReactFlow>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
