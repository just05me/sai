'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TREE_META, type TreeKey } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type TreeProposal = {
  type?: 'tree_proposal';
  treeKind: TreeKey;
  suggestedMode: 'append' | 'replace_subtree' | 'replace_tree' | 'rewrite_all';
  parentNodeId: string | null;
  replaceAtNodeId: string | null;
  root: { title: string; description?: string; children?: unknown[] };
  nodeCount: number;
  existingNodes: { total: number; DEV: number; FUNC: number; BIZ: number };
  /** Узлов именно в целевом дереве (не по всему проекту). */
  existingInTargetTree?: number;
};

type Props = {
  proposal: TreeProposal | null;
  applying: boolean;
  onClose: () => void;
  onApply: (mode: TreeProposal['suggestedMode']) => void;
};

const MODE_LABELS: Record<TreeProposal['suggestedMode'], { title: string; desc: string }> = {
  append: {
    title: 'Сохранить старое и добавить',
    desc: 'Существующие узлы остаются, новые прикрепятся рядом или под выбранным узлом.',
  },
  replace_subtree: {
    title: 'Заменить только нужное',
    desc: 'Удалить поддерево в точке замены и построить новую структуру на его месте.',
  },
  replace_tree: {
    title: 'Перестроить всё дерево',
    desc: 'Удалить все узлы выбранного дерева (DEV/FUNC/BIZ) и создать новые.',
  },
  rewrite_all: {
    title: 'Удалить всё и переписать с нуля',
    desc: 'Очистить все три дерева проекта и построить заново.',
  },
};

export function TreeConfirmationDialog({ proposal, applying, onClose, onApply }: Props) {
  if (!proposal) return null;

  const meta = TREE_META[proposal.treeKind];
  const existingInTree = proposal.existingInTargetTree ?? proposal.existingNodes[proposal.treeKind];

  return (
    <Dialog open onOpenChange={(open) => !open && !applying && onClose()}>
      <DialogContent className="z-[200] max-w-md">
        <DialogHeader>
          <DialogTitle>На холсте уже есть узлы</DialogTitle>
          <DialogDescription>
            AI предложил «{proposal.root.title}» для дерева {meta.label}
            ({proposal.nodeCount} узл.). Сейчас на холсте: {proposal.existingNodes.total} узл.
            {existingInTree > 0 ? `, в ${meta.label}: ${existingInTree}` : ''}.
            Как применить?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {(['append', 'replace_subtree', 'replace_tree', 'rewrite_all'] as const).map((mode) => {
            const label = MODE_LABELS[mode];
            const recommended = proposal.suggestedMode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={applying}
                onClick={() => onApply(mode)}
                className={`w-full rounded-lg border p-3 text-left transition hover:bg-accent disabled:opacity-50 ${
                  recommended ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {label.title}
                  {recommended && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                      рекомендует AI
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{label.desc}</div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={applying} onClick={onClose}>
            Отмена
          </Button>
          {applying && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Применяю…
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
