'use client';

import { useState } from 'react';
import { RefreshCw, AlertTriangle, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/trpc-client';
import { TREE_META, cn, type TreeKey } from '@/lib/utils';
import type { SyncIssue, SyncResult } from '@/server/services/sync';

interface Props {
  workspaceId: string;
  projectId: string;
}

export function SyncDialog({ workspaceId, projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const analyzeQuery = trpc.sync.analyze.useQuery(
    { workspaceId, projectId },
    { enabled: false },
  );

  const handleAnalyze = async () => {
    const res = await analyzeQuery.refetch();
    if (res.data) setResult(res.data);
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
  };

  const issueIcon = (kind: SyncIssue['kind']) => {
    switch (kind) {
      case 'missing_in_tree':
        return <ArrowRight className="h-4 w-4 text-yellow-500" />;
      case 'title_mismatch':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'orphan_bridge':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const issueLabel = (kind: SyncIssue['kind']) => {
    switch (kind) {
      case 'missing_in_tree':
        return 'Отсутствует в дереве';
      case 'title_mismatch':
        return 'Расхождение названий';
      case 'orphan_bridge':
        return 'Битая связь';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Синхронизация
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Синхронизация деревьев</DialogTitle>
          <DialogDescription>
            Анализ несоответствий между деревьями DEV, FUNC и BIZ.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="py-8 text-center">
            <Button onClick={handleAnalyze} disabled={analyzeQuery.isFetching}>
              {analyzeQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Анализировать
            </Button>
          </div>
        ) : (
          <>
            {/* Сводка */}
            <div className="flex gap-4 rounded-lg border bg-muted/30 p-3">
              {(['DEV', 'FUNC', 'BIZ'] as const).map((kind) => {
                const key = kind === 'DEV' ? 'devCount' : kind === 'FUNC' ? 'funcCount' : 'bizCount';
                return (
                  <div key={kind} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: TREE_META[kind as TreeKey].color }}
                    />
                    {TREE_META[kind as TreeKey].label}: <strong>{result.summary[key]}</strong>
                  </div>
                );
              })}
              <div className="ml-auto text-sm text-muted-foreground">
                Bridges: <strong>{result.summary.bridgeCount}</strong>
              </div>
            </div>

            {/* Проблемы */}
            {result.issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:bg-green-950/20">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Всё синхронизировано! Несоответствий не найдено.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Найдено {result.issues.length} потенциальных проблем:
                </p>
                <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                  {result.issues.map((issue, i) => (
                    <li
                      key={i}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-2.5 text-sm',
                        issue.kind === 'orphan_bridge' && 'border-destructive/30 bg-destructive/5',
                      )}
                    >
                      {issueIcon(issue.kind)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{issue.nodeTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {issueLabel(issue.kind)}: {issue.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Закрыть
          </Button>
          {result && result.issues.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleAnalyze} disabled={analyzeQuery.isFetching}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Обновить
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
