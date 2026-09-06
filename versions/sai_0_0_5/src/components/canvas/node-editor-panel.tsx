'use client';

import { useEffect, useState } from 'react';
import { X, Trash2, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TipTapEditor } from '@/components/tiptap-editor';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { trpc } from '@/trpc-client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { TreeKey } from '@/lib/utils';

interface Props {
  workspaceId: string;
  projectId: string;
  nodeId: string;
  onClose: () => void;
  onDeepen?: () => void;
}

export function NodeEditorPanel({ workspaceId, projectId, nodeId, onClose, onDeepen }: Props) {
  const utils = trpc.useUtils();
  const node = trpc.nodes.byProject.useQuery({ workspaceId, projectId }).data?.find((n) => n.id === nodeId);

  const [title, setTitle] = useState(node?.title ?? '');
  const [description, setDescription] = useState(node?.description ?? '');
  const debouncedTitle = useDebouncedValue(title, 400);
  const debouncedDesc = useDebouncedValue(description, 600);

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setDescription(node.description ?? '');
    }
  }, [node?.id]);

  const invalidateGraph = () => {
    void utils.nodes.byProject.invalidate({ workspaceId, projectId });
    void utils.edges.byProject.invalidate({ workspaceId, projectId });
  };

  const update = trpc.nodes.update.useMutation({
    onSuccess: invalidateGraph,
  });
  const del = trpc.nodes.delete.useMutation({
    onSuccess: () => {
      invalidateGraph();
      onClose();
    },
  });
  const bulkInsert = trpc.nodes.bulkInsert.useMutation({
    onSuccess: invalidateGraph,
  });

  useEffect(() => {
    // Не сохраняем, пока debounce не догнал локальный стейт — иначе при
    // переключении узла старые debounced-значения перезапишут новый узел.
    if (!node || debouncedTitle !== title) return;
    if (debouncedTitle === node.title) return;
    update.mutate({ workspaceId, id: node.id, title: debouncedTitle });
  }, [debouncedTitle, title, node, update, workspaceId]);

  useEffect(() => {
    if (!node || debouncedDesc !== description) return;
    if (debouncedDesc === (node.description ?? '')) return;
    update.mutate({ workspaceId, id: node.id, description: debouncedDesc });
  }, [debouncedDesc, description, node, update, workspaceId]);

  const triggerExpand = async () => {
    if (!node) return;
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
    const treeKind = node.treeKind as TreeKey;
    const rawPos = node.position;
    const basePos =
      rawPos && typeof rawPos === 'object' && !Array.isArray(rawPos) && 'x' in rawPos && 'y' in rawPos
        ? { x: Number((rawPos as { x: number; y: number }).x), y: Number((rawPos as { x: number; y: number }).y) }
        : { x: 0, y: 0 };
    toast.success(`AI предлагает ${preview.nodes.length} узлов`, {
      action: {
        label: 'Принять все',
        onClick: () => {
          bulkInsert.mutate({
            workspaceId,
            projectId,
            nodes: preview.nodes.map((p: { title: string; description?: string }, i: number) => ({
              treeKind,
              parentId: nodeId,
              title: p.title,
              description: p.description,
              position: { x: basePos.x + (i - preview.nodes.length / 2) * 220, y: basePos.y + 160 },
            })),
          });
        },
      },
    });
  };

  if (!node) return null;

  return (
    <ResizablePanel
      side="right"
      defaultWidth={384}
      minWidth={300}
      maxWidth={760}
      storageKey="panel-width:node-editor"
      className="flex shrink-0 flex-col border-l bg-card/40"
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-xs font-semibold text-muted-foreground">Узел</div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок"
          className="border-0 bg-transparent px-0 text-lg font-semibold focus-visible:ring-0"
        />
        <Separator className="my-3" />
        <TipTapEditor value={description} onChange={setDescription} placeholder="Описание…" />
        <Separator className="my-4" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => void triggerExpand()}>
            <Sparkles className="mr-1 h-4 w-4" />
            Expand (E)
          </Button>
          <Button variant="outline" size="sm" onClick={onDeepen}>
            <MessageSquare className="mr-1 h-4 w-4" />
            Deepen (D)
          </Button>
        </div>
      </div>
      <footer className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:bg-destructive/10"
          onClick={() => del.mutate({ workspaceId, id: nodeId })}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить узел
        </Button>
      </footer>
    </ResizablePanel>
  );
}
