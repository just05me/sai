'use client';

import { useState, useCallback, useEffect } from 'react';
import { Beaker, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/trpc-client';
import { cn, TREE_META, type TreeKey } from '@/lib/utils';
import { useCanvasStore } from '@/lib/store';
import { Canvas, type DbNodeWithTree } from './canvas';
import { ExportDialog } from './export-dialog';
import { NodeEditorPanel } from './node-editor-panel';
import { CanvasSearch } from './canvas-search';
import { SyncDialog } from './sync-dialog';
import { GlobalChat } from '@/components/chat/global-chat';
import { HypothesisTracker } from '@/components/sidebar/hypothesis-tracker';

interface Props {
  project: {
    id: string;
    name: string;
    workspaceId: string;
    trees: { kind: TreeKey; rootId: string | null }[];
  };
}

export function ProjectWorkspace({ project }: Props) {
  const { activeTree, setActiveTree, showHypothesisTracker, toggleHypothesisTracker, sidebarCollapsed, setFocused } =
    useCanvasStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'mindmap'>('graph');
  const utils = trpc.useUtils();

  const nodesQuery = trpc.nodes.byProject.useQuery({ workspaceId: project.workspaceId, projectId: project.id });
  const edgesQuery = trpc.edges.byProject.useQuery({ workspaceId: project.workspaceId, projectId: project.id });

  const loadError = nodesQuery.error ?? edgesQuery.error;
  const isLoading = nodesQuery.isLoading || edgesQuery.isLoading;

  // Ctrl+F / Cmd+F — открыть поиск по канвасу; M — переключить mindmap
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
      // M — переключение Graph ↔ MindMap (не в полях ввода)
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && e.target === document.body) {
        setViewMode((v) => (v === 'graph' ? 'mindmap' : 'graph'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchNavigate = useCallback(
    (nodeId: string, _projectId: string) => {
      setFocused(nodeId);
      setSelectedNodeId(nodeId);
      if (!chatOpen) setChatOpen(true);
    },
    [setFocused, chatOpen],
  );

  return (
    <div className="relative flex h-screen flex-col">
      <header
        className={cn(
          'flex h-14 items-center justify-between border-b bg-card/50 px-4',
          sidebarCollapsed && 'pl-16',
        )}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{project.name}</h1>
          <Tabs value={activeTree} onValueChange={(v) => setActiveTree(v as TreeKey)}>
            <TabsList className="h-9">
              {(['DEV', 'FUNC', 'BIZ'] as const).map((k, i) => (
                <TabsTrigger key={k} value={k} className="text-xs">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ background: TREE_META[k].color }}
                  />
                  {TREE_META[k].label}
                  <kbd className="ml-1.5 rounded bg-secondary px-1 text-[10px] text-muted-foreground">{i + 1}</kbd>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleHypothesisTracker}>
            <Beaker className="mr-1 h-4 w-4" />
            Гипотезы
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode((v) => (v === 'graph' ? 'mindmap' : 'graph'))}
            title={viewMode === 'graph' ? 'Mind Map (M)' : 'Graph (M)'}
          >
            {viewMode === 'graph' ? '🧠 Mind Map' : '🔗 Graph'}
          </Button>
          <SyncDialog workspaceId={project.workspaceId} projectId={project.id} />
          <ExportDialog projectId={project.id} projectName={project.name} />
          <Button variant="ghost" size="sm" onClick={() => setChatOpen((v) => !v)}>
            <MessageSquare className="mr-1 h-4 w-4" />
            Чат
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <CanvasSearch
          workspaceId={project.workspaceId}
          projectId={project.id}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={handleSearchNavigate}
        />
        <div className="flex h-full min-h-0">
          {showHypothesisTracker && (
            <HypothesisTracker projectId={project.id} workspaceId={project.workspaceId} />
          )}

          <div className="relative flex-1 overflow-hidden">
            {loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-destructive">
                <p className="text-sm font-medium">Не удалось загрузить канвас</p>
                <p className="max-w-md text-center text-xs text-muted-foreground">{loadError.message}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void nodesQuery.refetch();
                    void edgesQuery.refetch();
                  }}
                >
                  Повторить
                </Button>
              </div>
            ) : nodesQuery.data && edgesQuery.data ? (
              <Canvas
                workspaceId={project.workspaceId}
                projectId={project.id}
                activeTree={activeTree}
                dbNodes={nodesQuery.data as unknown as DbNodeWithTree[]}
                dbEdges={edgesQuery.data}
                onSelect={setSelectedNodeId}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> {isLoading ? 'Загрузка канваса…' : 'Нет данных'}
              </div>
            )}
          </div>

          {selectedNodeId && (
            <NodeEditorPanel
              key={selectedNodeId}
              workspaceId={project.workspaceId}
              projectId={project.id}
              nodeId={selectedNodeId}
              onClose={() => setSelectedNodeId(null)}
              onDeepen={() => {
                setChatOpen(true);
                // Chat уже получает nodeId — откроется с контекстом узла
              }}
            />
          )}

          {chatOpen && (
            <GlobalChat
              workspaceId={project.workspaceId}
              projectId={project.id}
              nodeId={selectedNodeId}
              activeTree={activeTree}
              onClose={() => setChatOpen(false)}
              onCanvasMutated={() => {
                utils.nodes.byProject.invalidate({ workspaceId: project.workspaceId, projectId: project.id });
                utils.edges.byProject.invalidate({ workspaceId: project.workspaceId, projectId: project.id });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
